from app.main import app
from app.core.security import get_current_user

def test_get_me_returns_profile(client, mock_farmer_user):
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["id"] == mock_farmer_user.uid
        assert data["data"]["role"] == "FARMER"
        assert data["data"]["full_name"] == "Ramesh Patil (Kisan)"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_patch_profile_updates_fields(client, mock_farmer_user):
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        payload = {
            "fullName": "Updated Farmer Name",
            "phone": "+91 98230 11223",
            "address": "Dindori Road, Nashik",
            "languagePreference": "mr",
        }
        response = client.patch("/api/v1/auth/profile", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["full_name"] == "Updated Farmer Name"
        assert data["data"]["phone"] == "+91 98230 11223"
        assert data["data"]["address"] == "Dindori Road, Nashik"
        assert data["data"]["language_preference"] == "mr"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_sync_profile_bootstraps_user(client, mock_vendor_user):
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        payload = {
            "fullName": "FreshDirect Wholesale Vendor",
            "role": "VENDOR",
            "phone": "+91 99341 55667",
            "address": "Vashi APMC, Navi Mumbai",
        }
        response = client.post("/api/v1/auth/sync-profile", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["full_name"] == "FreshDirect Wholesale Vendor"
        assert data["data"]["role"] == "VENDOR"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
