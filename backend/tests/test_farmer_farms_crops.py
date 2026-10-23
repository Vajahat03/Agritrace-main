import pytest
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser

@pytest.fixture
def farmer_a():
    return AuthenticatedUser(
        uid="farmer-alpha-111",
        email="alpha@farmer.com",
        role="FARMER",
        full_name="Alpha Kisan",
    )

@pytest.fixture
def farmer_b():
    return AuthenticatedUser(
        uid="farmer-beta-222",
        email="beta@farmer.com",
        role="FARMER",
        full_name="Beta Kisan",
    )

def test_create_farm_success_snake_case(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        payload = {
            "name": "Sahyadri Agro Estate",
            "location_name": "Nashik, Maharashtra",
            "total_area": 15.5,
            "area_unit": "acres",
            "address": "Plot 42, Dindori Road",
            "soil_info": "Deep Black Cotton Soil",
        }
        res = client.post("/api/v1/farmer/farms", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Sahyadri Agro Estate"
        assert data["data"]["location_name"] == "Nashik, Maharashtra"
        assert data["data"]["total_area"] == 15.5
        assert data["data"]["farmer_id"] == "farmer-alpha-111"

        # Verify retrieval via GET /farmer/farms
        get_res = client.get("/api/v1/farmer/farms")
        assert get_res.status_code == 200
        farms = get_res.json()["data"]
        assert any(f["name"] == "Sahyadri Agro Estate" for f in farms)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_create_farm_success_camel_case(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        payload = {
            "name": "Sunrise Organic Farm",
            "locationName": "Pune, Maharashtra",
            "totalArea": 8.0,
            "areaUnit": "acres",
            "address": "Khed Shivapur",
            "soilInfo": "Red Loam",
        }
        res = client.post("/api/v1/farmer/farms", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["name"] == "Sunrise Organic Farm"
        assert data["data"]["location_name"] == "Pune, Maharashtra"
        assert data["data"]["total_area"] == 8.0
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_create_farm_validation_missing_fields(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        # Empty payload
        res = client.post("/api/v1/farmer/farms", json={})
        assert res.status_code == 422
        err_detail = str(res.json()).lower()
        assert "location_name" in err_detail or "locationname" in err_detail
        assert "total_area" in err_detail or "totalarea" in err_detail

        # Missing location_name
        res_loc = client.post("/api/v1/farmer/farms", json={"name": "Test Farm", "total_area": 5.0})
        assert res_loc.status_code == 422
        assert "location_name" in str(res_loc.json()).lower()

        # Missing total_area
        res_area = client.post("/api/v1/farmer/farms", json={"name": "Test Farm", "location_name": "Nashik"})
        assert res_area.status_code == 422
        assert "total_area" in str(res_area.json()).lower()

        # Invalid total_area (<= 0)
        res_zero = client.post("/api/v1/farmer/farms", json={"name": "Test Farm", "location_name": "Nashik", "total_area": 0})
        assert res_zero.status_code == 422
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_create_crop_success_snake_case(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        payload = {
            "crop_type": "Tomato",
            "variety": "Abhinav F1",
            "area": 4.5,
            "area_unit": "acres",
            "planting_date": "2026-03-15",
            "expected_harvest_date": "2026-06-20",
        }
        res = client.post("/api/v1/farmer/crops", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["crop_type"] == "Tomato"
        assert data["data"]["variety"] == "Abhinav F1"
        assert data["data"]["area"] == 4.5
        assert data["data"]["planting_date"] == "2026-03-15"
        assert data["data"]["farmer_id"] == "farmer-alpha-111"

        # Verify retrieval via GET /farmer/crops
        get_res = client.get("/api/v1/farmer/crops")
        assert get_res.status_code == 200
        crops = get_res.json()["data"]
        assert any(c["crop_type"] == "Tomato" and c["variety"] == "Abhinav F1" for c in crops)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_create_crop_success_camel_case(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        payload = {
            "cropType": "Onion",
            "variety": "Nashik Red",
            "area": 2.5,
            "areaUnit": "acres",
            "plantingDate": "2026-04-01",
            "expectedHarvestDate": "2026-08-15",
        }
        res = client.post("/api/v1/farmer/crops", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"]["crop_type"] == "Onion"
        assert data["data"]["variety"] == "Nashik Red"
        assert data["data"]["planting_date"] == "2026-04-01"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_create_crop_validation_missing_fields(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        # Empty payload
        res = client.post("/api/v1/farmer/crops", json={})
        assert res.status_code == 422
        err_detail = str(res.json()).lower()
        assert "crop_type" in err_detail or "croptype" in err_detail
        assert "planting_date" in err_detail or "plantingdate" in err_detail

        # Missing crop_type
        res_crop = client.post("/api/v1/farmer/crops", json={"planting_date": "2026-04-01"})
        assert res_crop.status_code == 422
        assert "crop_type" in str(res_crop.json()).lower()

        # Missing planting_date
        res_date = client.post("/api/v1/farmer/crops", json={"crop_type": "Chili"})
        assert res_date.status_code == 422
        assert "planting_date" in str(res_date.json()).lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_farmer_record_ownership_isolation(client, farmer_a, farmer_b):
    # Farmer A creates a farm and a crop
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        res_farm = client.post("/api/v1/farmer/farms", json={
            "name": "Alpha Secret Farm",
            "location_name": "Satara",
            "total_area": 10.0,
        })
        assert res_farm.status_code == 200

        res_crop = client.post("/api/v1/farmer/crops", json={
            "crop_type": "Sugarcane",
            "variety": "Co 86032",
            "planting_date": "2026-01-10",
        })
        assert res_crop.status_code == 200
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Farmer B queries their farms and crops
    app.dependency_overrides[get_current_user] = lambda: farmer_b
    try:
        b_farms = client.get("/api/v1/farmer/farms").json()["data"]
        assert not any(f["name"] == "Alpha Secret Farm" for f in b_farms)

        b_crops = client.get("/api/v1/farmer/crops").json()["data"]
        assert not any(c["crop_type"] == "Sugarcane" for c in b_crops)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_customer_and_vendor_forbidden_from_farmer_post(client, mock_customer_user, mock_vendor_user):
    farm_payload = {"name": "Unauthorized", "location_name": "Nowhere", "total_area": 1.0}

    # Customer -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: mock_customer_user
    try:
        assert client.post("/api/v1/farmer/farms", json=farm_payload).status_code == 403
        assert client.post("/api/v1/farmer/crops", json={"crop_type": "Tomato", "planting_date": "2026-01-01"}).status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Vendor -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        assert client.post("/api/v1/farmer/farms", json=farm_payload).status_code == 403
        assert client.post("/api/v1/farmer/crops", json={"crop_type": "Tomato", "planting_date": "2026-01-01"}).status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_create_crop_validates_farm_ownership(client, farmer_a, farmer_b):
    # Farmer A creates a farm
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        res_farm = client.post("/api/v1/farmer/farms", json={
            "name": "Alpha Verified Estate",
            "location_name": "Kolhapur",
            "total_area": 5.0,
        })
        assert res_farm.status_code == 200
        farm_a_id = res_farm.json()["data"]["id"]

        # Attempting to use a non-existent farm_id -> 400
        bad_res = client.post("/api/v1/farmer/crops", json={
            "crop_type": "Chili",
            "planting_date": "2026-02-01",
            "farm_id": "non-existent-farm-id",
        })
        assert bad_res.status_code == 400
        assert "INVALID_FARM_OWNERSHIP" in str(bad_res.json())

        # Creating crop with valid owned farm_id -> succeeds and attaches farm data
        ok_res = client.post("/api/v1/farmer/crops", json={
            "crop_type": "Chili",
            "planting_date": "2026-02-01",
            "farm_id": farm_a_id,
        })
        assert ok_res.status_code == 200
        assert ok_res.json()["data"]["farm_id"] == farm_a_id
        assert ok_res.json()["data"]["farm"]["name"] == "Alpha Verified Estate"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Farmer B attempts to attach their crop to Farmer A's farm -> 400
    app.dependency_overrides[get_current_user] = lambda: farmer_b
    try:
        steal_res = client.post("/api/v1/farmer/crops", json={
            "crop_type": "Cotton",
            "planting_date": "2026-03-01",
            "farm_id": farm_a_id,
        })
        assert steal_res.status_code == 400
        assert "INVALID_FARM_OWNERSHIP" in str(steal_res.json())
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_get_crops_status_filtering(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        res_all = client.get("/api/v1/farmer/crops?status=ALL")
        assert res_all.status_code == 200
        assert isinstance(res_all.json()["data"], list)

        res_growing = client.get("/api/v1/farmer/crops?status=GROWING")
        assert res_growing.status_code == 200
        assert isinstance(res_growing.json()["data"], list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_farmer_dashboard_metrics_and_aliases(client, farmer_a):
    app.dependency_overrides[get_current_user] = lambda: farmer_a
    try:
        res = client.get("/api/v1/farmer/dashboard")
        assert res.status_code == 200
        data = res.json()["data"]
        assert "metrics" in data
        assert "totalFarms" in data["metrics"]
        assert "totalActiveCrops" in data["metrics"]
        assert "harvestReadyCrops" in data["metrics"]
        assert "activeBatches" in data["metrics"]
        assert "farms" in data
        assert "crops" in data
        assert "batches" in data
        assert "activeCrops" in data
        assert "recentBatches" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)

