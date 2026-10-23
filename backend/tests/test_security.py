from unittest.mock import patch
from firebase_admin import auth as firebase_auth
from app.core.exceptions import AgriTraceAPIException
from app.core.firebase import verify_firebase_id_token

def test_missing_auth_header_returns_401(client):
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "Missing" in data["error"]["message"]

def test_malformed_auth_header_returns_401(client):
    response = client.get("/api/v1/auth/me", headers={"Authorization": "Token invalidformat"})
    assert response.status_code == 401
    data = response.json()
    assert data["success"] is False
    assert data["error"]["code"] == "UNAUTHORIZED"
    assert "Malformed" in data["error"]["message"]

def test_invalid_firebase_token_rejected(client):
    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = firebase_auth.InvalidIdTokenError("Invalid token signature")
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer invalid_token_123"})
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_TOKEN"

def test_expired_firebase_token_rejected(client):
    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.side_effect = firebase_auth.ExpiredIdTokenError("Token expired", None)
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer expired_token_123"})
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "TOKEN_EXPIRED"

def test_audience_mismatch_rejected(client):
    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {
            "uid": "user-123",
            "aud": "wrong-project-id",
            "email": "user@test.dev",
        }
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer wrong_project_token"})
        assert response.status_code == 401
        data = response.json()
        assert data["success"] is False
        assert data["error"]["code"] == "INVALID_AUDIENCE"

def test_role_resolved_from_user_repository_when_no_token_role(client):
    import asyncio
    from app.repositories.user_repository import user_repository

    # Pre-save user in user_repository as VENDOR without role in token
    asyncio.run(
        user_repository.save_profile("repo-vendor-999", {
            "email": "vendor999@agritrace.dev",
            "full_name": "Stored Vendor",
            "role": "VENDOR",
            "onboarding_completed": True,
        })
    )

    with patch("firebase_admin.auth.verify_id_token") as mock_verify:
        mock_verify.return_value = {
            "uid": "repo-vendor-999",
            "sub": "repo-vendor-999",
            "aud": "agritrace-ab141",
            "email": "vendor999@agritrace.dev",
            # No 'role' claim here
        }
        response = client.get("/api/v1/auth/me", headers={"Authorization": "Bearer valid_vendor_token"})
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["role"] == "VENDOR"

def test_admin_can_access_admin_dashboard(client):
    from app.main import app
    from app.core.security import get_current_user, AuthenticatedUser

    admin_user = AuthenticatedUser(
        uid="admin-001",
        email="admin@agritrace.dev",
        role="ADMIN",
        full_name="Platform Admin",
    )
    app.dependency_overrides[get_current_user] = lambda: admin_user
    try:
        res = client.get("/api/v1/admin/dashboard")
        assert res.status_code == 200
        assert res.json()["success"] is True
        assert "metrics" in res.json()["data"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

def test_customer_and_vendor_forbidden_from_admin_dashboard(client, mock_customer_user, mock_vendor_user):
    from app.main import app
    from app.core.security import get_current_user

    app.dependency_overrides[get_current_user] = lambda: mock_customer_user
    try:
        res = client.get("/api/v1/admin/dashboard")
        assert res.status_code == 403
        assert "Access denied" in res.json()["error"]["message"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    app.dependency_overrides[get_current_user] = lambda: mock_vendor_user
    try:
        res = client.get("/api/v1/admin/dashboard")
        assert res.status_code == 403
        assert "Access denied" in res.json()["error"]["message"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

