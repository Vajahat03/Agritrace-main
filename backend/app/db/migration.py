import json
import logging
from pathlib import Path
from typing import Dict, Any, Optional
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger("agritrace.database.migration")

async def migrate_legacy_store_to_mongodb(db: AsyncIOMotorDatabase, store_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Migrates persisted records from store.json into MongoDB Atlas collections.
    Safe and idempotent: uses upserts by unique identifiers (e.g. uid, batch_code, id)
    so running multiple times never duplicates or overwrites existing records.
    """
    if db is None:
        return {"migrated": False, "reason": "MongoDB not connected"}

    if not store_path:
        base_dir = Path(__file__).resolve().parent.parent.parent
        file_path = base_dir / "data" / "store.json"
    else:
        file_path = Path(store_path)

    if not file_path.is_file():
        return {"migrated": False, "reason": "No legacy store.json found"}

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception as e:
        logger.warning("Could not read legacy store for migration: %s", e)
        return {"migrated": False, "error": str(e)}

    stats = {
        "profiles_migrated": 0,
        "inventories_migrated": 0,
        "crops_migrated": 0,
        "batches_migrated": 0,
        "farms_migrated": 0,
    }

    try:
        # 1. Migrate Profiles
        profiles = data.get("profiles", {})
        for uid, prof in profiles.items():
            doc = {**prof, "uid": uid}
            # Only insert if doesn't already exist
            result = await db["users"].update_one(
                {"uid": uid},
                {"$setOnInsert": doc},
                upsert=True,
            )
            if result.upserted_id:
                stats["profiles_migrated"] += 1

        # 2. Migrate Vendor Inventories
        vendor_inventories = data.get("vendor_inventories", {})
        for vendor_id, items in vendor_inventories.items():
            for item in items:
                item_id = item.get("id")
                if item_id:
                    doc = {**item, "vendor_id": vendor_id}
                    result = await db["vendor_inventory"].update_one(
                        {"id": item_id, "vendor_id": vendor_id},
                        {"$setOnInsert": doc},
                        upsert=True,
                    )
                    if result.upserted_id:
                        stats["inventories_migrated"] += 1

        # 3. Migrate Farmer Crops
        farmer_crops = data.get("farmer_crops", {})
        for farmer_id, crops in farmer_crops.items():
            for crop in crops:
                crop_id = crop.get("id")
                if crop_id:
                    doc = {**crop, "farmer_id": farmer_id}
                    result = await db["crops"].update_one(
                        {"id": crop_id, "farmer_id": farmer_id},
                        {"$setOnInsert": doc},
                        upsert=True,
                    )
                    if result.upserted_id:
                        stats["crops_migrated"] += 1

        # 4. Migrate Farmer Batches
        farmer_batches = data.get("farmer_batches", {})
        for farmer_id, batches in farmer_batches.items():
            for batch in batches:
                batch_code = batch.get("batch_code") or batch.get("id")
                if batch_code:
                    doc = {**batch, "farmer_id": farmer_id}
                    result = await db["batches"].update_one(
                        {"batch_code": batch_code},
                        {"$setOnInsert": doc},
                        upsert=True,
                    )
                    if result.upserted_id:
                        stats["batches_migrated"] += 1

        # 5. Migrate Farmer Farms
        farmer_farms = data.get("farmer_farms", {})
        for farmer_id, farms in farmer_farms.items():
            for farm in farms:
                farm_id = farm.get("id")
                if farm_id:
                    doc = {**farm, "farmer_id": farmer_id}
                    result = await db["farms"].update_one(
                        {"id": farm_id, "farmer_id": farmer_id},
                        {"$setOnInsert": doc},
                        upsert=True,
                    )
                    if result.upserted_id:
                        stats["farms_migrated"] += 1

        # 6. Migrate Fertilizer Applications
        fertilizer_apps = data.get("fertilizer_applications", {})
        stats["fertilizers_migrated"] = 0
        for farmer_id, ferts in fertilizer_apps.items():
            for fert in ferts:
                fert_id = fert.get("id")
                if fert_id:
                    doc = {**fert, "farmer_id": farmer_id}
                    result = await db["fertilizer_applications"].update_one(
                        {"id": fert_id, "farmer_id": farmer_id},
                        {"$setOnInsert": doc},
                        upsert=True,
                    )
                    if result.upserted_id:
                        stats["fertilizers_migrated"] += 1

        # Post-migration verification
        verification_counts = {
            "users": await db["users"].count_documents({}),
            "farms": await db["farms"].count_documents({}),
            "crops": await db["crops"].count_documents({}),
            "batches": await db["batches"].count_documents({}),
            "fertilizer_applications": await db["fertilizer_applications"].count_documents({}),
            "vendor_inventory": await db["vendor_inventory"].count_documents({}),
        }

        logger.info("Legacy data migration completed successfully: %s. Verified counts: %s", stats, verification_counts)
        return {"migrated": True, "stats": stats, "verification": verification_counts}

    except Exception as e:
        logger.error("Error migrating legacy data to MongoDB: %s", e)
        return {"migrated": False, "error": str(e)}
