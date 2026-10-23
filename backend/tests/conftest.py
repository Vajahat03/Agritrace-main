import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser

from app.services.memory_store import memory_store
from app.core.config import settings

@pytest.fixture(autouse=True)
def isolate_store(monkeypatch):
    monkeypatch.setattr(settings, "ALLOW_STORE_FALLBACK", True)
    memory_store.reset_for_tests()
    memory_store._seed_defaults()
    yield

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def mock_farmer_user():
    return AuthenticatedUser(
        uid="test-farmer-uid-101",
        email="farmer@agritrace.dev",
        role="FARMER",
        full_name="Ramesh Patil (Kisan)",
    )

@pytest.fixture
def mock_vendor_user():
    return AuthenticatedUser(
        uid="test-vendor-uid-202",
        email="vendor@agritrace.dev",
        role="VENDOR",
        full_name="FreshDirect Vendor",
    )

@pytest.fixture
def mock_customer_user():
    return AuthenticatedUser(
        uid="test-customer-uid-303",
        email="customer@agritrace.dev",
        role="CUSTOMER",
        full_name="Priya Sharma",
    )
