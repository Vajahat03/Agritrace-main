"""Workspace scoped farmer workflow endpoints for farms, produce and scans."""
from __future__ import annotations

import io
import json
import math
import os
import uuid
import warnings
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, ConfigDict, Field
from PIL import Image, UnidentifiedImageError

from backend.security import AuthStore, get_auth_store, require_role
from backend.supabase_storage import get_storage
from backend.intelligence import (DECISION_THRESHOLDS, UnavailableMarketProvider,
                                  decision_for, market_snapshot_for)

router = APIRouter()
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
IMAGE_TYPES = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
SHELF_LIFE_PRODUCE_CATEGORIES = frozenset(("Apple", "Banana", "Brinjal", "Cabbage", "Capsicum", "Carrot", "Cauliflower", "Chilli", "Cucumber", "Garlic", "Ginger", "Grapes", "Guava", "Lemon", "Mango", "Okra", "Onion", "Orange", "Papaya", "Peas", "Pomegranate", "Potato", "Spinach", "Tomato", "Watermelon"))
VISION_PRODUCE_CATEGORIES = frozenset(("Tomato", "Apple", "Banana", "Potato", "Onion", "Orange", "Bell Pepper", "Strawberry", "Unknown"))
PRODUCE_CATEGORIES = SHELF_LIFE_PRODUCE_CATEGORIES | VISION_PRODUCE_CATEGORIES
STORAGE_CATEGORIES = frozenset(("Cold Storage", "Controlled Atmosphere", "Open Market", "Refrigerated", "Room Temperature"))
INVENTORY_UNIT_FACTORS = {"kg": 1.0, "g": 0.001, "quintal": 100.0, "tonne": 1000.0,
                          "crate": None, "box": None}
MARKET_DATA_PROVIDER = UnavailableMarketProvider()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def private_user(user: dict[str, Any]) -> dict[str, Any]:
    if user["role"] not in {"farmer", "admin"}:
        raise HTTPException(403, "This workspace workflow is available to farmers and administrators")
    return user


def scoped_record(db, table: str, record_id: str, user: dict[str, Any]):
    row = db.execute(f"SELECT * FROM {table} WHERE id=? AND workspace_id=? AND owner_user_id=?",
                     (record_id, user["workspace_id"], user["user_id"])).fetchone()
    return row


class FarmPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    name: str = Field(min_length=1, max_length=120)
    location: str = Field(default="", max_length=300)
    area: str = Field(default="", max_length=80)
    soil_info: str = Field(default="", max_length=300)


class ProducePayload(BaseModel):
    model_config = ConfigDict(extra="forbid")
    farm_id: str
    produce_type: str = Field(min_length=1, max_length=80)
    quantity: float | None = Field(default=None, ge=0)
    unit: str = Field(default="kg", max_length=20)
    harvest_at: str | None = None

    @staticmethod
    def _check_quantity_and_unit(values):
        quantity = values.get("quantity")
        unit = values.get("unit", "kg")
        if quantity is not None and (not math.isfinite(quantity) or quantity < 0):
            raise ValueError("quantity must be a finite, non-negative number")
        if unit not in INVENTORY_UNIT_FACTORS:
            raise ValueError("unit must be one of: kg, g, quintal, tonne, crate, box")
        return values

    if hasattr(BaseModel, "model_fields"):
        from pydantic import model_validator

        @model_validator(mode="after")
        def validate_inventory(self):
            self._check_quantity_and_unit({"quantity": self.quantity, "unit": self.unit})
            return self


def ensure_schema(store: AuthStore):
    """Additive migrations keep existing Phase 2 records intact."""
    with store.connect() as db:
        for table, columns in {
            "farms": {"location": "TEXT NOT NULL DEFAULT ''", "area": "TEXT NOT NULL DEFAULT ''", "soil_info": "TEXT NOT NULL DEFAULT ''"},
            "produce": {"unit": "TEXT NOT NULL DEFAULT 'kg'", "updated_at": "TEXT", "quantity_value": "REAL"},
            "produce_scans": {
                "farm_id": "TEXT", "image_key": "TEXT", "status": "TEXT NOT NULL DEFAULT 'completed'",
                "vision_result_json": "TEXT", "shelf_life_result_json": "TEXT", "decision_json": "TEXT",
                "shelf_life_inputs_json": "TEXT", "prediction_id": "TEXT", "error_code": "TEXT", "updated_at": "TEXT",
                "market_snapshot_json": "TEXT",
            },
        }.items():
            if getattr(store, "_test_sqlite", False):
                existing = {r["name"] for r in db.execute(f"PRAGMA table_info({table})")}
            else:
                existing = {r["column_name"] for r in db.execute(
                    "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=?",
                    (table,),
                )}
            for name, definition in columns.items():
                if name not in existing:
                    db.execute(f"ALTER TABLE {table} ADD COLUMN {name} {definition}")
        db.execute("CREATE INDEX IF NOT EXISTS idx_scans_workspace_owner ON produce_scans(workspace_id,owner_user_id,created_at)")
        db.execute("""CREATE TABLE IF NOT EXISTS market_snapshots (
            id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, owner_user_id TEXT NOT NULL,
            cache_key TEXT NOT NULL, normalized_json TEXT NOT NULL, source TEXT,
            fetched_at TEXT NOT NULL, expires_at REAL NOT NULL,
            FOREIGN KEY (workspace_id,owner_user_id) REFERENCES workspace_members(workspace_id,user_id) ON DELETE CASCADE
        )""")
        db.execute("CREATE INDEX IF NOT EXISTS idx_market_snapshots_cache ON market_snapshots(workspace_id,owner_user_id,cache_key,expires_at)")
        # Preserve the original entered quantity while storing mass in canonical kg.
        db.execute("UPDATE produce SET quantity_value=quantity_kg WHERE quantity_value IS NULL AND quantity_kg IS NOT NULL")
        for unit, factor in INVENTORY_UNIT_FACTORS.items():
            if factor is not None:
                db.execute("UPDATE produce SET quantity_kg=quantity_value*? WHERE unit=? AND quantity_value IS NOT NULL", (factor, unit))
            else:
                db.execute("UPDATE produce SET quantity_kg=NULL WHERE unit=? AND quantity_value IS NOT NULL", (unit,))


def db_dependency(store: AuthStore = Depends(get_auth_store)):
    ensure_schema(store)
    return store


def _inventory_kg(quantity: float | None, unit: str) -> float | None:
    factor = INVENTORY_UNIT_FACTORS[unit]
    return quantity * factor if quantity is not None and factor is not None else None


def _market_snapshot(store: AuthStore, user: dict[str, Any], produce_type: str, location: str) -> dict[str, Any]:
    provider = MARKET_DATA_PROVIDER
    today = datetime.now(timezone.utc).date().isoformat()
    key = json.dumps([produce_type.casefold(), location.strip().casefold(), today,
                      getattr(provider, "name", provider.__class__.__name__)], separators=(",", ":"))
    with store.connect() as db:
        row = db.execute("SELECT normalized_json FROM market_snapshots WHERE workspace_id=? AND owner_user_id=? AND cache_key=? AND expires_at>? ORDER BY fetched_at DESC LIMIT 1",
                         (user["workspace_id"], user["user_id"], key, datetime.now(timezone.utc).timestamp())).fetchone()
    if row:
        return json.loads(row["normalized_json"])
    snapshot = market_snapshot_for(provider, produce_type, location).copy()
    if snapshot.get("price_status") == "available":
        timestamp = datetime.now(timezone.utc)
        ttl = max(0, int(os.getenv("MARKET_DATA_CACHE_TTL_SECONDS", "900")))
        with store.connect() as db:
            db.execute("INSERT INTO market_snapshots(id,workspace_id,owner_user_id,cache_key,normalized_json,source,fetched_at,expires_at) VALUES(?,?,?,?,?,?,?,?)",
                       (str(uuid.uuid4()), user["workspace_id"], user["user_id"], key,
                        json.dumps(snapshot, sort_keys=True), snapshot.get("source"), timestamp.isoformat(),
                        timestamp.timestamp() + ttl))
    return snapshot


@router.get("/farms")
def list_farms(user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        rows = db.execute("SELECT id,name,address AS location,area,soil_info,owner_user_id AS created_by,created_at,updated_at FROM farms WHERE workspace_id=? AND owner_user_id=? ORDER BY created_at DESC",
                          (user["workspace_id"], user["user_id"])).fetchall()
        return [dict(row) for row in rows]


@router.post("/farms", status_code=201)
def create_farm(payload: FarmPayload, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    fid, stamp = str(uuid.uuid4()), now()
    with store.connect() as db:
        db.execute("INSERT INTO farms(id,workspace_id,owner_user_id,name,address,created_at,updated_at,location,area,soil_info) VALUES(?,?,?,?,?,?,?,?,?,?)",
                   (fid,user["workspace_id"],user["user_id"],payload.name.strip(),payload.location.strip(),stamp,stamp,payload.location.strip(),payload.area.strip(),payload.soil_info.strip()))
    return {"id": fid, "created_by":user["user_id"],"name": payload.name.strip(), "location": payload.location.strip(), "area": payload.area.strip(), "soil_info": payload.soil_info.strip(), "created_at": stamp, "updated_at": stamp}


@router.patch("/farms/{farm_id}")
def edit_farm(farm_id: str, payload: FarmPayload, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        row = scoped_record(db, "farms", farm_id, user)
        if row is None: raise HTTPException(404, "Farm not found")
        db.execute("UPDATE farms SET name=?,address=?,location=?,area=?,soil_info=?,updated_at=? WHERE id=?",
                   (payload.name.strip(),payload.location.strip(),payload.location.strip(),payload.area.strip(),payload.soil_info.strip(),now(),farm_id))
    return {"id": farm_id, "name": payload.name.strip(), "location": payload.location.strip(), "area": payload.area.strip(), "soil_info": payload.soil_info.strip()}


@router.get("/farms/{farm_id}")
def read_farm(farm_id: str, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db: row=scoped_record(db,"farms",farm_id,user)
    if row is None: raise HTTPException(404,"Farm not found")
    return {"id":row["id"],"created_by":row["owner_user_id"],"name":row["name"],"location":row["location"],"area":row["area"],"soil_info":row["soil_info"],"created_at":row["created_at"],"updated_at":row["updated_at"]}


@router.delete("/farms/{farm_id}", status_code=204)
def remove_farm(farm_id: str, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        if scoped_record(db, "farms", farm_id, user) is None: raise HTTPException(404, "Farm not found")
        if db.execute("SELECT 1 FROM produce WHERE farm_id=? LIMIT 1", (farm_id,)).fetchone():
            raise HTTPException(409, "Farm still has produce records. Remove those records before deleting the farm.")
        db.execute("DELETE FROM farms WHERE id=?", (farm_id,))


@router.get("/produce")
def list_produce(farm_id: str | None = None,user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        sql="SELECT p.id,p.farm_id,p.produce_type,COALESCE(p.quantity_value,p.quantity_kg) AS quantity,p.quantity_kg,p.unit,p.harvest_at,p.created_at,p.updated_at,p.owner_user_id AS created_by,f.name AS farm_name FROM produce p LEFT JOIN farms f ON f.id=p.farm_id WHERE p.workspace_id=? AND p.owner_user_id=?"
        params=[user["workspace_id"],user["user_id"]]
        if farm_id: sql += " AND p.farm_id=?"; params.append(farm_id)
        sql += " ORDER BY p.created_at DESC"
        rows = db.execute(sql, params).fetchall()
        return [dict(row) for row in rows]


@router.post("/produce", status_code=201)
def create_produce(payload: ProducePayload, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    if payload.produce_type not in PRODUCE_CATEGORIES: raise HTTPException(422,"Unknown produce_type; use one of the V1 learned categories")
    pid, stamp = str(uuid.uuid4()), now()
    with store.connect() as db:
        if payload.farm_id and scoped_record(db,"farms",payload.farm_id,user) is None: raise HTTPException(404,"Farm not found")
        db.execute("INSERT INTO produce(id,workspace_id,owner_user_id,farm_id,produce_type,quantity_kg,harvest_at,created_at,unit,updated_at,quantity_value) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                   (pid,user["workspace_id"],user["user_id"],payload.farm_id,payload.produce_type.strip(),_inventory_kg(payload.quantity,payload.unit),payload.harvest_at,stamp,payload.unit,stamp,payload.quantity))
    return {"id":pid,"created_by":user["user_id"],"farm_id":payload.farm_id,"produce_type":payload.produce_type.strip(),"quantity":payload.quantity,"quantity_kg":_inventory_kg(payload.quantity,payload.unit),"unit":payload.unit,"harvest_at":payload.harvest_at,"created_at":stamp,"updated_at":stamp}


@router.get("/produce/{produce_id}")
def read_produce(produce_id: str, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db: row=scoped_record(db,"produce",produce_id,user)
    if row is None: raise HTTPException(404,"Produce record not found")
    return {"id":row["id"],"created_by":row["owner_user_id"],"farm_id":row["farm_id"],"produce_type":row["produce_type"],"quantity":row["quantity_value"] if "quantity_value" in row.keys() else row["quantity_kg"],"quantity_kg":row["quantity_kg"],"unit":row["unit"],"harvest_at":row["harvest_at"],"created_at":row["created_at"],"updated_at":row["updated_at"]}


@router.patch("/produce/{produce_id}")
def edit_produce(produce_id: str,payload: ProducePayload,user=Depends(require_role("farmer")),store=Depends(db_dependency)):
    private_user(user)
    if payload.produce_type not in PRODUCE_CATEGORIES: raise HTTPException(422,"Unknown produce_type; use one of the V1 learned categories")
    with store.connect() as db:
        if scoped_record(db,"produce",produce_id,user) is None: raise HTTPException(404,"Produce record not found")
        if payload.farm_id and scoped_record(db,"farms",payload.farm_id,user) is None: raise HTTPException(404,"Farm not found")
        db.execute("UPDATE produce SET farm_id=?,produce_type=?,quantity_kg=?,quantity_value=?,unit=?,harvest_at=?,updated_at=? WHERE id=?",(payload.farm_id,payload.produce_type.strip(),_inventory_kg(payload.quantity,payload.unit),payload.quantity,payload.unit,payload.harvest_at,now(),produce_id))
    return read_produce(produce_id,user,store)


@router.delete("/produce/{produce_id}", status_code=204)
def remove_produce(produce_id: str, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        if scoped_record(db,"produce",produce_id,user) is None: raise HTTPException(404,"Produce record not found")
        images=[r["image_key"] for r in db.execute("SELECT image_key FROM produce_scans WHERE produce_id=? AND workspace_id=? AND owner_user_id=?",(produce_id,user["workspace_id"],user["user_id"])) if r["image_key"]]
        db.execute("DELETE FROM produce WHERE id=?",(produce_id,))
    try:
        get_storage().remove(images)
    except RuntimeError:
        # The DB record is already gone; report the orphan cleanup issue clearly.
        raise HTTPException(502,"Produce was deleted, but its scan images could not be removed from Supabase Storage")


@router.get("/dashboard")
def dashboard(user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        farms = db.execute("SELECT COUNT(*) FROM farms WHERE workspace_id=? AND owner_user_id=?",(user["workspace_id"],user["user_id"])).fetchone()[0]
        produce = db.execute("SELECT COUNT(*),COALESCE(SUM(quantity_kg),0) FROM produce WHERE workspace_id=? AND owner_user_id=?",(user["workspace_id"],user["user_id"])).fetchone()
        scans = db.execute("SELECT COUNT(*),SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) FROM produce_scans WHERE workspace_id=? AND owner_user_id=?",(user["workspace_id"],user["user_id"])).fetchone()
        quality_rows=db.execute("SELECT vision_result_json,shelf_life_result_json FROM produce_scans WHERE workspace_id=? AND owner_user_id=? AND status='completed'",(user["workspace_id"],user["user_id"])).fetchall()
        qualities=[]; urgent_count=0
        for item in quality_rows:
            if item["vision_result_json"]:
                score=json.loads(item["vision_result_json"]).get("quality_score")
                if isinstance(score,(int,float)): qualities.append(float(score))
            if item["shelf_life_result_json"]:
                days=json.loads(item["shelf_life_result_json"]).get("predicted_days")
                if isinstance(days,(int,float)) and days <= DECISION_THRESHOLDS["urgent_days"]: urgent_count += 1
        recent = db.execute("SELECT id,produce_id,status,created_at,decision_json FROM produce_scans WHERE workspace_id=? AND owner_user_id=? ORDER BY created_at DESC LIMIT 5",(user["workspace_id"],user["user_id"])).fetchall()
        recent_items = [dict(r) | {"decision": json.loads(r["decision_json"]) if r["decision_json"] else None} for r in recent]
        for item in recent_items: item.pop("decision_json",None)
    return {"farm_count":farms,"produce_count":produce[0],"quantity_kg":produce[1],"scan_count":scans[0],"completed_scan_count":scans[1] or 0,"average_quality_score":round(sum(qualities)/len(qualities),1) if qualities else None,"urgent_shelf_life_alerts":urgent_count,"recent_scans":recent_items}


@router.get("/scans")
def list_scans(farm_id: str | None = None, produce_id: str | None = None, status: str | None = None, user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        sql="SELECT s.id,s.produce_id,s.status,s.created_at,s.updated_at,s.vision_result_json,s.shelf_life_result_json,s.market_snapshot_json,s.decision_json,s.error_code,p.produce_type,p.farm_id FROM produce_scans s JOIN produce p ON p.id=s.produce_id WHERE s.workspace_id=? AND s.owner_user_id=?"
        params=[user["workspace_id"],user["user_id"]]
        if farm_id: sql += " AND p.farm_id=?"; params.append(farm_id)
        if produce_id: sql += " AND s.produce_id=?"; params.append(produce_id)
        if status: sql += " AND s.status=?"; params.append(status)
        sql += " ORDER BY s.created_at DESC"
        rows=db.execute(sql,params).fetchall()
        return [{"id":r["id"],"produce_id":r["produce_id"],"produce_type":r["produce_type"],"farm_id":r["farm_id"],"status":r["status"],"created_at":r["created_at"],"updated_at":r["updated_at"],"image_id":r["id"],"vision":json.loads(r["vision_result_json"]) if r["vision_result_json"] else None,"shelf_life":json.loads(r["shelf_life_result_json"]) if r["shelf_life_result_json"] else None,"market":json.loads(r["market_snapshot_json"]) if r["market_snapshot_json"] else {"price_status":"unavailable"},"decision":json.loads(r["decision_json"]) if r["decision_json"] else None,"error_code":r["error_code"]} for r in rows]


@router.post("/scans", status_code=201)
async def create_scan(farm_id: str = Form(...),produce_id: str = Form(...), freshness_score: float | None = Form(None), temperature_c: float | None = Form(None), humidity_rh: float | None = Form(None), harvest_age_days: float | None = Form(None), storage_type: str | None = Form(None), image: UploadFile = File(...), user=Depends(require_role("farmer")), store=Depends(db_dependency)):
    private_user(user)
    shelf_inputs=(freshness_score,temperature_c,humidity_rh,harvest_age_days,storage_type)
    if any(v is not None for v in shelf_inputs) and not all(v is not None for v in shelf_inputs):
        raise HTTPException(422,"Provide all five V1 shelf-life inputs together, or leave all of them blank")
    if storage_type is not None and storage_type not in STORAGE_CATEGORIES:
        raise HTTPException(422,"Unknown storage_type; use one of the V1 learned categories")
    contents = await image.read(MAX_IMAGE_BYTES + 1)
    if not contents or len(contents) > MAX_IMAGE_BYTES: raise HTTPException(413,"Image must be non-empty and no larger than 8 MiB")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(contents)) as opened:
                fmt=opened.format
                if fmt not in IMAGE_TYPES: raise HTTPException(415,"Upload a JPEG, PNG, or WebP image")
                if opened.width * opened.height > MAX_IMAGE_PIXELS: raise HTTPException(413,"Image dimensions exceed the 20 megapixel limit")
                opened.verify()
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning): raise HTTPException(400,"Uploaded file is not a valid image")
    scan_id,stamp=str(uuid.uuid4()),now()
    image_key=f"{user['workspace_id']}/{scan_id}{IMAGE_TYPES[fmt]}"
    storage=get_storage()
    try:
        storage.ensure_private_bucket(MAX_IMAGE_BYTES)
        storage.upload(image_key,contents,{"JPEG":"image/jpeg","PNG":"image/png","WEBP":"image/webp"}[fmt])
    except RuntimeError as exc:
        raise HTTPException(502,"Unable to store the scan image in Supabase Storage") from exc
    with store.connect() as db:
        produce=scoped_record(db,"produce",produce_id,user)
        if produce is None:
            storage.remove([image_key])
            raise HTTPException(404,"Produce record not found")
        if produce["farm_id"] != farm_id or scoped_record(db,"farms",farm_id,user) is None:
            storage.remove([image_key])
            raise HTTPException(404,"Produce or farm not found")
        try:
            db.execute("INSERT INTO produce_scans(id,workspace_id,owner_user_id,produce_id,farm_id,created_at,result_json,status,image_key,shelf_life_inputs_json,updated_at) VALUES(?,?,?,?,?,?, '{}','created',?,?,?)",(scan_id,user["workspace_id"],user["user_id"],produce_id,produce["farm_id"],stamp,image_key,json.dumps({k:v for k,v in {"freshness_score":freshness_score,"temperature_c":temperature_c,"humidity_rh":humidity_rh,"harvest_age_days":harvest_age_days,"storage_type":storage_type}.items() if v is not None}),stamp))
        except Exception:
            storage.remove([image_key])
            raise
    return {"id":scan_id,"farm_id":produce["farm_id"],"produce_id":produce_id,"status":"created","image_id":scan_id,"created_at":stamp}


@router.post("/scans/{scan_id}/analyze")
def analyze_scan(scan_id: str,user=Depends(require_role("farmer")),store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db:
        row=scoped_record(db,"produce_scans",scan_id,user)
        if row is None: raise HTTPException(404,"Scan not found")
        if row["status"]=="processing": raise HTTPException(409,"Scan analysis is already in progress")
        if not row["image_key"]: raise HTTPException(409,"Scan has no stored image to analyze")
        db.execute("UPDATE produce_scans SET status='processing',error_code=NULL,updated_at=? WHERE id=?",(now(),scan_id))
        produce=db.execute("SELECT p.*,f.location AS farm_location FROM produce p LEFT JOIN farms f ON f.id=p.farm_id WHERE p.id=? AND p.workspace_id=? AND p.owner_user_id=?",(row["produce_id"],user["workspace_id"],user["user_id"])).fetchone()
        image_key=row["image_key"]
        inputs=json.loads(row["shelf_life_inputs_json"] or "{}")
    try:
        contents=get_storage().download(image_key)
        with Image.open(io.BytesIO(contents)) as opened: rgb=opened.convert("RGB")
    except RuntimeError as exc:
        with store.connect() as db: db.execute("UPDATE produce_scans SET status='failed',error_code='image_unavailable',updated_at=? WHERE id=?",(now(),scan_id))
        raise HTTPException(502,"Scan image could not be loaded from Supabase Storage") from exc
    try:
        from ai.vision.inference import run_vision_pipeline
        vision=run_vision_pipeline(rgb)
        vision.setdefault("inference_timestamp",now())
        market_snapshot = {"price_status": "unavailable", "source": "unavailable"}
        if vision.get("status") not in {None,"SUCCESS"} or vision.get("produce_detected") is False:
            status_value="failed"; decision={"action":"RETAKE_IMAGE","priority":"normal","reason":vision.get("message") or "Vision did not confirm produce in this image."}; shelf=None
            error_code="vision_rejected"
        else:
            status_value="completed"
            defect=float(vision["defect_probability"])
            quality=float(vision["quality_score"])
            shelf=None
            shelf_for_decision=None
            if inputs:
                if produce["produce_type"] not in SHELF_LIFE_PRODUCE_CATEGORIES:
                    shelf={"status":"not_run","model_name":"shelf_life_xgboost_v1","model_version":"shelf_life_xgboost_v1","reason":f"Produce type {produce['produce_type']!r} is not a learned V1 category."}
                else:
                    from data_pipeline.shelf_life_training.shelf_life_xgboost_v1.predict import predict as predict_v1
                    try:
                        predicted_days=predict_v1(produce_type=produce["produce_type"],quality_score=quality,defect_probability=defect,**inputs)
                    except ValueError as exc:
                        # V1 validation rejects values outside its training ranges.
                        # Keep the real vision result; never coerce it to fit V1.
                        shelf={"status":"not_run","model_name":"shelf_life_xgboost_v1","model_version":"shelf_life_xgboost_v1","reason":str(exc)}
                    else:
                        shelf={"status":"completed","model_name":"shelf_life_xgboost_v1","model_version":"shelf_life_xgboost_v1","development_only":True,"real_world_validated":False,"predicted_days":predicted_days}
                        shelf_for_decision=shelf
            prediction_id=str(uuid.uuid4()) if shelf_for_decision else None
            if shelf_for_decision: shelf["prediction_id"]=prediction_id
            market_snapshot = _market_snapshot(store,user,produce["produce_type"],produce["farm_location"] or "")
            inventory={"quantity":produce["quantity_value"] if produce["quantity_value"] is not None else produce["quantity_kg"],
                       "unit":produce["unit"],"quantity_kg":produce["quantity_kg"]}
            decision=decision_for(vision,shelf_for_decision,inventory,market_snapshot)
            error_code=None
        with store.connect() as db:
            if status_value=="completed" and shelf_for_decision:
                provenance={"freshness_score":"explicit_development_model_input","quality_score":"vision_model_output","defect_probability":"vision_model_output",**{key:"caller_supplied" for key in ("temperature_c","humidity_rh","harvest_age_days","storage_type")}}
                db.execute("INSERT INTO shelf_life_predictions(id,workspace_id,owner_user_id,produce_id,model_name,model_version,predicted_days,created_at,input_provenance_json,development_only,real_world_validated) VALUES(?,?,?,?,?,?,?,?,?,TRUE,FALSE)",(prediction_id,user["workspace_id"],user["user_id"],produce["id"],shelf["model_name"],shelf["model_version"],shelf["predicted_days"],now(),json.dumps(provenance,sort_keys=True)))
            db.execute("UPDATE produce_scans SET status=?,result_json=?,vision_result_json=?,shelf_life_result_json=?,decision_json=?,market_snapshot_json=?,prediction_id=?,error_code=?,updated_at=? WHERE id=?",(status_value,json.dumps(vision),json.dumps(vision),json.dumps(shelf) if shelf else None,json.dumps(decision),json.dumps(market_snapshot),prediction_id if status_value=="completed" else None,error_code,now(),scan_id))
    except ValueError as exc:
        with store.connect() as db: db.execute("UPDATE produce_scans SET status='failed',error_code='invalid_model_input',updated_at=? WHERE id=?",(now(),scan_id))
        raise HTTPException(422,str(exc)) from exc
    except HTTPException:
        with store.connect() as db: db.execute("UPDATE produce_scans SET status='failed',error_code='analysis_rejected',updated_at=? WHERE id=?",(now(),scan_id))
        raise
    except Exception as exc:
        with store.connect() as db: db.execute("UPDATE produce_scans SET status='failed',error_code='inference_failed',updated_at=? WHERE id=?",(now(),scan_id))
        raise HTTPException(503,"Image analysis failed; you can retry this scan") from exc
    return {"id":scan_id,"produce_id":produce["id"],"status":status_value,"vision":vision,"shelf_life":shelf,"market":market_snapshot,"decision":decision}


@router.get("/scans/{scan_id}")
def get_scan(scan_id: str,user=Depends(require_role("farmer")),store=Depends(db_dependency)):
    private_user(user)
    with store.connect() as db: row=scoped_record(db,"produce_scans",scan_id,user)
    if row is None: raise HTTPException(404,"Scan not found")
    return {"id":row["id"],"produce_id":row["produce_id"],"farm_id":row["farm_id"],"created_by":row["owner_user_id"],"status":row["status"],"created_at":row["created_at"],"updated_at":row["updated_at"],"image_id":row["id"],"vision":json.loads(row["vision_result_json"]) if row["vision_result_json"] else None,"shelf_life":json.loads(row["shelf_life_result_json"]) if row["shelf_life_result_json"] else None,"market":json.loads(row["market_snapshot_json"]) if row["market_snapshot_json"] else {"price_status":"unavailable"},"decision":json.loads(row["decision_json"]) if row["decision_json"] else None,"error_code":row["error_code"]}


@router.get("/scans/{scan_id}/results")
def scan_results(scan_id: str,user=Depends(require_role("farmer")),store=Depends(db_dependency)):
    return get_scan(scan_id,user,store)
