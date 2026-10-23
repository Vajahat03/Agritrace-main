import os
import sys

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.app import app
from backend.security import AuthStore, get_auth_store


@pytest.fixture
def client(tmp_path):
    store = AuthStore(database_path=":memory:")
    app.dependency_overrides[get_auth_store] = lambda: store
    with TestClient(app) as test_client:
        yield test_client, store
    app.dependency_overrides.clear()


def register(client, *, role="farmer", email="person@example.test", name="Test Person", phone="+919876543210"):
    response = client.post("/auth/register", json={
        "full_name": name,
        "email": email,
        "phone": phone,
        "password": "correct horse battery staple",
        "role": role,
        "workspace_name": f"{name} workspace",
    })
    return response


def test_register_normalizes_identity_hashes_password_and_creates_workspace(client):
    api, store = client
    response = api.post("/auth/register", json={
        "full_name": "Farmer One", "email": "  Farmer@Example.test ",
        "phone": "+91 (98765) 43210", "password": "correct horse battery staple",
        "role": "farmer", "workspace_name": "Farm One",
    })
    assert response.status_code == 201
    payload = response.json()
    assert payload["user"]["email"] == "farmer@example.test"
    assert payload["user"]["role"] == "farmer"
    assert payload["workspace"]["id"] == payload["user"]["workspace_id"]
    assert "password" not in response.text and "password_hash" not in response.text
    assert "agritrace_session" in response.cookies
    with store.connect() as db:
        saved = db.execute("SELECT password_hash,phone FROM users WHERE email=?",
                           ("farmer@example.test",)).fetchone()
        session = db.execute("SELECT token_hash FROM sessions").fetchone()
    assert saved["password_hash"].startswith("scrypt$")
    assert saved["password_hash"] != "correct horse battery staple"
    assert saved["phone"] == "+919876543210"
    assert session["token_hash"] != response.cookies.get("agritrace_session")
    assert len(session["token_hash"]) == 64


def test_file_database_survives_store_recreation(tmp_path):
    path = tmp_path / "persistent.sqlite3"
    first_store = AuthStore(database_path=path)
    user, token = first_store.register(
        full_name="Persistent User", email="persist@example.test", phone="+14155552671",
        password="correct horse battery staple", role="customer", workspace_name="Persisted Workspace",
    )
    reopened_store = AuthStore(database_path=path)
    session_user = reopened_store.authenticate(token)
    assert session_user["user_id"] == user["id"]
    assert session_user["workspace_id"] == user["workspace_id"]


def test_duplicate_registration_and_admin_self_assignment_are_rejected(client):
    api, _ = client
    assert register(api).status_code == 201
    duplicate_email = register(api, email="PERSON@example.test", name="Other Person")
    assert duplicate_email.status_code == 400
    duplicate_phone = api.post("/auth/register", json={
        "full_name": "Other Person", "email": "other@example.test", "phone": "+919876543210",
        "password": "correct horse battery staple", "role": "vendor", "workspace_name": "Other",
    })
    assert duplicate_phone.status_code == 400
    admin_signup = api.post("/auth/register", json={
        "full_name": "Bad Admin", "email": "admin@example.test", "phone": "+14155552671",
        "password": "correct horse battery staple", "role": "admin", "workspace_name": "Admin",
    })
    assert admin_signup.status_code == 400


def test_login_me_logout_and_generic_auth_failures(client):
    api, _ = client
    assert api.get("/auth/me").status_code == 401
    assert register(api).status_code == 201
    api.post("/auth/logout")
    invalid = api.post("/auth/login", json={"email": "unknown@example.test", "password": "wrong"})
    assert invalid.status_code == 401
    invalid_existing = api.post("/auth/login", json={"email": "person@example.test", "password": "wrong"})
    assert invalid_existing.status_code == 401
    assert invalid.json() == invalid_existing.json()
    valid = api.post("/auth/login", json={"email": "PERSON@example.test", "password": "correct horse battery staple"})
    assert valid.status_code == 200
    me = api.get("/auth/me")
    assert me.status_code == 200 and me.json()["user"]["role"] == "farmer"
    assert "password_hash" not in me.text
    api.post("/auth/logout")
    assert api.get("/auth/me").status_code == 401


def test_logout_revokes_only_current_device_session(client):
    api, _ = client
    assert register(api).status_code == 201
    token_one = api.cookies.get("agritrace_session")
    device_two = TestClient(app)
    login = device_two.post("/auth/login", json={"email": "person@example.test", "password": "correct horse battery staple"})
    assert login.status_code == 200
    token_two = device_two.cookies.get("agritrace_session")
    assert token_one != token_two
    api.post("/auth/logout")
    assert api.get("/auth/me").status_code == 401
    assert device_two.get("/auth/me").status_code == 200
    device_two.close()


def test_expired_session_and_untrusted_write_origin_are_rejected(client):
    api, store = client
    assert register(api).status_code == 201
    token = api.cookies.get("agritrace_session")
    from backend.security import _token_digest
    with store.connect() as db:
        db.execute("UPDATE sessions SET expires_at=0 WHERE token_hash=?", (_token_digest(token),))
    assert api.get("/auth/me").status_code == 401
    response = api.post("/auth/login", json={
        "email": "person@example.test", "password": "correct horse battery staple",
    }, headers={"Origin": "https://untrusted.example"})
    assert response.status_code == 403


def test_workspace_and_record_idor_are_blocked_for_read_update_delete(client):
    api_a, _ = client
    a = register(api_a, email="a@example.test", name="Farmer A", phone="+919876543211").json()
    api_b = TestClient(app)
    b_response = register(api_b, email="b@example.test", name="Farmer B", phone="+919876543212")
    assert b_response.status_code == 201
    b = b_response.json()
    farm = api_b.post(f"/api/workspaces/{b['workspace']['id']}/farms", json={"name": "B Farm"})
    assert farm.status_code == 201
    farm_id = farm.json()["id"]
    assert api_a.get(f"/api/workspaces/{b['workspace']['id']}/farms").status_code == 403
    assert api_a.post(f"/api/workspaces/{b['workspace']['id']}/farms", json={"name": "Forged"}).status_code == 403
    assert api_a.get(f"/api/farms/{farm_id}").status_code == 404
    assert api_a.patch(f"/api/farms/{farm_id}", json={"name": "Hijacked"}).status_code == 404
    assert api_a.delete(f"/api/farms/{farm_id}").status_code == 404
    assert api_b.patch(f"/api/farms/{farm_id}", json={"name": "B Farm Updated"}).json()["name"] == "B Farm Updated"
    assert api_b.get(f"/api/farms/{farm_id}").status_code == 200
    assert api_b.delete(f"/api/farms/{farm_id}").status_code == 204
    forged_owner = api_b.post(f"/api/workspaces/{b['workspace']['id']}/farms",
                              json={"name": "Forged owner", "owner_user_id": a["user"]["id"]})
    assert forged_owner.status_code == 422
    api_b.close()


def test_role_checks_and_admin_access(client):
    api_farmer, store = client
    farmer = register(api_farmer, email="farmer@example.test", name="Farmer", phone="+919876543213").json()
    api_vendor = TestClient(app)
    vendor = register(api_vendor, role="vendor", email="vendor@example.test", name="Vendor", phone="+919876543214").json()
    assert api_vendor.post(f"/api/workspaces/{vendor['workspace']['id']}/farms", json={"name": "No farm"}).status_code == 403
    assert api_vendor.get(f"/api/workspaces/{farmer['workspace']['id']}/farms").status_code == 403
    assert api_farmer.get("/api/batches").status_code == 403

    with store.connect() as db:
        db.execute("UPDATE users SET role='admin' WHERE id=?", (vendor["user"]["id"],))
        db.execute("UPDATE workspace_members SET role='admin' WHERE user_id=?", (vendor["user"]["id"],))
    assert api_vendor.get(f"/api/workspaces/{farmer['workspace']['id']}/farms").status_code == 200
    assert api_vendor.get("/api/batches").status_code == 200
    api_vendor.close()


def test_legacy_private_route_requires_authentication(client):
    api, _ = client
    assert api.get("/api/batches").status_code == 401
    assert api.post("/api/agents/run").status_code in {401, 422}

