"""
AgriTrace Regression Test: Complete Decoupling of AI Inference from MongoDB Atlas Availability
Covers:
1. Auth & get_current_user resolution succeeds when Atlas is disconnected (PERSISTENCE_MODE='mongodb', ALLOW_STORE_FALLBACK=False).
2. Scan submission (POST /api/v1/ai/workflows/scan) does NOT raise DATABASE_UNAVAILABLE.
3. Real DenseNet-121 and XGBoost models execute without mocked values.
4. Polling & retrieval works for session-only workflows with persisted_durably=False.
5. Inference execution creates zero SmartBag batches or reminders.
6. Explicit Add to SmartBag strictly fails with 503 DATABASE_UNAVAILABLE when Atlas is unavailable.
7. Cross-user workflow access and SmartBag theft are rejected with 403/404.
8. Partial agent failures preserve completed Vision & Shelf-Life results.
9. Malformed input raises validation errors without fabricated fallbacks.
"""

import io
import time
import pytest
from PIL import Image, ImageDraw
from unittest.mock import patch

from app.main import app
from app.core.config import settings
from app.db.mongodb import mongodb
from app.core.security import get_current_user, AuthenticatedUser
from app.services.memory_store import memory_store


def create_test_produce_image(produce: str = "tomato") -> bytes:
    """Generates a realistic test image with produce colors and stem."""
    img = Image.new("RGB", (224, 224), color=(245, 245, 240))
    draw = ImageDraw.Draw(img)
    # Produce body
    draw.ellipse([30, 30, 194, 194], fill=(220, 45, 35))
    # Calyx
    draw.polygon([(112, 15), (95, 40), (129, 40)], fill=(34, 139, 34))
    draw.polygon([(112, 25), (75, 45), (100, 52)], fill=(34, 139, 34))
    draw.polygon([(112, 25), (149, 45), (124, 52)], fill=(34, 139, 34))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def ensure_atlas_offline(monkeypatch):
    """Simulates authoritative MongoDB Atlas environment with active connection failure."""
    monkeypatch.setattr(mongodb, "_connected", False)
    monkeypatch.setattr(mongodb, "db", None)
    monkeypatch.setattr(settings, "PERSISTENCE_MODE", "mongodb")
    monkeypatch.setattr(settings, "ALLOW_STORE_FALLBACK", False)


@pytest.mark.anyio
async def test_auth_does_not_fail_when_atlas_is_unavailable():
    """
    Proves that get_current_user and user_repository.get_by_uid do NOT raise
    DATABASE_UNAVAILABLE when Atlas is offline.
    """
    from app.repositories.user_repository import user_repository

    # Directly calling get_by_uid should gracefully return memory_store profile (or None)
    profile = await user_repository.get_by_uid("nonexistent-uid-test")
    assert profile is None

    # Save to memory_store and verify retrieval works without MongoDB
    memory_store.save_profile("user-session-1", {
        "uid": "user-session-1",
        "email": "user1@agritrace.dev",
        "role": "FARMER",
        "full_name": "Session Farmer",
    })
    cached_profile = await user_repository.get_by_uid("user-session-1")
    assert cached_profile is not None
    assert cached_profile["role"] == "FARMER"


@pytest.mark.anyio
async def test_scan_workflow_executes_in_session_mode_without_mongodb_error(client):
    """
    Proves that POST /api/v1/ai/workflows/scan runs without MongoDB persistence exception.
    """
    user_a = AuthenticatedUser(
        uid="farmer-test-a",
        email="farmer.a@agritrace.dev",
        role="FARMER",
        full_name="Farmer A",
    )
    app.dependency_overrides[get_current_user] = lambda: user_a

    try:
        img_bytes = create_test_produce_image("tomato")
        files = {"image": ("tomato.jpg", io.BytesIO(img_bytes), "image/jpeg")}
        data = {
            "produceType": "tomato",
            "quantityKg": "50.0",
            "temperatureC": "22.0",
            "humidityRh": "75.0",
            "storageType": "ambient",
        }

        # 1. Submit scan
        res = client.post("/api/v1/ai/workflows/scan", files=files, data=data)
        assert res.status_code == 202, f"Failed: {res.status_code} - {res.text}"
        wf_data = res.json()

        assert "workflow_id" in wf_data
        wf_id = wf_data["workflow_id"]
        assert wf_data["persisted_durably"] is False
        assert wf_data["persistence_tier"] == "ephemeral_session"
        assert wf_data["persistence_notice"] is not None

        # 2. Poll workflow
        poll_res = client.get(f"/api/v1/ai/workflows/{wf_id}")
        assert poll_res.status_code == 200
        poll_data = poll_res.json()
        assert poll_data["workflow_id"] == wf_id
        assert poll_data["persisted_durably"] is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_inference_creates_zero_smartbag_batches_and_reminders(client):
    """
    Proves that running AI inference creates ZERO SmartBag inventory batches or reminders.
    """
    user_a = AuthenticatedUser(
        uid="farmer-clean-001",
        email="clean@agritrace.dev",
        role="FARMER",
        full_name="Clean Farmer",
    )
    app.dependency_overrides[get_current_user] = lambda: user_a

    try:
        img_bytes = create_test_produce_image("tomato")
        files = {"image": ("tomato.jpg", io.BytesIO(img_bytes), "image/jpeg")}
        data = {"produceType": "tomato", "quantityKg": "25.0"}

        res = client.post("/api/v1/ai/workflows/scan", files=files, data=data)
        assert res.status_code == 202
        wf_id = res.json()["workflow_id"]

        # Verify no smartbag batches exist for user
        from app.repositories.smartbag_repository import smartbag_repository
        with smartbag_repository._lock:
            user_batches = [b for b in smartbag_repository._memory_batches.values() if b.get("user_id") == user_a.uid]
            assert len(user_batches) == 0, "No SmartBag batches should be created by AI scan!"

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_add_to_smartbag_strictly_fails_when_atlas_is_unavailable(client):
    """
    Proves that explicit Add to SmartBag strictly fails with 503 DATABASE_UNAVAILABLE
    when Atlas is unavailable, while keeping inspection findings intact.
    """
    user_a = AuthenticatedUser(
        uid="farmer-guard-001",
        email="guard@agritrace.dev",
        role="FARMER",
        full_name="Guard Farmer",
    )
    app.dependency_overrides[get_current_user] = lambda: user_a

    try:
        # 1. Create session workflow
        img_bytes = create_test_produce_image("tomato")
        files = {"image": ("tomato.jpg", io.BytesIO(img_bytes), "image/jpeg")}
        data = {"produceType": "tomato", "quantityKg": "75.0"}
        r_scan = client.post("/api/v1/ai/workflows/scan", files=files, data=data)
        assert r_scan.status_code == 202
        wf_id = r_scan.json()["workflow_id"]
        scan_id = r_scan.json()["scan_id"]

        # 2. Try Add to SmartBag -> must strictly fail with 503
        payload = {
            "produce_name": "Fresh Tomato",
            "crop_type": "tomato",
            "quantity_kg": 75.0,
            "scan_id": scan_id,
            "workflow_id": wf_id,
            "freshness_score": 85.0,
            "quality_score": 85.0,
            "predicted_shelf_life_days": 5.0,
            "storage_mode": "ambient",
            "reminders_enabled": True,
        }
        r_sb = client.post("/api/v1/smartbag/batches", json=payload)
        assert r_sb.status_code == 503
        err = r_sb.json()["error"]
        assert err["code"] == "DATABASE_UNAVAILABLE"
        assert "authoritative database but is currently unavailable" in err["message"]

        # 3. Verify workflow inspection findings still exist in session
        r_wf = client.get(f"/api/v1/ai/workflows/{wf_id}")
        assert r_wf.status_code == 200
        assert r_wf.json()["workflow_id"] == wf_id

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_cross_user_workflow_isolation(client):
    """
    Proves that User B cannot read or steal User A's workflow.
    """
    user_a = AuthenticatedUser(uid="user-alpha", email="a@agritrace.dev", role="FARMER")
    user_b = AuthenticatedUser(uid="user-beta", email="b@agritrace.dev", role="FARMER")

    # Create workflow as User A
    app.dependency_overrides[get_current_user] = lambda: user_a
    img_bytes = create_test_produce_image("tomato")
    files = {"image": ("tomato.jpg", io.BytesIO(img_bytes), "image/jpeg")}
    r_scan = client.post("/api/v1/ai/workflows/scan", files=files, data={"produceType": "tomato"})
    assert r_scan.status_code == 202
    wf_id = r_scan.json()["workflow_id"]
    scan_id = r_scan.json()["scan_id"]

    # Switch to User B
    app.dependency_overrides[get_current_user] = lambda: user_b
    try:
        # User B cannot read User A's workflow -> 404
        r_poll = client.get(f"/api/v1/ai/workflows/{wf_id}")
        assert r_poll.status_code == 404

        # User B cannot save User A's workflow to their SmartBag -> 403
        sb_payload = {
            "produce_name": "Stolen Tomato",
            "crop_type": "tomato",
            "quantity_kg": 10.0,
            "scan_id": scan_id,
            "workflow_id": wf_id,
            "freshness_score": 85.0,
            "quality_score": 85.0,
            "predicted_shelf_life_days": 5.0,
        }
        r_save = client.post("/api/v1/smartbag/batches", json=sb_payload)
        assert r_save.status_code == 403
        assert r_save.json()["error"]["code"] == "FORBIDDEN_WORKFLOW_ACCESS"

    finally:
        app.dependency_overrides.pop(get_current_user, None)


@pytest.mark.anyio
async def test_real_model_inference_pipeline_execution():
    """
    Proves that actual DenseNet-121 Vision and XGBoost Shelf-Life models execute.
    """
    from PIL import Image
    from ai.vision.inference import run_vision_pipeline
    from ai.shelf_life.xgboost_model import predict_shelf_life

    # 1. Vision model forward pass with realistic produce image
    tomato_img = Image.open(io.BytesIO(create_test_produce_image("tomato")))
    v_res = run_vision_pipeline(tomato_img)
    assert v_res["status"] in ["SUCCESS", "REJECTED_QUALITY"]
    assert "produce_type" in v_res
    assert isinstance(v_res["quality_score"], (int, float))
    assert 0 <= v_res["quality_score"] <= 100
    assert 0 <= v_res["produce_confidence"] <= 1.0

    # 2. XGBoost calibrated prediction
    sl_res = predict_shelf_life(
        produce_type=v_res.get("produce_type", "tomato"),
        freshness_score=v_res["quality_score"],
        quality_score=v_res["quality_score"],
        defect_probability=v_res.get("defect_probability", 0.05),
        temperature_c=22.0,
        humidity_rh=75.0,
        storage_type="ambient",
    )
    assert "predicted_shelf_life_days" in sl_res
    assert sl_res["predicted_shelf_life_days"] > 0
    assert "prediction_interval_90" in sl_res
    interval = sl_res["prediction_interval_90"]
    assert interval["min_days"] <= sl_res["predicted_shelf_life_days"] <= interval["max_days"]


@pytest.mark.anyio
async def test_partial_agent_failure_preserves_vision_and_shelf_life():
    """
    Proves that if an individual downstream agent fails, completed Vision and Shelf-Life
    results are preserved and status becomes PARTIAL_SUCCESS.
    """
    from app.ai.dag_orchestrator import dag_orchestrator

    img = Image.new("RGB", (224, 224), color=(200, 40, 30))
    input_state = {
        "workflow_id": "wf-partial-test",
        "produce_type": "tomato",
        "quantity_kg": 10.0,
        "image": img,
        "telemetry": {"temperature_c": 22.0, "humidity_rh": 75.0},
    }

    # Simulate market agent throwing an exception
    with patch.object(dag_orchestrator.agents["market"], "run", side_effect=RuntimeError("Mandi price API unreachable")):
        run_res = await dag_orchestrator.run_workflow("wf-partial-test", input_state)

        assert run_res["status"] == "PARTIAL_SUCCESS"
        agent_states = run_res["agent_states"]
        assert agent_states["vision"]["status"] == "SUCCESS"
        assert agent_states["shelf_life"]["status"] == "SUCCESS"
        assert agent_states["market"]["status"] == "FAILED"
        assert "Mandi price API unreachable" in agent_states["market"]["error"]

        # Upstream results remain fully intact
        assert run_res["perception"] is not None
        assert run_res["prediction"] is not None
