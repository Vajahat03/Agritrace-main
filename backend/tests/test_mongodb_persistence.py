import pytest
import mongomock
from unittest.mock import patch, AsyncMock
from app.db.mongodb import MongoDBManager, sanitize_mongodb_uri
from app.repositories.user_repository import UserRepository
from app.repositories.farmer_repository import FarmerRepository
from app.repositories.vendor_repository import VendorRepository
from app.db.migration import migrate_legacy_store_to_mongodb
from app.db.indexes import ensure_indexes
from app.main import app
from app.core.security import get_current_user, AuthenticatedUser

def test_sanitize_mongodb_uri():
    raw_uri = "mongodb+srv://agri_admin:SuperSecretPass123!@cluster0.mongodb.net/agritrace?retryWrites=true"
    sanitized = sanitize_mongodb_uri(raw_uri)
    assert "SuperSecretPass123!" not in sanitized
    assert "agri_admin:***@" in sanitized

    empty_uri = sanitize_mongodb_uri("")
    assert empty_uri == ""

@pytest.mark.anyio
async def test_mongodb_connection_lifecycle_no_uri():
    manager = MongoDBManager()
    with patch("app.core.config.settings.MONGODB_URI", ""):
        connected = await manager.connect()
        assert connected is False
        assert manager.is_connected() is False
        is_healthy, msg = await manager.ping()
        assert is_healthy is False
        assert "not configured" in msg or "disconnected" in msg

@pytest.mark.anyio
async def test_user_repository_with_mongodb():
    mock_db = mongomock.MongoClient().db
    # Wrap with AsyncMock-compatible interface for tests
    repo = UserRepository()

    # Test profile save
    profile_data = {
        "email": "test.farmer@agritrace.dev",
        "full_name": "Test Farmer",
        "role": "FARMER",
        "phone": "+91 98000 11111",
        "onboarding_completed": True,
    }
    saved = await repo.save_profile("uid-mongo-1", profile_data)
    assert saved["id"] == "uid-mongo-1"
    assert saved["role"] == "FARMER"

    # Test profile retrieval
    retrieved = await repo.get_by_uid("uid-mongo-1")
    assert retrieved is not None
    assert retrieved["full_name"] == "Test Farmer"
    assert retrieved["role"] == "FARMER"

@pytest.mark.anyio
async def test_farmer_repository_ownership_isolation():
    repo = FarmerRepository()

    # Farmer A creates a farm and a batch
    farm_a = await repo.create_farm("farmer-a", {"name": "Plot A", "location_name": "Nashik", "total_area": 5.0})
    batch_a = await repo.create_batch("farmer-a", {
        "batch_code": "BAT-TEST-001",
        "crop_type": "Tomato",
        "variety": "Roma",
        "initial_quantity": 250.0,
        "harvest_date": "2026-10-10",
    })

    # Farmer B creates a farm
    farm_b = await repo.create_farm("farmer-b", {"name": "Plot B", "location_name": "Pune", "total_area": 10.0})

    # Verify Farmer A only sees their own farms and batches
    farms_a = await repo.get_farms("farmer-a")
    assert any(f["id"] == farm_a["id"] for f in farms_a)
    assert not any(f["id"] == farm_b["id"] for f in farms_a)

    batches_a = await repo.get_batches("farmer-a")
    assert any(b["batch_code"] == "BAT-TEST-001" for b in batches_a)

    # Verify Farmer B sees zero batches
    batches_b = await repo.get_batches("farmer-b")
    assert not any(b["batch_code"] == "BAT-TEST-001" for b in batches_b)

    # Public traceability lookup
    public_lookup = await repo.get_batch_by_code("BAT-TEST-001")
    assert public_lookup is not None
    assert public_lookup["crop_type"] == "Tomato"
    assert public_lookup["farmer_id"] == "farmer-a"

@pytest.mark.anyio
async def test_vendor_repository_ownership_isolation_and_adjustment():
    repo = VendorRepository()

    # Vendor 1 adds stock item
    item_v1 = await repo.add_inventory_item("vendor-1", {
        "id": "inv-v1-001",
        "product_name": "Premium Wheat",
        "crop_type": "Wheat",
        "quantity": 100.0,
        "unit": "quintal",
    })
    assert item_v1["id"] == "inv-v1-001"

    # Vendor 2 cannot access Vendor 1's items in their inventory listing
    v2_inventory = await repo.get_inventory("vendor-2")
    assert not any(item["id"] == "inv-v1-001" for item in v2_inventory)

    # Vendor 1 adjusts their stock item
    adjusted = await repo.adjust_inventory(
        vendor_id="vendor-1",
        item_id="inv-v1-001",
        adjustment_type="DAMAGE",
        quantity_change=-15.0,
        reason="Water leakage in Silo B",
    )
    assert adjusted is not None
    assert adjusted["quantity"] == 85.0

@pytest.mark.anyio
async def test_migration_utility_idempotency():
    # Create temporary legacy store JSON in local tests directory
    from pathlib import Path
    import json

    legacy_file = Path(__file__).parent / "_test_store.json"
    legacy_data = {
        "profiles": {
            "mig-user-1": {
                "email": "migrated@agritrace.dev",
                "full_name": "Migrated Farmer",
                "role": "FARMER",
                "onboarding_completed": True,
            }
        },
        "vendor_inventories": {
            "mig-vendor-1": [
                {"id": "mig-inv-1", "product_name": "Onions", "quantity": 50.0}
            ]
        },
        "farmer_crops": {},
        "farmer_batches": {
            "mig-user-1": [
                {"id": "mig-batch-1", "batch_code": "BAT-MIG-01", "crop_type": "Wheat", "initial_quantity": 100}
            ]
        },
        "farmer_farms": {}
    }

    try:
        with open(legacy_file, "w", encoding="utf-8") as f:
            json.dump(legacy_data, f)

        # When MongoDB is disconnected, migration returns clean status
        result = await migrate_legacy_store_to_mongodb(None, str(legacy_file))
        assert result["migrated"] is False
        assert "not connected" in result["reason"]
    finally:
        legacy_file.unlink(missing_ok=True)

def test_traceability_public_endpoint(client):
    # Test 404 for nonexistent batch
    r_not_found = client.get("/api/v1/customer/batches/BAT-NONEXISTENT-999")
    assert r_not_found.status_code == 404
    assert r_not_found.json()["error"]["code"] == "NOT_FOUND"

@pytest.mark.anyio
async def test_mongodb_ping_regression_boolean_safety():
    """
    Regression test verifying that MongoDBManager.ping() works with database objects
    whose __bool__ raises NotImplementedError (exact PyMongo Database behavior).
    """
    from app.db.mongodb import MongoDBManager

    class StrictPyMongoDatabaseMock:
        def __bool__(self):
            raise NotImplementedError("A Database cannot be used in a boolean context. Did you mean to use is not None?")

        async def command(self, cmd):
            if cmd == "ping":
                return {"ok": 1.0}
            raise ValueError(f"Unknown command {cmd}")

    mgr = MongoDBManager()
    mgr._connected = True
    mgr.db = StrictPyMongoDatabaseMock()

    # Must succeed without throwing NotImplementedError
    is_healthy, msg = await mgr.ping()
    assert is_healthy is True
    assert "active and responsive" in msg

@pytest.mark.anyio
async def test_mongodb_ping_genuine_failure_reported():
    """
    Verifies that a genuine command failure during ping is caught and reported as unhealthy.
    """
    from app.db.mongodb import MongoDBManager

    class FailingDatabaseMock:
        def __bool__(self):
            raise NotImplementedError("A Database cannot be used in a boolean context.")

        async def command(self, cmd):
            raise RuntimeError("Cluster communication lost")

    mgr = MongoDBManager()
    mgr._connected = True
    mgr.db = FailingDatabaseMock()

    is_healthy, msg = await mgr.ping()
    assert is_healthy is False
    assert msg == "Database ping failed"
    assert mgr.is_connected() is False

@pytest.mark.anyio
async def test_mongodb_ping_disconnected_or_none():
    from app.db.mongodb import MongoDBManager

    mgr = MongoDBManager()
    mgr._connected = False
    mgr.db = None
    is_healthy, msg = await mgr.ping()
    assert is_healthy is False
    assert "disconnected" in msg.lower()

@pytest.mark.anyio
async def test_atlas_mode_unavailability_rejects_writes_and_reads(monkeypatch, client, mock_farmer_user):
    """
    When Atlas is configured as authoritative (PERSISTENCE_MODE='mongodb' and ALLOW_STORE_FALLBACK=False),
    unavailability MUST NOT silently succeed via store.json or memory.
    It must fail-fast with HTTP 503 DATABASE_UNAVAILABLE.
    """
    from app.core.config import settings
    from app.db.mongodb import mongodb
    from app.services.memory_store import memory_store

    # Ensure MongoDB is disconnected and fallback is forbidden
    monkeypatch.setattr(mongodb, "_connected", False)
    monkeypatch.setattr(mongodb, "db", None)
    monkeypatch.setattr(settings, "PERSISTENCE_MODE", "mongodb")
    monkeypatch.setattr(settings, "ALLOW_STORE_FALLBACK", False)

    app.dependency_overrides[get_current_user] = lambda: mock_farmer_user

    try:
        # 1. Attempt to create farm -> must return 503
        r_farm = client.post("/api/v1/farmer/farms", json={
            "name": "Atlas Test Farm",
            "location_name": "Nashik",
            "total_area": 10.0,
        })
        assert r_farm.status_code == 503
        assert r_farm.json()["error"]["code"] == "DATABASE_UNAVAILABLE"

        # Verify nothing was written to memory_store
        assert len(memory_store.get_farmer_farms(mock_farmer_user.uid)) == 0

        # 2. Attempt to create crop -> must return 503
        r_crop = client.post("/api/v1/farmer/crops", json={
            "crop_type": "Wheat",
            "planting_date": "2026-10-01",
            "area": 5.0,
        })
        assert r_crop.status_code == 503
        assert r_crop.json()["error"]["code"] == "DATABASE_UNAVAILABLE"

        # 3. Attempt to add fertilizer -> must return 503
        r_fert = client.post("/api/v1/farmer/crops/crop-any/fertilizers", json={
            "fertilizer_name": "Urea",
            "application_date": "2026-10-10",
            "quantity": 50.0,
        })
        assert r_fert.status_code == 503
        assert r_fert.json()["error"]["code"] == "DATABASE_UNAVAILABLE"

        # 4. Attempt to query directory -> must return 503
        r_dir = client.get("/api/v1/farmer/vendors")
        assert r_dir.status_code == 503
        assert r_dir.json()["error"]["code"] == "DATABASE_UNAVAILABLE"

    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.anyio
async def test_atlas_mode_operation_exception_rejects_and_aborts(monkeypatch, mock_farmer_user):
    """
    Verifies that if an active MongoDB connection throws an operation error during write,
    the operation fails with 503 and does NOT write to local memory_store.
    """
    from app.core.config import settings
    from app.db.mongodb import mongodb
    from app.repositories.farmer_repository import FarmerRepository
    from app.core.exceptions import AgriTraceAPIException
    from app.services.memory_store import memory_store

    repo = FarmerRepository()

    class ExplodingCollection:
        async def insert_one(self, doc):
            raise RuntimeError("Primary node stepdown / Write conflict")

    class ExplodingDatabase:
        def __getitem__(self, key):
            return ExplodingCollection()

    monkeypatch.setattr(mongodb, "_connected", True)
    monkeypatch.setattr(mongodb, "db", ExplodingDatabase())
    monkeypatch.setattr(settings, "PERSISTENCE_MODE", "mongodb")
    monkeypatch.setattr(settings, "ALLOW_STORE_FALLBACK", False)

    with pytest.raises(AgriTraceAPIException) as exc_info:
        await repo.create_farm("farmer-fail-test", {"name": "Fail Plot", "location_name": "Pune", "total_area": 5.0})

    assert exc_info.value.status_code == 503
    assert exc_info.value.code == "DATABASE_UNAVAILABLE"

    # Confirm farm was NOT added to memory store
    assert len(memory_store.get_farmer_farms("farmer-fail-test")) == 0


