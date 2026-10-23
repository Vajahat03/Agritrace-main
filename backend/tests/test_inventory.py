from app.main import app
from app.core.security import get_current_user

def test_vendor_inventory_authorization(client, mock_vendor_user, mock_farmer_user):
    # Unauthenticated -> 401
    assert client.get("/api/v1/vendor/inventory").status_code == 401

    # Farmer role -> 403
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        assert client.get("/api/v1/vendor/inventory").status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    # Vendor role -> 200
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        response = client.get("/api/v1/vendor/inventory")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert isinstance(data["data"], list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_vendor_inventory_adjust(client, mock_vendor_user):
    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        payload = {
            "adjustmentType": "DAMAGE",
            "quantityChange": -10.0,
            "reason": "Bruised produce discarded during sorting",
        }
        response = client.post("/api/v1/vendor/inventory/inv-123/adjust", json=payload)
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "data" in data
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_farmer_batches_and_crops(client, mock_farmer_user):
    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user
    try:
        batches_res = client.get("/api/v1/farmer/batches")
        assert batches_res.status_code == 200
        assert isinstance(batches_res.json()["data"], list)

        crops_res = client.get("/api/v1/farmer/crops")
        assert crops_res.status_code == 200
        assert isinstance(crops_res.json()["data"], list)

        farms_res = client.get("/api/v1/farmer/farms")
        assert farms_res.status_code == 200
        assert isinstance(farms_res.json()["data"], list)
    finally:
        app.dependency_overrides.pop(get_current_user, None)
