import io
import pytest
from PIL import Image
from unittest.mock import patch
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser
from app.ai.dag_orchestrator import DAGOrchestrator, AGENT_DEPENDENCIES
from app.repositories.workflow_repository import WorkflowRepository

@pytest.fixture
def mock_farmer():
    return AuthenticatedUser(
        uid="farmer-ai-test-101",
        email="farmer.ai@agritrace.dev",
        role="FARMER",
        full_name="Kisan AI Tester",
    )

@pytest.fixture
def mock_other_farmer():
    return AuthenticatedUser(
        uid="farmer-ai-other-202",
        email="other.farmer@agritrace.dev",
        role="FARMER",
        full_name="Other Farmer",
    )

@pytest.mark.anyio
async def test_dag_cycle_detection():
    """
    Verifies that the orchestrator rejects circular dependencies in the DAG.
    """
    orch = DAGOrchestrator()
    cyclic_graph = {
        "node_a": ["node_b"],
        "node_b": ["node_c"],
        "node_c": ["node_a"],
    }
    with pytest.raises(ValueError, match="Cyclic dependency detected"):
        orch._validate_dag(cyclic_graph)

@pytest.mark.anyio
async def test_dag_orchestrator_full_execution():
    """
    Verifies that all 8 agents execute in the DAG orchestrator and produce valid outputs.
    """
    orch = DAGOrchestrator()
    input_state = {
        "batch_id": "BATCH-DAG-01",
        "produce_type": "tomato",
        "quantity_kg": 300.0,
        "telemetry": {"temperature_c": 22.0, "humidity_rh": 76.0, "gas_voc_ppm": 10.0},
        "market_trend": "falling",
    }
    result = await orch.run_workflow("wf-test-dag-01", input_state)
    assert result["status"] == "COMPLETED"
    assert result["total_duration_ms"] > 0
    assert len(result["agent_states"]) == 8

    # All agents must have SUCCESS status
    for agent_id, state in result["agent_states"].items():
        assert state["status"] == "SUCCESS", f"Agent {agent_id} failed: {state.get('error')}"

    # Verify decision synthesis
    assert result["action_summary"] is not None
    assert result["action_type"] in ["SELL_NOW", "SELL_SOON", "MONITOR", "STORE_AND_MONITOR", "DIVERT_FOOD_PROCESSING", "COLD_STORAGE_HOLD"]

@pytest.mark.anyio
async def test_dag_failure_propagation_and_partial_success(monkeypatch):
    """
    Verifies that if an upstream agent (vision) fails, dependent agents are marked BLOCKED,
    independent agents complete, and the overall status is PARTIAL_SUCCESS.
    """
    orch = DAGOrchestrator()

    # Force VisionAgent to fail
    def failing_run(state):
        return {
            "status": "FAILED",
            "error": "Corrupted visual frame: failed decoding",
            "confidence": 0.0,
            "evidence": ["Visual perception hardware error"],
        }

    monkeypatch.setattr(orch.agents["vision"], "run", failing_run)

    input_state = {
        "batch_id": "BATCH-DAG-FAIL",
        "produce_type": "tomato",
        "quantity_kg": 100.0,
        "telemetry": {"temperature_c": 20.0, "humidity_rh": 70.0},
    }

    result = await orch.run_workflow("wf-test-fail-01", input_state)
    assert result["status"] in ["PARTIAL_SUCCESS", "FAILED"]

    states = result["agent_states"]
    assert states["vision"]["status"] == "FAILED"
    # Dependent agents must be BLOCKED
    assert states["shelf_life"]["status"] == "BLOCKED"
    assert states["buyer"]["status"] == "BLOCKED"
    assert states["logistics"]["status"] == "BLOCKED"

    # Independent agents running on telemetry should still succeed!
    assert states["risk"]["status"] == "SUCCESS"
    assert states["storage"]["status"] == "SUCCESS"

@pytest.mark.anyio
async def test_workflow_api_create_and_ownership(client, mock_farmer, mock_other_farmer):
    """
    Tests creating a workflow via FastAPI, verifying ownership isolation and results.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer

    try:
        payload = {
            "produce_type": "tomato",
            "quantity_kg": 200.0,
            "temperature_c": 23.0,
            "humidity_rh": 80.0,
            "storage_type": "smartbag",
            "market_trend": "falling",
        }
        r = client.post("/api/v1/ai/workflows", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["user_id"] == mock_farmer.uid
        assert data["produce_type"] == "tomato"
        assert data["status"] in ["COMPLETED", "PARTIAL_SUCCESS"]
        assert "decision" in data
        assert len(data["agent_states"]) == 8

        wf_id = data["workflow_id"]

        # Retrieve workflow
        r_get = client.get(f"/api/v1/ai/workflows/{wf_id}")
        assert r_get.status_code == 200
        assert r_get.json()["workflow_id"] == wf_id

        # Switch to other farmer -> must not see farmer 1's workflow
        app.dependency_overrides[get_current_user] = lambda: mock_other_farmer
        r_unauth = client.get(f"/api/v1/ai/workflows/{wf_id}")
        assert r_unauth.status_code == 404

    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_workflow_api_invalid_farm_ownership_rejection(client, mock_farmer):
    """
    Verifies that attempting to create a workflow referencing another user's farm is rejected.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer

    try:
        payload = {
            "produce_type": "tomato",
            "farm_id": "farm-unauthorized-999",
            "quantity_kg": 50.0,
        }
        r = client.post("/api/v1/ai/workflows", json=payload)
        assert r.status_code == 403
        assert r.json()["error"]["code"] == "FORBIDDEN_RECORD_ACCESS"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_vision_scan_endpoint(client, mock_farmer):
    """
    Tests the standalone produce image scan endpoint.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer

    try:
        # Create a small valid test JPEG in memory
        img = Image.new("RGB", (100, 100), color=(255, 0, 0))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="JPEG")
        img_bytes.seek(0)

        files = {"image": ("test_tomato.jpg", img_bytes, "image/jpeg")}
        r = client.post("/api/v1/ai/vision/scan", files=files)
        assert r.status_code == 200
        data = r.json()
        assert "produce_type" in data
        assert "freshness_grade" in data
        assert "quality_score" in data
        assert data["quality_score"] >= 0.0

        # Test invalid file type rejection
        txt_file = io.BytesIO(b"fake text file")
        r_bad = client.post("/api/v1/ai/vision/scan", files={"image": ("bad.txt", txt_file, "text/plain")})
        assert r_bad.status_code == 400
        assert r_bad.json()["error"]["code"] == "INVALID_IMAGE_TYPE"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_workflow_database_unavailability_rejection(monkeypatch, client, mock_farmer):
    """
    Verifies the decoupled architecture:
    When Atlas is disconnected and ALLOW_STORE_FALLBACK=False:
    1. AI workflow does NOT fail-fast with 503; it executes in honest session preview (persisted_durably=False).
    2. Authoritative SmartBag inventory persistence DOES strictly reject with HTTP 503 DATABASE_UNAVAILABLE.
    """
    from app.core.config import settings
    from app.db.mongodb import mongodb

    monkeypatch.setattr(mongodb, "_connected", False)
    monkeypatch.setattr(mongodb, "db", None)
    monkeypatch.setattr(settings, "PERSISTENCE_MODE", "mongodb")
    monkeypatch.setattr(settings, "ALLOW_STORE_FALLBACK", False)

    app.dependency_overrides[get_current_user] = lambda: mock_farmer

    try:
        # 1. AI Workflow succeeds in ephemeral session mode
        payload = {
            "produce_type": "tomato",
            "quantity_kg": 100.0,
        }
        r = client.post("/api/v1/ai/workflows", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert data["persisted_durably"] is False
        assert data["persistence_tier"] == "ephemeral_session"

        # 2. SmartBag batch persistence strictly rejects with 503 DATABASE_UNAVAILABLE
        sb_payload = {
            "produce_name": "Tomato",
            "crop_type": "tomato",
            "quantity_kg": 100.0,
            "workflow_id": data["workflow_id"],
            "freshness_score": 85.0,
            "quality_score": 85.0,
            "predicted_shelf_life_days": 4.0,
        }
        r_sb = client.post("/api/v1/smartbag/batches", json=sb_payload)
        assert r_sb.status_code == 503
        assert r_sb.json()["error"]["code"] == "DATABASE_UNAVAILABLE"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_workflow_execution_graph_and_trace(client, mock_farmer):
    """
    Verifies that the workflow response contains the structured executionGraph and dag_trace
    required by the frontend modal and dashboard.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer
    try:
        payload = {
            "produce_type": "tomato",
            "quantity_kg": 250.0,
            "temperature_c": 21.0,
            "humidity_rh": 74.0,
        }
        r = client.post("/api/v1/ai/workflows", json=payload)
        assert r.status_code == 201
        data = r.json()
        assert "executionGraph" in data and data["executionGraph"] is not None
        g = data["executionGraph"]
        assert "perception" in g and "shelfLife" in g and "storage" in g
        assert "risk" in g and "market" in g and "buyerMatching" in g and "logistics" in g and "decision" in g

        assert "dag_trace" in data and isinstance(data["dag_trace"], list)
        assert len(data["dag_trace"]) == 8
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_agent_run_alias_endpoint(client, mock_farmer):
    """
    Verifies that /api/v1/ai/agent/run succeeds for both DAG modal requests and dashboard requests.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer
    try:
        # 1. DAG modal payload
        r1 = client.post("/api/v1/ai/agent/run", json={
            "produceType": "tomato",
            "quantityKg": 150.0,
            "temperatureC": 23.0,
        })
        assert r1.status_code == 200
        res1 = r1.json()
        assert res1.get("success") is True
        assert "executionGraph" in res1["data"]

        # 2. Dashboard prompt payload
        r2 = client.post("/api/v1/ai/agent/run", json={
            "agentType": "FARMER_ADVISORY",
            "prompt": "Check harvest viability",
        })
        assert r2.status_code == 200
        res2 = r2.json()
        assert res2.get("success") is True
        assert "advisory" in res2["data"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_standalone_agent_endpoints(client, mock_farmer):
    """
    Verifies that individual agent endpoints run and return structured data.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer
    try:
        # Vision analyze
        r_vis = client.post("/api/v1/ai/vision/analyze", json={"cropContext": "tomato"})
        assert r_vis.status_code == 200
        assert r_vis.json()["success"] is True
        assert r_vis.json()["data"]["commodity"] == "tomato"

        # Freshness predict
        r_fr = client.post("/api/v1/ai/freshness/predict", json={"produceType": "tomato", "storageDays": 2})
        assert r_fr.status_code == 200
        assert r_fr.json()["success"] is True

        # Shelf-life predict
        r_sl = client.post("/api/v1/ai/shelflife/predict", json={
            "produceType": "tomato",
            "currentFreshnessScore": 82.0,
            "temperature": 22.0,
            "humidity": 75.0,
        })
        assert r_sl.status_code == 200
        assert r_sl.json()["success"] is True

        # Price predict
        r_pr = client.post("/api/v1/ai/price/predict", json={
            "commodity": "tomato",
            "marketLocation": "Nashik APMC",
            "forecastHorizonDays": 3,
        })
        assert r_pr.status_code == 200
        assert r_pr.json()["success"] is True

        # RAG query
        r_rag = client.post("/api/v1/ai/rag/query", json={"cropType": "tomato", "query": "blight"})
        assert r_rag.status_code == 200
        assert r_rag.json()["success"] is True
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_ai_inference_runs_without_creating_smartbag_batch_or_reminders(client, mock_farmer):
    """
    Verifies that running AI workflow does NOT create any SmartBag batch or reminders.
    No batch exists until user explicitly clicks Add to SmartBag.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer
    try:
        # Create image
        img = Image.new("RGB", (250, 250), color=(220, 60, 40))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        # 1. Start scan workflow
        r = client.post(
            "/api/v1/ai/workflows/scan",
            files={"image": ("test_tomato.jpg", buf, "image/jpeg")},
            data={"produceType": "tomato", "quantityKg": "2.5"},
        )
        assert r.status_code == 202
        wf_data = r.json()
        wf_id = wf_data["workflow_id"]
        assert wf_data["persisted_durably"] is False or wf_data["persisted_durably"] is True

        # 2. Poll workflow to verify completion
        r_poll = client.get(f"/api/v1/ai/workflows/{wf_id}")
        assert r_poll.status_code == 200
        assert r_poll.json()["workflow_id"] == wf_id

        # 3. Check SmartBag batches: must be EMPTY for this user
        r_batches = client.get("/api/v1/smartbag/batches")
        assert r_batches.status_code == 200
        assert len(r_batches.json()["items"]) == 0

        # 4. Check Reminders: no reminders must exist
        from app.services.reminder_service import reminder_service
        reminders = await reminder_service.get_reminders_for_batch(mock_farmer.uid, "nonexistent")
        assert len(reminders) == 0

    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_ai_workflow_session_resilience_when_atlas_unavailable(client, mock_farmer):
    """
    Verifies that when Atlas is disconnected (mongodb.get_database() is None),
    AI workflow executes successfully in session memory with persisted_durably=False,
    honestly reporting ephemeral_session without failing fast with 503.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer
    try:
        with patch("app.db.mongodb.mongodb.get_database", return_value=None):
            # 1. Post workflow
            r = client.post("/api/v1/ai/workflows", json={
                "produce_type": "tomato",
                "quantity_kg": 50.0,
            })
            assert r.status_code == 201
            wf = r.json()
            assert wf["persisted_durably"] is False
            assert wf["persistence_tier"] == "ephemeral_session"
            assert "Active session" in wf.get("persistence_notice", "")

            # 2. Get workflow in session
            r_get = client.get(f"/api/v1/ai/workflows/{wf['workflow_id']}")
            assert r_get.status_code == 200
            assert r_get.json()["persisted_durably"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_add_to_smartbag_cross_user_workflow_forbidden(client, mock_farmer, mock_other_farmer):
    """
    Verifies that a user cannot add another user's scan/workflow to their SmartBag.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_farmer
    try:
        # Farmer 1 creates workflow
        r_wf = client.post("/api/v1/ai/workflows", json={"produce_type": "tomato", "quantity_kg": 10.0})
        assert r_wf.status_code == 201
        wf_id = r_wf.json()["workflow_id"]

        # Switch to Farmer 2
        app.dependency_overrides[get_current_user] = lambda: mock_other_farmer

        # Farmer 2 attempts to use Farmer 1's workflowId
        payload = {
            "produce_name": "Tomato",
            "crop_type": "tomato",
            "quantity_kg": 10.0,
            "workflow_id": wf_id,
            "freshness_score": 85.0,
            "quality_score": 85.0,
            "predicted_shelf_life_days": 4.0,
        }
        r_sb = client.post("/api/v1/smartbag/batches", json=payload)
        assert r_sb.status_code == 403
        assert r_sb.json()["error"]["code"] == "FORBIDDEN_WORKFLOW_ACCESS"

    finally:
        app.dependency_overrides.pop(get_current_user, None)


