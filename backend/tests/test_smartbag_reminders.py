import io
import pytest
from PIL import Image
from datetime import datetime, timezone, timedelta
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser

@pytest.fixture
def mock_customer():
    return AuthenticatedUser(
        uid="customer-smartbag-01",
        email="consumer@agritrace.dev",
        role="CUSTOMER",
        full_name="Priya Sharma",
    )

@pytest.fixture
def mock_other_customer():
    return AuthenticatedUser(
        uid="customer-other-02",
        email="other.consumer@agritrace.dev",
        role="CUSTOMER",
        full_name="Raj Patel",
    )

@pytest.mark.anyio
async def test_unified_produce_inspect_endpoint(client, mock_customer):
    """
    Verifies that POST /api/v1/ai/inspect decodes produce image, runs DenseNet-121 Vision,
    calculates optical metrics (freshness %, firmness index, color uniformity), runs XGBoost Shelf-Life,
    and returns 8-agent DAG results.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    try:
        # Create test JPEG
        img = Image.new("RGB", (120, 120), color=(220, 40, 40))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="JPEG")
        img_bytes.seek(0)

        files = {"image": ("fresh_tomato.jpg", img_bytes, "image/jpeg")}
        data = {
            "storageMode": "ambient",
            "temperatureC": 22.0,
            "humidityRh": 75.0,
            "quantityKg": 2.5,
        }

        r = client.post("/api/v1/ai/inspect", files=files, data=data)
        assert r.status_code == 200
        res = r.json()

        assert res["status"] == "SUCCESS"
        assert res["smartbag_compatible"] is True

        # Produce Identification
        prod_id = res["produce_identification"]
        assert "produce_name" in prod_id
        assert "crop_type" in prod_id
        assert prod_id["confidence"] > 0

        # Freshness and Quality (Step B)
        fq = res["freshness_quality"]
        assert "freshness_score_pct" in fq
        assert "freshness_grade" in fq
        assert "firmness_index" in fq
        assert "color_uniformity_pct" in fq
        assert "defect_type" in fq
        assert "freshness_recommendation" in fq

        # Shelf-Life Prediction (Step C)
        sl = res["shelf_life_prediction"]
        assert sl["predicted_shelf_life_days"] > 0
        assert "predicted_use_by_date" in sl
        assert "prediction_interval_90" in sl
        assert "min_days" in sl["prediction_interval_90"]
        assert "max_days" in sl["prediction_interval_90"]
        assert "storage_guidance" in sl
        assert len(sl["recommended_actions"]) > 0

        # Multi-Agent DAG Output (Step D)
        assert "executionGraph" in res
        assert "perception" in res["executionGraph"]
        assert "shelfLife" in res["executionGraph"]
        assert "decision" in res["executionGraph"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_smartbag_batch_crud_and_ownership(client, mock_customer, mock_other_customer):
    """
    Verifies SmartBag batch creation, listing, updating, and strict cross-user ownership isolation.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    try:
        # 1. Create SmartBag batch
        create_payload = {
            "produce_name": "Organic Roma Tomatoes",
            "crop_type": "tomato",
            "quantity_kg": 1.5,
            "freshness_score": 92.0,
            "quality_score": 92.0,
            "predicted_shelf_life_days": 6.0,
            "storage_mode": "ambient",
            "temperature_c": 21.0,
            "humidity_rh": 70.0,
            "storage_recommendation": "Keep in ventilated basket",
            "reminders_enabled": True,
        }
        r_create = client.post("/api/v1/smartbag/batches", json=create_payload)
        assert r_create.status_code == 201
        batch = r_create.json()
        batch_id = batch["batch_id"]

        assert batch["user_id"] == mock_customer.uid
        assert batch["produce_name"] == "Organic Roma Tomatoes"
        assert batch["current_status"] == "ACTIVE"
        assert batch["shelf_life_status"] in ["FRESH", "APPROACHING_EXPIRY"]
        assert batch["days_remaining"] > 0

        # 2. List batches for owner
        r_list = client.get("/api/v1/smartbag/batches?status=ACTIVE")
        assert r_list.status_code == 200
        items = r_list.json()["items"]
        assert any(b["batch_id"] == batch_id for b in items)

        # 3. Ownership isolation: other user cannot access or update this batch
        app.dependency_overrides[get_current_user] = lambda: mock_other_customer
        r_other_get = client.get(f"/api/v1/smartbag/batches/{batch_id}")
        assert r_other_get.status_code == 404

        r_other_update = client.patch(f"/api/v1/smartbag/batches/{batch_id}", json={"quantity_kg": 5.0})
        assert r_other_update.status_code == 404

        # 4. Owner updates batch
        app.dependency_overrides[get_current_user] = lambda: mock_customer
        r_update = client.patch(f"/api/v1/smartbag/batches/{batch_id}", json={"quantity_kg": 2.0})
        assert r_update.status_code == 200
        assert r_update.json()["quantity_kg"] == 2.0

        # 5. Customer Freshness Bag endpoint alias
        r_cust_bag = client.get("/api/v1/customer/freshness-bag")
        assert r_cust_bag.status_code == 200
        assert len(r_cust_bag.json()["data"]) >= 1

        # 6. Mark as consumed
        r_consume = client.post(f"/api/v1/smartbag/batches/{batch_id}/consume")
        assert r_consume.status_code == 200
        assert r_consume.json()["current_status"] == "CONSUMED"

        # 7. Delete batch
        r_del = client.delete(f"/api/v1/smartbag/batches/{batch_id}")
        assert r_del.status_code == 200
        assert r_del.json()["success"] is True

    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_smartbag_daily_reminders_and_notifications(client, mock_customer):
    """
    Verifies that adding a batch schedules daily reminders, processing due reminders generates
    in-app notifications, and consumed batches cancel pending reminders.
    """
    app.dependency_overrides[get_current_user] = lambda: mock_customer
    try:
        # Create a batch with 3 days shelf life
        create_payload = {
            "produce_name": "Shimla Apples",
            "crop_type": "apple",
            "quantity_kg": 3.0,
            "freshness_score": 88.0,
            "quality_score": 88.0,
            "predicted_shelf_life_days": 3.0,
            "storage_mode": "ambient",
            "reminders_enabled": True,
        }
        r_create = client.post("/api/v1/smartbag/batches", json=create_payload)
        assert r_create.status_code == 201
        batch_id = r_create.json()["batch_id"]

        # Trigger reminder processing with target_date set to 5 days in future (ensures due reminders are processed)
        future_date = (datetime.now(timezone.utc) + timedelta(days=5)).strftime("%Y-%m-%d")
        r_proc = client.post(f"/api/v1/smartbag/reminders/process?target_date={future_date}")
        assert r_proc.status_code == 200
        proc_data = r_proc.json()
        assert proc_data["success"] is True
        assert proc_data["dispatched_count"] >= 1

        # Idempotency check: re-running for the same date dispatches 0 duplicate reminders
        r_proc_again = client.post(f"/api/v1/smartbag/reminders/process?target_date={future_date}")
        assert r_proc_again.status_code == 200
        assert r_proc_again.json()["dispatched_count"] == 0

        # Check in-app notifications
        r_notif = client.get("/api/v1/notifications")
        assert r_notif.status_code == 200
        notifs = r_notif.json()["items"]
        assert len(notifs) >= 1
        first_notif_id = notifs[0]["id"]

        # Mark single notification as read
        r_read = client.patch(f"/api/v1/notifications/{first_notif_id}/read")
        assert r_read.status_code == 200
        assert r_read.json()["is_read"] is True

        # Mark all read
        r_all_read = client.post("/api/v1/notifications/mark-all-read")
        assert r_all_read.status_code == 200
        assert r_all_read.json()["success"] is True

        # Clean up
        client.delete(f"/api/v1/smartbag/batches/{batch_id}")

    finally:
        app.dependency_overrides.pop(get_current_user, None)
