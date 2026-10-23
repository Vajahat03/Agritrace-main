import pytest
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser
from app.services.memory_store import memory_store

@pytest.fixture(autouse=True)
def clean_memory_store():
    # Store clean state for isolation
    yield

def test_unauthenticated_onboarding_returns_401(client):
    response = client.post("/api/v1/auth/onboarding", json={"role": "FARMER"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "UNAUTHORIZED"

def test_new_user_me_returns_onboarding_not_completed(client):
    new_user = AuthenticatedUser(
        uid="google-new-user-1",
        email="newgoogle@test.dev",
        role="CUSTOMER",
        full_name="Google Newcomer",
    )
    app.dependency_overrides[get_current_user] = lambda: new_user
    try:
        response = client.get("/api/v1/auth/me")
        assert response.status_code == 200
        data = response.json()["data"]
        assert data["id"] == "google-new-user-1"
        assert data["onboarding_completed"] is False
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_farmer_succeeds_and_authorizes_batches(client):
    user = AuthenticatedUser(
        uid="google-farmer-99",
        email="ramesh.google@test.dev",
        role="CUSTOMER",
        full_name="Ramesh Google",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # 1. Submit role selection during onboarding
        payload = {
            "role": "FARMER",
            "fullName": "Ramesh Google (Farmer)",
            "phone": "+91 98220 33445",
            "address": "Nashik Agro Cluster",
        }
        res = client.post("/api/v1/auth/onboarding", json=payload)
        assert res.status_code == 200
        data = res.json()["data"]
        assert data["role"] == "FARMER"
        assert data["onboarding_completed"] is True
        assert data["full_name"] == "Ramesh Google (Farmer)"

        # 2. Verify /auth/me now reflects completed FARMER role
        me_res = client.get("/api/v1/auth/me")
        assert me_res.status_code == 200
        assert me_res.json()["data"]["role"] == "FARMER"
        assert me_res.json()["data"]["onboarding_completed"] is True

        # 3. Simulate subsequent requests where get_current_user derives FARMER role
        user.role = "FARMER"
        batches_res = client.get("/api/v1/farmer/batches")
        assert batches_res.status_code == 200
        assert isinstance(batches_res.json()["data"], list)

        # 4. Attempting to access vendor inventory is forbidden
        vendor_res = client.get("/api/v1/vendor/inventory")
        assert vendor_res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_vendor_succeeds_and_authorizes_inventory(client):
    user = AuthenticatedUser(
        uid="google-vendor-88",
        email="vendor.google@test.dev",
        role="CUSTOMER",
        full_name="Suresh Vendor",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        payload = {
            "role": "VENDOR",
            "fullName": "Suresh Wholesale",
            "phone": "+91 99112 44556",
            "address": "APMC Market Yard",
        }
        res = client.post("/api/v1/auth/onboarding", json=payload)
        assert res.status_code == 200
        assert res.json()["data"]["role"] == "VENDOR"
        assert res.json()["data"]["onboarding_completed"] is True

        user.role = "VENDOR"
        inv_res = client.get("/api/v1/vendor/inventory")
        assert inv_res.status_code == 200
        assert isinstance(inv_res.json()["data"], list)

        # Accessing farmer dashboard is forbidden
        farmer_res = client.get("/api/v1/farmer/dashboard")
        assert farmer_res.status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_customer_denied_farmer_endpoints(client):
    user = AuthenticatedUser(
        uid="google-consumer-77",
        email="consumer.google@test.dev",
        role="CUSTOMER",
        full_name="Anita Consumer",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.post("/api/v1/auth/onboarding", json={"role": "CUSTOMER"})
        assert res.status_code == 200
        assert res.json()["data"]["role"] == "CUSTOMER"

        user.role = "CUSTOMER"
        cust_res = client.get("/api/v1/customer/dashboard")
        assert cust_res.status_code == 200

        # Denied from farmer and vendor endpoints
        assert client.get("/api/v1/farmer/batches").status_code == 403
        assert client.get("/api/v1/vendor/inventory").status_code == 403
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_rejects_admin_role_escalation(client):
    user = AuthenticatedUser(
        uid="malicious-user-1",
        email="hacker@test.dev",
        role="CUSTOMER",
        full_name="Script Kiddie",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.post("/api/v1/auth/onboarding", json={"role": "ADMIN"})
        assert res.status_code == 400
        data = res.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_ROLE"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_rejects_invalid_role(client):
    user = AuthenticatedUser(
        uid="invalid-role-user",
        email="invalid@test.dev",
        role="CUSTOMER",
        full_name="Invalid Role User",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        res = client.post("/api/v1/auth/onboarding", json={"role": "SUPER_ADMIN"})
        assert res.status_code == 400
        assert res.json()["error"]["code"] == "INVALID_ROLE"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_is_idempotent_for_same_role(client):
    user = AuthenticatedUser(
        uid="idempotent-farmer-1",
        email="idempotent@test.dev",
        role="CUSTOMER",
        full_name="Farmer Idempotent",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # First call
        res1 = client.post("/api/v1/auth/onboarding", json={"role": "FARMER", "fullName": "Farmer Idempotent"})
        assert res1.status_code == 200

        # Duplicate second call
        res2 = client.post("/api/v1/auth/onboarding", json={"role": "FARMER", "fullName": "Farmer Idempotent"})
        assert res2.status_code == 200
        assert res2.json()["data"]["role"] == "FARMER"
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_onboarding_prevents_conflicting_role_overwrite(client):
    user = AuthenticatedUser(
        uid="conflict-user-1",
        email="conflict@test.dev",
        role="CUSTOMER",
        full_name="Conflict User",
    )
    app.dependency_overrides[get_current_user] = lambda: user
    try:
        # Initially onboards as FARMER
        res1 = client.post("/api/v1/auth/onboarding", json={"role": "FARMER"})
        assert res1.status_code == 200

        # Attempt to overwrite with VENDOR
        res2 = client.post("/api/v1/auth/onboarding", json={"role": "VENDOR"})
        assert res2.status_code == 409
        assert res2.json()["error"]["code"] == "ROLE_ALREADY_ASSIGNED"

        # Stored role remains FARMER
        stored = memory_store.get_profile("conflict-user-1")
        assert stored["role"] == "FARMER"
    finally:
        app.dependency_overrides.pop(get_current_user, None)
