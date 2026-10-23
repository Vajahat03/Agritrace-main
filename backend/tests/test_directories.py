import pytest
from app.main import app
from app.core.security import get_current_user
from app.services.memory_store import memory_store

def test_empty_directories_return_empty_lists(client, mock_vendor_user, mock_farmer_user):
    """When no users are registered, directories must return empty lists, not fabricated items."""
    # Vendor checking farmers directory
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        res = client.get("/api/v1/vendor/farmers")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"] == []
        assert data["meta"]["total"] == 0
        assert data["meta"]["page"] == 1
        assert data["meta"]["page_size"] == 12
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Farmer checking vendors directory
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        res = client.get("/api/v1/farmer/vendors")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["data"] == []
        assert data["meta"]["total"] == 0
        assert data["meta"]["page"] == 1
        assert data["meta"]["page_size"] == 12
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_vendor_farmers_authorization(client, mock_farmer_user, mock_customer_user, mock_vendor_user):
    # Unauthenticated -> 401
    res_unauth = client.get("/api/v1/vendor/farmers")
    assert res_unauth.status_code == 401

    # Farmer calling vendor/farmers -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        response = client.get("/api/v1/vendor/farmers")
        assert response.status_code == 403
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "FORBIDDEN"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Customer calling vendor/farmers -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: mock_customer_user
    try:
        response = client.get("/api/v1/vendor/farmers")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Vendor calling vendor/farmers -> 200 OK
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        response = client.get("/api/v1/vendor/farmers")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_farmer_vendors_authorization(client, mock_farmer_user, mock_customer_user, mock_vendor_user):
    # Unauthenticated -> 401
    res_unauth = client.get("/api/v1/farmer/vendors")
    assert res_unauth.status_code == 401

    # Customer calling farmer/vendors -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: mock_customer_user
    try:
        response = client.get("/api/v1/farmer/vendors")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Vendor calling farmer/vendors -> 403 Forbidden
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        response = client.get("/api/v1/farmer/vendors")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Farmer calling farmer/vendors -> 200 OK
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        response = client.get("/api/v1/farmer/vendors")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_public_customer_directories(client):
    res_farmers = client.get("/api/v1/customer/farmers")
    assert res_farmers.status_code == 200
    assert isinstance(res_farmers.json()["data"], list)

    res_vendors = client.get("/api/v1/customer/vendors")
    assert res_vendors.status_code == 200
    assert isinstance(res_vendors.json()["data"], list)

def test_farmers_directory_with_registered_farmer(client, mock_vendor_user):
    # Register genuine test farmer profile in store
    farmer_uid = "genuine-farmer-test-1"
    memory_store.save_profile(farmer_uid, {
        "uid": farmer_uid,
        "full_name": "Suresh Kisan",
        "email": "suresh@kisan.dev",
        "role": "FARMER",
        "phone": "+91 98765 43210",
        "address": "Dindori Road, Nashik",
    })
    memory_store.save_farm(farmer_uid, {
        "id": "farm-1",
        "farmer_id": farmer_uid,
        "name": "Suresh Organic Estate",
        "location_name": "Nashik Valley",
        "total_area": 5.5,
        "area_unit": "acres"
    })
    memory_store.save_crop(farmer_uid, {
        "id": "crop-1",
        "farmer_id": farmer_uid,
        "crop_type": "Organic Tomatoes",
        "variety": "Cherry Red",
        "area": 2.0,
        "area_unit": "acres",
        "status": "GROWING"
    })

    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        # 1. Fetch directory
        res = client.get("/api/v1/vendor/farmers")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["meta"]["total"] == 1
        assert len(data["data"]) == 1
        f = data["data"][0]
        assert f["full_name"] == "Suresh Kisan"
        assert f["farm_name"] == "Suresh Organic Estate"
        assert "Organic Tomatoes" in f["crops_grown"]

        # 2. Search match
        res_search = client.get("/api/v1/vendor/farmers?search=Suresh")
        assert res_search.status_code == 200
        assert len(res_search.json()["data"]) == 1

        # 3. Search non-matching
        res_none = client.get("/api/v1/vendor/farmers?search=NonExistentQueryXYZ")
        assert res_none.status_code == 200
        assert len(res_none.json()["data"]) == 0
        assert res_none.json()["meta"]["total"] == 0

        # 4. Filter by crop
        res_crop = client.get("/api/v1/vendor/farmers?crop=Organic%20Tomatoes")
        assert res_crop.status_code == 200
        assert len(res_crop.json()["data"]) == 1

        # 5. Filter by non-matching crop
        res_bad_crop = client.get("/api/v1/vendor/farmers?crop=Pineapple")
        assert res_bad_crop.status_code == 200
        assert len(res_bad_crop.json()["data"]) == 0

        # 6. Pagination
        res_page = client.get("/api/v1/vendor/farmers?page=1&page_size=1")
        assert res_page.status_code == 200
        assert len(res_page.json()["data"]) == 1

        # 7. Details endpoint
        res_det = client.get(f"/api/v1/vendor/farmers/{farmer_uid}")
        assert res_det.status_code == 200
        det_data = res_det.json()["data"]
        assert det_data["id"] == farmer_uid
        assert len(det_data["farms"]) == 1
        assert len(det_data["crops"]) == 1

        # 8. 404 for unknown farmer
        res_404 = client.get("/api/v1/vendor/farmers/unknown-farmer-id-999")
        assert res_404.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_missing_optional_profile_fields(client, mock_vendor_user):
    """Farmers with missing optional fields (no phone, no farms, no crops) do not crash queries."""
    minimal_farmer_uid = "minimal-farmer-test-2"
    memory_store.save_profile(minimal_farmer_uid, {
        "uid": minimal_farmer_uid,
        "full_name": "Minimal Farmer",
        "email": "minimal@farmer.dev",
        "role": "FARMER",
        # no phone, no address
    })

    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        res = client.get("/api/v1/vendor/farmers")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        matching = [f for f in data["data"] if f["id"] == minimal_farmer_uid]
        assert len(matching) == 1
        farmer = matching[0]
        assert farmer["full_name"] == "Minimal Farmer"
        assert farmer["phone"] is None
        assert farmer["crops_grown"] == []
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_vendors_directory_with_registered_vendor(client, mock_farmer_user):
    # Register genuine test vendor
    vendor_uid = "genuine-vendor-test-1"
    memory_store.save_profile(vendor_uid, {
        "uid": vendor_uid,
        "full_name": "Vikas Agarwal",
        "business_name": "Agarwal Agro Traders",
        "email": "vikas@agarwal.dev",
        "role": "VENDOR",
        "phone": "+91 91234 56789",
        "address": "APMC Yard Market, Pune",
        "business_type": "Wholesaler",
        "product_interests": ["Wheat", "Rice"],
    })

    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        # 1. Fetch directory
        res = client.get("/api/v1/farmer/vendors")
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["meta"]["total"] == 1
        v = data["data"][0]
        assert v["business_name"] == "Agarwal Agro Traders"
        assert v["business_type"] == "Wholesaler"

        # 2. Search match
        res_search = client.get("/api/v1/farmer/vendors?search=Agarwal")
        assert res_search.status_code == 200
        assert len(res_search.json()["data"]) == 1

        # 3. Filter by business type
        res_type = client.get("/api/v1/farmer/vendors?business_type=Wholesaler")
        assert res_type.status_code == 200
        assert len(res_type.json()["data"]) == 1

        # 4. Search non-match
        res_empty = client.get("/api/v1/farmer/vendors?search=NonExistentVendorQueryXYZ")
        assert res_empty.status_code == 200
        assert res_empty.json()["data"] == []
        assert res_empty.json()["meta"]["total"] == 0

        # 5. Details endpoint
        res_det = client.get(f"/api/v1/farmer/vendors/{vendor_uid}")
        assert res_det.status_code == 200
        assert res_det.json()["data"]["id"] == vendor_uid

        # 6. Unknown vendor -> 404
        res_404 = client.get("/api/v1/farmer/vendors/unknown-vendor-id-999")
        assert res_404.status_code == 404
    finally:
        app.dependency_overrides.pop(get_current_user, None)
