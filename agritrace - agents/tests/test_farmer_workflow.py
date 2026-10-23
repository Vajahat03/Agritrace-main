import io
import os
import sys
import threading
import types
from concurrent.futures import ThreadPoolExecutor

import pytest
from PIL import Image
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app
from backend.security import AuthStore, get_auth_store
import backend.workflow as workflow


@pytest.fixture
def client(tmp_path, monkeypatch):
    store=AuthStore(database_path=tmp_path / "workflow.sqlite3")
    app.dependency_overrides[get_auth_store]=lambda:store
    monkeypatch.setattr(workflow,"UPLOAD_ROOT",tmp_path / "uploads")
    with TestClient(app) as api:
        yield api,store
    app.dependency_overrides.clear()


def register(api,email="farmer@example.test",name="Farmer One",role="farmer",phone="+919876543210"):
    return api.post("/auth/register",json={"full_name":name,"email":email,"phone":phone,"password":"correct horse battery staple","role":role,"workspace_name":name+" workspace"})


def png_bytes():
    output=io.BytesIO()
    Image.new("RGB",(12,12),(200,40,40)).save(output,format="PNG")
    return output.getvalue()


def create_farm(api,name="East plot"):
    result=api.post("/farms",json={"name":name,"location":"Pune","area":"2 hectares"})
    assert result.status_code==201,result.text
    return result.json()


def create_produce(api,farm_id):
    result=api.post("/produce",json={"farm_id":farm_id,"produce_type":"Tomato","quantity":25,"unit":"kg"})
    assert result.status_code==201,result.text
    return result.json()


def create_scan(api,farm_id,produce_id,filename="../unsafe.png",payload=None):
    return api.post("/scans",data={"farm_id":farm_id,"produce_id":produce_id},files={"image":(filename,payload or png_bytes(),"image/png")})


def test_farm_produce_crud_and_workspace_isolation(client):
    api,_=client
    assert register(api,"second@example.test","Second Farmer",phone="+14155552672").status_code==201
    farm=create_farm(api)
    produce=create_produce(api,farm["id"])
    assert api.get("/farms").json()[0]["id"]==farm["id"]
    assert api.get("/farms/"+farm["id"]).status_code==200
    assert api.patch("/farms/"+farm["id"],json={"name":"North plot","location":"Pune","area":"3 hectares"}).status_code==200
    assert api.get("/produce/"+produce["id"]).json()["produce_type"]=="Tomato"
    edited=api.patch("/produce/"+produce["id"],json={"farm_id":farm["id"],"produce_type":"Onion","quantity":10,"unit":"kg"})
    assert edited.status_code==200 and edited.json()["produce_type"]=="Onion"
    assert api.delete("/farms/"+farm["id"]).status_code==409
    assert api.delete("/produce/"+produce["id"]).status_code==204
    assert api.delete("/farms/"+farm["id"]).status_code==204
    assert api.get("/farms/"+farm["id"]).status_code==404


def test_scan_upload_is_created_and_analysis_persists_real_pipeline_result(client,monkeypatch):
    api,store=client
    assert register(api).status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"])
    uploaded=create_scan(api,farm["id"],produce["id"])
    assert uploaded.status_code==201,uploaded.text
    scan=uploaded.json()
    assert scan["status"]=="created" and "image_id" in scan
    image_path=workflow.UPLOAD_ROOT / api.get("/auth/me").json()["user"]["workspace_id"] / (scan["image_id"]+".png")
    assert image_path.exists()
    vision={"status":"SUCCESS","produce_detected":True,"produce_type":"tomato","freshness_grade":"fresh","quality_score":82.0,"defect_probability":0.12,"model_version":"AgriTrace-Vision-D121-v1.0.0","explanation":"local mocked inference output"}
    fake=types.ModuleType("ai.vision.inference"); fake.run_vision_pipeline=lambda image:vision
    monkeypatch.setitem(sys.modules,"ai.vision.inference",fake)
    analyzed=api.post(f"/scans/{scan['id']}/analyze")
    assert analyzed.status_code==200,analyzed.text
    assert analyzed.json()["status"]=="completed"
    assert analyzed.json()["vision"]["quality_score"]==82.0
    assert analyzed.json()["decision"]["action"]=="NORMAL HANDLING"
    history=api.get("/scans").json()
    assert history[0]["id"]==scan["id"] and history[0]["status"]=="completed"
    assert api.get(f"/scans/{scan['id']}/results").json()["vision"]["model_version"]==vision["model_version"]
    with store.connect() as db:
        row=db.execute("SELECT status,image_key,farm_id,vision_result_json FROM produce_scans WHERE id=?",(scan["id"],)).fetchone()
    assert row["status"]=="completed" and row["farm_id"]==farm["id"] and row["vision_result_json"]
    assert ".." not in row["image_key"]


def test_processing_state_is_visible_until_analysis_finishes(client,monkeypatch):
    api,_=client
    assert register(api).status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"])
    uploaded=create_scan(api,farm["id"],produce["id"]).json()
    started,release=threading.Event(),threading.Event()
    def slow_vision(_):
        started.set()
        assert release.wait(timeout=10)
        return {"status":"SUCCESS","produce_detected":True,"produce_type":"tomato","freshness_grade":"fresh","quality_score":80.0,"defect_probability":0.2,"model_version":"AgriTrace-Vision-D121-v1.0.0"}
    fake=types.ModuleType("ai.vision.inference"); fake.run_vision_pipeline=slow_vision
    monkeypatch.setitem(sys.modules,"ai.vision.inference",fake)
    with ThreadPoolExecutor(max_workers=1) as executor:
        task=executor.submit(api.post,f"/scans/{uploaded['id']}/analyze")
        assert started.wait(timeout=5)
        assert api.get(f"/scans/{uploaded['id']}").json()["status"]=="processing"
        release.set()
        result=task.result(timeout=10)
    assert result.status_code==200 and result.json()["status"]=="completed"


def test_scan_runs_existing_shelf_life_v1_only_with_complete_inputs(client,monkeypatch):
    api,store=client
    assert register(api).status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"])
    vision={"status":"SUCCESS","produce_detected":True,"produce_type":"tomato","freshness_grade":"fresh","quality_score":82.0,"defect_probability":0.3,"model_version":"AgriTrace-Vision-D121-v1.0.0"}
    fake=types.ModuleType("ai.vision.inference"); fake.run_vision_pipeline=lambda image:vision
    monkeypatch.setitem(sys.modules,"ai.vision.inference",fake)
    from data_pipeline.shelf_life_training.shelf_life_xgboost_v1.predict import predict
    inputs={"produce_type":"Tomato","freshness_score":70,"quality_score":82.0,"defect_probability":0.3,"temperature_c":10,"humidity_rh":80,"harvest_age_days":3,"storage_type":"Refrigerated"}
    response=api.post("/scans",data={"farm_id":farm["id"],"produce_id":produce["id"],**{k:str(v) for k,v in inputs.items() if k not in {"produce_type","quality_score","defect_probability"}}},files={"image":("photo.png",png_bytes(),"image/png")})
    assert response.status_code==201,response.text
    result=api.post(f"/scans/{response.json()['id']}/analyze")
    assert result.status_code==200,result.text
    shelf=result.json()["shelf_life"]
    assert shelf["predicted_days"]==predict(**inputs)
    assert shelf["model_version"]=="shelf_life_xgboost_v1" and shelf["real_world_validated"] is False
    with store.connect() as db:
        saved=db.execute("SELECT model_name,model_version,predicted_days,development_only,real_world_validated FROM shelf_life_predictions WHERE produce_id=?",(produce["id"],)).fetchone()
    assert saved["predicted_days"]==shelf["predicted_days"] and saved["development_only"]==1 and saved["real_world_validated"]==0


def test_foreign_workspace_ids_and_non_image_upload_are_rejected(client):
    api,_=client
    assert register(api).status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"])
    other=TestClient(app)
    assert register(other,"other@example.test","Other Farmer",phone="+14155552671").status_code==201
    foreign=create_farm(other,"Foreign farm")
    assert api.get("/farms/"+foreign["id"]).status_code==404
    assert api.post("/produce",json={"farm_id":foreign["id"],"produce_type":"Tomato","quantity":2,"unit":"kg"}).status_code==404
    assert create_scan(api,foreign["id"],produce["id"]).status_code==404
    foreign_produce=create_produce(other,foreign["id"])
    foreign_scan=create_scan(other,foreign["id"],foreign_produce["id"]).json()
    assert api.get("/produce/"+foreign_produce["id"]).status_code==404
    assert api.get("/scans/"+foreign_scan["id"]).status_code==404
    assert api.get(f"/scans/{foreign_scan['id']}/results").status_code==404
    assert all(item["id"]!=foreign_scan["id"] for item in api.get("/scans").json())
    assert api.get("/dashboard").json()["scan_count"]==0
    assert other.get("/dashboard").json()["scan_count"]==1
    bad=create_scan(api,farm["id"],produce["id"],payload=b"not a real image")
    assert bad.status_code==400
    assert api.get("/dashboard").json()["scan_count"]==0
    other.close()


def test_role_restrictions_and_scan_failure_are_explicit(client,monkeypatch):
    api,_=client
    assert register(api,role="customer").status_code==201
    assert api.get("/dashboard").status_code==403
    api.post("/auth/logout")
    assert register(api,"second@example.test","Second Farmer",phone="+14155552672").status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"]); scan=create_scan(api,farm["id"],produce["id"]).json()
    fake=types.ModuleType("ai.vision.inference")
    def fail(_): raise RuntimeError("internal checkpoint path must not leak")
    fake.run_vision_pipeline=fail; monkeypatch.setitem(sys.modules,"ai.vision.inference",fake)
    response=api.post(f"/scans/{scan['id']}/analyze")
    assert response.status_code==503 and "checkpoint path" not in response.text
    saved=api.get("/scans/"+scan["id"]).json()
    assert saved["status"]=="failed" and saved["error_code"]=="inference_failed"


def test_complete_inputs_with_vision_value_outside_v1_range_keep_vision_without_clipping(client,monkeypatch):
    api,store=client
    assert register(api).status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"])
    vision={"status":"SUCCESS","produce_detected":True,"produce_type":"apple","freshness_grade":"spoiled","quality_score":57.5,"defect_probability":1.0,"model_version":"AgriTrace-Vision-D121-v1.0.0"}
    fake=types.ModuleType("ai.vision.inference"); fake.run_vision_pipeline=lambda image:vision
    monkeypatch.setitem(sys.modules,"ai.vision.inference",fake)
    data={"farm_id":farm["id"],"produce_id":produce["id"],"freshness_score":"70","temperature_c":"10","humidity_rh":"80","harvest_age_days":"3","storage_type":"Refrigerated"}
    upload=api.post("/scans",data=data,files={"image":("apple.png",png_bytes(),"image/png")})
    assert upload.status_code==201,upload.text
    result=api.post(f"/scans/{upload.json()['id']}/analyze")
    assert result.status_code==200,result.text
    body=result.json()
    assert body["status"]=="completed"
    assert body["vision"]["defect_probability"]==1.0
    assert body["shelf_life"]["status"]=="not_run"
    assert "outside allowed range" in body["shelf_life"]["reason"]
    assert body["decision"]["action"]=="INSPECT / SORT"
    with store.connect() as db:
        assert db.execute("SELECT COUNT(*) FROM shelf_life_predictions").fetchone()[0]==0


def test_vision_only_produce_category_is_scannable_without_v1_category_mapping(client,monkeypatch):
    api,_=client
    assert register(api).status_code==201
    farm=create_farm(api)
    produce=api.post("/produce",json={"farm_id":farm["id"],"produce_type":"Bell Pepper","quantity":3,"unit":"kg"})
    assert produce.status_code==201,produce.text
    vision={"status":"SUCCESS","produce_detected":True,"produce_type":"bell_pepper","freshness_grade":"fresh","quality_score":80.0,"defect_probability":0.2,"model_version":"AgriTrace-Vision-D121-v1.0.0"}
    fake=types.ModuleType("ai.vision.inference"); fake.run_vision_pipeline=lambda image:vision
    monkeypatch.setitem(sys.modules,"ai.vision.inference",fake)
    data={"farm_id":farm["id"],"produce_id":produce.json()["id"],"freshness_score":"70","temperature_c":"10","humidity_rh":"80","harvest_age_days":"3","storage_type":"Refrigerated"}
    uploaded=api.post("/scans",data=data,files={"image":("pepper.png",png_bytes(),"image/png")})
    assert uploaded.status_code==201,uploaded.text
    result=api.post(f"/scans/{uploaded.json()['id']}/analyze")
    assert result.status_code==200,result.text
    assert result.json()["status"]=="completed"
    assert result.json()["vision"]["produce_type"]=="bell_pepper"
    assert result.json()["shelf_life"]["status"]=="not_run"
    assert "not a learned V1 category" in result.json()["shelf_life"]["reason"]


def test_image_security_rejects_unsupported_and_oversized_files(client):
    api,_=client
    assert register(api).status_code==201
    farm=create_farm(api); produce=create_produce(api,farm["id"])
    image=Image.new("RGB",(12,12),(200,40,40)); output=io.BytesIO(); image.save(output,format="GIF")
    unsupported=api.post("/scans",data={"farm_id":farm["id"],"produce_id":produce["id"]},files={"image":("upload.gif",output.getvalue(),"image/gif")})
    assert unsupported.status_code==415
    oversized=api.post("/scans",data={"farm_id":farm["id"],"produce_id":produce["id"]},files={"image":("large.png",b"x"*(8*1024*1024+1),"image/png")})
    assert oversized.status_code==413
    assert api.get("/dashboard").json()["scan_count"]==0


def test_decision_policy_uses_deterministic_real_output_thresholds():
    vision={"quality_score":90.0,"defect_probability":0.1}
    healthy=workflow.decision_for(vision,{"predicted_days":8.0})
    assert healthy["action"]=="NORMAL STORAGE" and healthy["priority"]=="normal"
    urgent=workflow.decision_for(vision,{"predicted_days":1.5})
    assert urgent["action"]=="URGENT SALE" and urgent["priority"]=="urgent" and "1.50 days" in urgent["reason"]
    poor=workflow.decision_for({"quality_score":50.0,"defect_probability":0.1},{"predicted_days":4.0})
    assert poor["action"]=="PRIORITIZE SALE" and poor["priority"]=="high"
    defective=workflow.decision_for({"quality_score":90.0,"defect_probability":0.8},None)
    assert defective["action"]=="INSPECT / SORT" and defective["priority"]=="high" and "80.0%" in defective["reason"]
