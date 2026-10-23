import pytest
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser
from app.services.memory_store import memory_store

@pytest.fixture
def test_farmer():
    return AuthenticatedUser(
        uid="farmer-fert-test-1",
        email="fert_farmer@agritrace.dev",
        role="FARMER",
        full_name="Fertilizer Test Farmer",
    )

@pytest.fixture
def other_farmer():
    return AuthenticatedUser(
        uid="farmer-fert-test-2",
        email="other_farmer@agritrace.dev",
        role="FARMER",
        full_name="Other Farmer",
    )

@pytest.fixture
def registered_crop(test_farmer):
    crop_data = {
        "id": "crop-fert-101",
        "farmer_id": test_farmer.uid,
        "crop_type": "Organic Tomato",
        "variety": "Roma",
        "area": 3.0,
        "area_unit": "acres",
        "planting_date": "2026-08-01",
        "status": "GROWING",
    }
    memory_store.save_crop(test_farmer.uid, crop_data)
    return crop_data

def test_add_fertilizer_unauthenticated(client, registered_crop):
    """401 Unauthorized when no authentication token is provided."""
    res = client.post(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers", json={
        "fertilizer_name": "Urea",
        "quantity": 25,
        "application_date": "2026-08-10",
    })
    assert res.status_code == 401

def test_add_fertilizer_unauthorized_role(client, mock_customer_user, registered_crop):
    """403 Forbidden when role is not FARMER or ADMIN."""
    app.dependency_overrides[get_current_user] = lambda: mock_customer_user
    try:
        res = client.post(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers", json={
            "fertilizer_name": "Urea",
            "quantity": 25,
            "application_date": "2026-08-10",
        })
        assert res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_add_fertilizer_nonexistent_crop(client, test_farmer):
    """404 Not Found when target crop does not exist."""
    app.dependency_overrides[get_current_user] = lambda: test_farmer
    try:
        res = client.post("/api/v1/farmer/crops/nonexistent-crop-xyz/fertilizers", json={
            "fertilizer_name": "Urea",
            "quantity": 25,
            "application_date": "2026-08-10",
        })
        assert res.status_code == 404
        assert res.json()["error"]["code"] == "NOT_FOUND"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_add_fertilizer_other_farmer_crop(client, other_farmer, registered_crop):
    """404 Not Found when farmer tries to add fertilizer to someone else's crop."""
    app.dependency_overrides[get_current_user] = lambda: other_farmer
    try:
        res = client.post(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers", json={
            "fertilizer_name": "NPK 19:19:19",
            "quantity": 20,
            "application_date": "2026-08-15",
        })
        assert res.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_add_fertilizer_validation_error(client, test_farmer, registered_crop):
    """422 Unprocessable Content for invalid payload (negative quantity, missing date)."""
    app.dependency_overrides[get_current_user] = lambda: test_farmer
    try:
        # Invalid: quantity <= 0
        res = client.post(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers", json={
            "fertilizer_name": "Urea",
            "quantity": -5,
            "application_date": "2026-08-10",
        })
        assert res.status_code == 422

        # Invalid: missing application_date
        res2 = client.post(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers", json={
            "fertilizer_name": "Urea",
            "quantity": 10,
        })
        assert res2.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_fertilizer_crud_lifecycle(client, test_farmer, registered_crop):
    """Complete lifecycle: create, list, inspect single crop, update, delete."""
    app.dependency_overrides[get_current_user] = lambda: test_farmer
    try:
        # 1. Create fertilizer record (using camelCase as sent by frontend FertilizerModal)
        create_payload = {
            "fertilizerName": "NPK 19:19:19 Complex",
            "fertilizerType": "NPK",
            "applicationDate": "2026-08-15",
            "quantity": 25.5,
            "unit": "kg",
            "method": "DRIP",
            "nValue": 19,
            "pValue": 19,
            "kValue": 19,
            "cost": 1450,
            "supplier": "Kisan Agro Seva Kendra",
            "notes": "Applied during vegetative stage via drip line.",
        }
        res_create = client.post(
            f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers",
            json=create_payload,
        )
        assert res_create.status_code == 201
        created = res_create.json()["data"]
        assert created["fertilizer_name"] == "NPK 19:19:19 Complex"
        assert created["quantity"] == 25.5
        assert created["crop_id"] == registered_crop["id"]
        assert created["farmer_id"] == test_farmer.uid
        fert_id = created["id"]

        # 2. List crop fertilizers
        res_list = client.get(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers")
        assert res_list.status_code == 200
        fert_list = res_list.json()["data"]
        assert len(fert_list) == 1
        assert fert_list[0]["id"] == fert_id

        # 3. Get single crop details (includes fertilizerHistory)
        res_crop = client.get(f"/api/v1/farmer/crops/{registered_crop['id']}")
        assert res_crop.status_code == 200
        crop_details = res_crop.json()["data"]
        assert "fertilizerHistory" in crop_details
        assert len(crop_details["fertilizerHistory"]["records"]) == 1
        assert crop_details["fertilizerHistory"]["totalCost"] == 1450
        assert crop_details["fertilizerHistory"]["totalQuantity"] == 25.5

        # 4. Update fertilizer record
        update_payload = {
            "cost": 1500,
            "notes": "Updated dosage notes.",
        }
        res_update = client.patch(
            f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers/{fert_id}",
            json=update_payload,
        )
        assert res_update.status_code == 200
        updated = res_update.json()["data"]
        assert updated["cost"] == 1500
        assert updated["notes"] == "Updated dosage notes."
        assert updated["quantity"] == 25.5  # preserved

        # 5. Delete fertilizer record
        res_del = client.delete(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers/{fert_id}")
        assert res_del.status_code == 200

        # Verify deletion
        res_list_after = client.get(f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers")
        assert res_list_after.status_code == 200
        assert len(res_list_after.json()["data"]) == 0

        # Updating deleted/nonexistent fertilizer -> 404
        res_update_404 = client.patch(
            f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers/{fert_id}",
            json={"cost": 100},
        )
        assert res_update_404.status_code == 404

        # Deleting deleted/nonexistent fertilizer -> 404
        res_del_404 = client.delete(
            f"/api/v1/farmer/crops/{registered_crop['id']}/fertilizers/{fert_id}"
        )
        assert res_del_404.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)
