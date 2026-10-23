import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from ..db.mongodb import mongodb
from ..db.persistence_guard import enforce_database_available, handle_database_error
from ..services.memory_store import memory_store

logger = logging.getLogger("agritrace.repository.farmer")

class FarmerRepository:
    """
    Data access repository for Farms, Crops, and Harvest Batches.
    Enforces record ownership by farmer_id.
    When Atlas is configured as authoritative, operations fail-fast on unavailable database.
    """
    async def get_farms(self, farmer_id: str) -> List[Dict[str, Any]]:
        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["farms"].find({"farmer_id": farmer_id})
                farms = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    farms.append(doc)
                return farms
            except Exception as e:
                handle_database_error(e, "querying farms")

        return memory_store.get_farmer_farms(farmer_id)

    async def create_farm(self, farmer_id: str, farm_data: Dict[str, Any]) -> Dict[str, Any]:
        farm_id = farm_data.get("id") or f"farm-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            **farm_data,
            "id": farm_id,
            "farmer_id": farmer_id,
            "created_at": now,
            "updated_at": now,
        }

        db = enforce_database_available()
        if db is not None:
            try:
                await db["farms"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "saving farm")

        # Mirror to local store on success or in fallback mode
        with memory_store._lock:
            existing = memory_store._farmer_farms.get(farmer_id, [])
            existing.append(doc)
            memory_store._farmer_farms[farmer_id] = existing
            memory_store._save()

        doc.pop("_id", None)
        return doc

    async def get_crops(self, farmer_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
        query: Dict[str, Any] = {"farmer_id": farmer_id}
        if status and status.upper() != "ALL":
            query["status"] = status.upper()

        farms = await self.get_farms(farmer_id)
        farms_map = {f.get("id"): f for f in farms}

        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["crops"].find(query)
                crops = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    farm_id = doc.get("farm_id")
                    if farm_id and farm_id in farms_map:
                        doc["farm"] = {
                            "name": farms_map[farm_id].get("name"),
                            "location_name": farms_map[farm_id].get("location_name"),
                        }
                    crops.append(doc)
                return crops
            except Exception as e:
                handle_database_error(e, "querying crops")

        crops = memory_store.get_farmer_crops(farmer_id)
        if status and status.upper() != "ALL":
            crops = [c for c in crops if c.get("status", "").upper() == status.upper()]
        for c in crops:
            farm_id = c.get("farm_id")
            if farm_id and farm_id in farms_map:
                c["farm"] = {
                    "name": farms_map[farm_id].get("name"),
                    "location_name": farms_map[farm_id].get("location_name"),
                }
        return crops

    async def create_crop(self, farmer_id: str, crop_data: Dict[str, Any]) -> Dict[str, Any]:
        crop_id = crop_data.get("id") or f"crop-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            **crop_data,
            "id": crop_id,
            "farmer_id": farmer_id,
            "created_at": now,
            "updated_at": now,
        }

        if doc.get("farm_id"):
            farms = await self.get_farms(farmer_id)
            for f in farms:
                if f.get("id") == doc.get("farm_id"):
                    doc["farm"] = {
                        "name": f.get("name"),
                        "location_name": f.get("location_name"),
                    }
                    break

        db = enforce_database_available()
        if db is not None:
            try:
                await db["crops"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "saving crop")

        with memory_store._lock:
            existing = memory_store._farmer_crops.get(farmer_id, [])
            existing.append(doc)
            memory_store._farmer_crops[farmer_id] = existing
            memory_store._save()

        doc.pop("_id", None)
        return doc

    async def get_batches(self, farmer_id: str) -> List[Dict[str, Any]]:
        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["batches"].find({"farmer_id": farmer_id})
                batches = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    batches.append(doc)
                return batches
            except Exception as e:
                handle_database_error(e, "querying batches")

        return memory_store.get_farmer_batches(farmer_id)

    async def get_batch_by_code(self, batch_code: str) -> Optional[Dict[str, Any]]:
        """
        Public traceability query for consumer verification.
        """
        db = enforce_database_available()
        if db is not None:
            try:
                doc = await db["batches"].find_one({"batch_code": batch_code})
                if doc:
                    doc.pop("_id", None)
                    return doc
            except Exception as e:
                handle_database_error(e, "querying batch by code")

        with memory_store._lock:
            for b_list in memory_store._farmer_batches.values():
                for b in b_list:
                    if b.get("batch_code") == batch_code:
                        return b
        return None

    async def create_batch(self, farmer_id: str, batch_data: Dict[str, Any]) -> Dict[str, Any]:
        batch_id = batch_data.get("id") or f"batch-{uuid.uuid4().hex[:8]}"
        batch_code = batch_data.get("batch_code") or f"BAT-{datetime.now().year}-{uuid.uuid4().hex[:6].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            **batch_data,
            "id": batch_id,
            "batch_code": batch_code,
            "farmer_id": farmer_id,
            "current_status": batch_data.get("current_status", "MINTED"),
            "created_at": now,
            "updated_at": now,
        }

        db = enforce_database_available()
        if db is not None:
            try:
                await db["batches"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "saving batch")

        with memory_store._lock:
            existing = memory_store._farmer_batches.get(farmer_id, [])
            existing.append(doc)
            memory_store._farmer_batches[farmer_id] = existing
            memory_store._save()

        doc.pop("_id", None)
        return doc

    async def get_crop(self, farmer_id: str, crop_id: str) -> Optional[Dict[str, Any]]:
        farms = await self.get_farms(farmer_id)
        farms_map = {f.get("id"): f for f in farms}

        db = enforce_database_available()
        if db is not None:
            try:
                doc = await db["crops"].find_one({"id": crop_id, "farmer_id": farmer_id})
                if doc:
                    doc.pop("_id", None)
                    farm_id = doc.get("farm_id")
                    if farm_id and farm_id in farms_map:
                        doc["farm"] = {
                            "name": farms_map[farm_id].get("name"),
                            "location_name": farms_map[farm_id].get("location_name"),
                        }
                    return doc
            except Exception as e:
                handle_database_error(e, "querying crop by id")

        for c in memory_store.get_farmer_crops(farmer_id):
            if c.get("id") == crop_id:
                crop_copy = dict(c)
                farm_id = crop_copy.get("farm_id")
                if farm_id and farm_id in farms_map:
                    crop_copy["farm"] = {
                        "name": farms_map[farm_id].get("name"),
                        "location_name": farms_map[farm_id].get("location_name"),
                    }
                return crop_copy
        return None

    async def get_fertilizers(self, farmer_id: str, crop_id: str) -> List[Dict[str, Any]]:
        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["fertilizer_applications"].find({"crop_id": crop_id, "farmer_id": farmer_id}).sort("application_date", -1)
                records = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    records.append(doc)
                return records
            except Exception as e:
                handle_database_error(e, "querying fertilizers")

        records = memory_store.get_crop_fertilizers(farmer_id, crop_id)
        return sorted(records, key=lambda r: r.get("application_date", ""), reverse=True)

    async def get_fertilizer(self, farmer_id: str, fertilizer_id: str) -> Optional[Dict[str, Any]]:
        db = enforce_database_available()
        if db is not None:
            try:
                doc = await db["fertilizer_applications"].find_one({"id": fertilizer_id, "farmer_id": farmer_id})
                if doc:
                    doc.pop("_id", None)
                    return doc
            except Exception as e:
                handle_database_error(e, "querying fertilizer")

        return memory_store.get_fertilizer(farmer_id, fertilizer_id)

    async def create_fertilizer(self, farmer_id: str, crop_id: str, fertilizer_data: Dict[str, Any]) -> Dict[str, Any]:
        fert_id = fertilizer_data.get("id") or f"fert-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            **fertilizer_data,
            "id": fert_id,
            "crop_id": crop_id,
            "farmer_id": farmer_id,
            "created_at": now,
            "updated_at": now,
        }

        db = enforce_database_available()
        if db is not None:
            try:
                await db["fertilizer_applications"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "saving fertilizer")

        memory_store.save_fertilizer(farmer_id, doc)
        doc.pop("_id", None)
        return doc

    async def update_fertilizer(self, farmer_id: str, fertilizer_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        clean_updates = {k: v for k, v in updates.items() if v is not None}
        clean_updates["updated_at"] = now

        db = enforce_database_available()
        if db is not None:
            try:
                result = await db["fertilizer_applications"].find_one_and_update(
                    {"id": fertilizer_id, "farmer_id": farmer_id},
                    {"$set": clean_updates},
                    return_document=True,
                )
                if result:
                    result.pop("_id", None)
                    memory_store.update_fertilizer(farmer_id, fertilizer_id, clean_updates)
                    return result
            except Exception as e:
                handle_database_error(e, "updating fertilizer")

        return memory_store.update_fertilizer(farmer_id, fertilizer_id, clean_updates)

    async def delete_fertilizer(self, farmer_id: str, fertilizer_id: str) -> bool:
        db = enforce_database_available()
        deleted = False
        if db is not None:
            try:
                res = await db["fertilizer_applications"].delete_one({"id": fertilizer_id, "farmer_id": farmer_id})
                if res.deleted_count > 0:
                    deleted = True
            except Exception as e:
                handle_database_error(e, "deleting fertilizer")

        mem_deleted = memory_store.delete_fertilizer(farmer_id, fertilizer_id)
        return deleted or mem_deleted

farmer_repository = FarmerRepository()
