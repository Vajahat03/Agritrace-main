import uuid
import logging
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

from ..db.mongodb import mongodb
from ..db.persistence_guard import enforce_database_available, handle_database_error
try:
    from ai.shelf_life.xgboost_model import predict_shelf_life
except ImportError:
    def predict_shelf_life(**kwargs):
        from ..ai.dag_orchestrator import dag_orchestrator
        return dag_orchestrator.agents["shelf_life"].run(kwargs).get("output", {})

logger = logging.getLogger("agritrace.repository.smartbag")

def _compute_status_and_days(batch_doc: Dict[str, Any]) -> Dict[str, Any]:
    """
    Dynamically evaluates remaining shelf life and urgency category relative to UTC now.
    """
    now = datetime.now(timezone.utc)
    try:
        raw_val = str(batch_doc.get("predicted_use_by_date", "")).replace("Z", "+00:00")
        if "T" in raw_val:
            use_by = datetime.fromisoformat(raw_val)
        else:
            d = datetime.strptime(raw_val[:10], "%Y-%m-%d")
            use_by = d.replace(tzinfo=timezone.utc) + timedelta(hours=23, minutes=59)
    except Exception:
        use_by = now + timedelta(days=float(batch_doc.get("predicted_shelf_life_days", 3.0)))

    if use_by.tzinfo is None:
        use_by = use_by.replace(tzinfo=timezone.utc)
    else:
        use_by = use_by.astimezone(timezone.utc)

    diff_seconds = (use_by - now).total_seconds()
    days_remaining = max(0.0, round(diff_seconds / 86400.0, 1))

    if batch_doc.get("current_status") in ["CONSUMED", "SPOILED", "REMOVED"]:
        shelf_life_status = batch_doc["current_status"]
    elif days_remaining <= 0.0:
        shelf_life_status = "EXPIRED"
    elif days_remaining <= 1.0:
        shelf_life_status = "EXPIRES_TODAY"
    elif days_remaining <= 2.5:
        shelf_life_status = "APPROACHING_EXPIRY"
    else:
        shelf_life_status = "FRESH"

    return {
        **batch_doc,
        "id": batch_doc.get("batch_id") or str(batch_doc.get("_id", "")),
        "days_remaining": days_remaining,
        "shelf_life_status": shelf_life_status,
    }

class SmartBagRepository:
    """
    Authoritative MongoDB Atlas persistence repository for SmartBag produce inventory batches.
    """

    def __init__(self):
        self._memory_batches: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    async def create_batch(self, user_id: str, batch_data: Dict[str, Any]) -> Dict[str, Any]:
        db = enforce_database_available()
        now_iso = datetime.now(timezone.utc).isoformat()
        
        batch_id = batch_data.get("batch_id") or f"SB-{uuid.uuid4().hex[:8].upper()}"
        
        produce_name = batch_data.get("produce_name") or batch_data.get("produceName") or "Produce"
        crop_type = (batch_data.get("crop_type") or batch_data.get("cropType") or "tomato").lower()
        image_url = batch_data.get("image_url") or batch_data.get("imageUrl")
        qty = float(batch_data.get("quantity_kg") if batch_data.get("quantity_kg") is not None else batch_data.get("quantityKg", 1.0))
        scan_id = batch_data.get("scan_id") or batch_data.get("scanId")
        workflow_id = batch_data.get("workflow_id") or batch_data.get("workflowId")
        freshness = float(batch_data.get("freshness_score") if batch_data.get("freshness_score") is not None else batch_data.get("freshnessScore", 85.0))
        quality = float(batch_data.get("quality_score") if batch_data.get("quality_score") is not None else batch_data.get("qualityScore", 85.0))
        shelf_days = float(batch_data.get("predicted_shelf_life_days") if batch_data.get("predicted_shelf_life_days") is not None else batch_data.get("predictedShelfLifeDays", 4.0))
        
        predicted_use_by = batch_data.get("predicted_use_by_date") or batch_data.get("predictedUseByDate")
        if not predicted_use_by:
            use_by_dt = datetime.now(timezone.utc) + timedelta(days=shelf_days)
            predicted_use_by = use_by_dt.strftime("%Y-%m-%d")

        storage_mode = batch_data.get("storage_mode") or batch_data.get("storageMode") or "ambient"
        temp = float(batch_data.get("temperature_c") if batch_data.get("temperature_c") is not None else batch_data.get("temperatureC", 22.0))
        rh = float(batch_data.get("humidity_rh") if batch_data.get("humidity_rh") is not None else batch_data.get("humidityRh", 75.0))
        storage_rec = batch_data.get("storage_recommendation") or batch_data.get("storageRecommendation") or "Store in ventilated crisper chamber."
        reminders_enabled = bool(batch_data.get("reminders_enabled") if batch_data.get("reminders_enabled") is not None else batch_data.get("remindersEnabled", True))
        reminder_freq = batch_data.get("reminder_frequency") or batch_data.get("reminderFrequency") or "DAILY"

        doc = {
            "batch_id": batch_id,
            "id": batch_id,
            "user_id": user_id,
            "produce_name": produce_name,
            "crop_type": crop_type,
            "image_url": image_url,
            "quantity_kg": qty,
            "scan_id": scan_id,
            "workflow_id": workflow_id,
            "freshness_score": freshness,
            "quality_score": quality,
            "predicted_shelf_life_days": shelf_days,
            "prediction_date": now_iso,
            "predicted_use_by_date": predicted_use_by,
            "storage_mode": storage_mode,
            "temperature_c": temp,
            "humidity_rh": rh,
            "storage_recommendation": storage_rec,
            "current_status": "ACTIVE",
            "reminders_enabled": reminders_enabled,
            "reminder_frequency": reminder_freq,
            "created_at": now_iso,
            "updated_at": now_iso,
            "consumed_at": None,
            "spoiled_at": None,
        }

        if db is not None:
            try:
                await db["smartbag_batches"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "persisting SmartBag batch to MongoDB Atlas")

        with self._lock:
            self._memory_batches[batch_id] = doc

        return _compute_status_and_days(doc)

    async def get_batch(self, user_id: str, batch_id: str, is_admin: bool = False) -> Optional[Dict[str, Any]]:
        db = enforce_database_available()
        query = {"batch_id": batch_id}
        if not is_admin:
            query["user_id"] = user_id

        if db is not None:
            try:
                doc = await db["smartbag_batches"].find_one(query)
                if doc:
                    return _compute_status_and_days(doc)
            except Exception as e:
                handle_database_error(e, "fetching SmartBag batch from MongoDB Atlas")

        with self._lock:
            b = self._memory_batches.get(batch_id)
            if b and (is_admin or b.get("user_id") == user_id):
                return _compute_status_and_days(b)
        return None

    async def list_batches(
        self,
        user_id: str,
        status_filter: Optional[str] = None,
        page: int = 1,
        page_size: int = 50,
        is_admin: bool = False,
    ) -> Dict[str, Any]:
        db = enforce_database_available()
        query: Dict[str, Any] = {}
        if not is_admin:
            query["user_id"] = user_id

        if status_filter and status_filter.upper() != "ALL":
            query["current_status"] = status_filter.upper()

        if db is not None:
            try:
                skip = (page - 1) * page_size
                cursor = db["smartbag_batches"].find(query).sort("created_at", -1).skip(skip).limit(page_size)
                items_raw = await cursor.to_list(length=page_size)
                total = await db["smartbag_batches"].count_documents(query)
                active_count = await db["smartbag_batches"].count_documents({"user_id": user_id, "current_status": "ACTIVE"})
                computed_items = [_compute_status_and_days(d) for d in items_raw]
                approaching_count = sum(1 for it in computed_items if it.get("shelf_life_status") in ["APPROACHING_EXPIRY", "EXPIRES_TODAY"])
                return {
                    "items": computed_items,
                    "total": total,
                    "active_count": active_count,
                    "approaching_expiry_count": approaching_count,
                }
            except Exception as e:
                handle_database_error(e, "listing SmartBag batches from MongoDB Atlas")

        with self._lock:
            all_b = [b for b in self._memory_batches.values() if is_admin or b.get("user_id") == user_id]
            if status_filter and status_filter.upper() != "ALL":
                all_b = [b for b in all_b if b.get("current_status") == status_filter.upper()]
            computed_items = [_compute_status_and_days(b) for b in all_b]
            active_count = sum(1 for it in computed_items if it.get("current_status") == "ACTIVE")
            approaching_count = sum(1 for it in computed_items if it.get("shelf_life_status") in ["APPROACHING_EXPIRY", "EXPIRES_TODAY"])
            return {
                "items": computed_items,
                "total": len(computed_items),
                "active_count": active_count,
                "approaching_expiry_count": approaching_count,
            }

    async def update_batch(self, user_id: str, batch_id: str, update_data: Dict[str, Any], is_admin: bool = False) -> Optional[Dict[str, Any]]:
        db = enforce_database_available()
        query = {"batch_id": batch_id}
        if not is_admin:
            query["user_id"] = user_id

        update_dict = {k: v for k, v in update_data.items() if v is not None}
        mapping = {
            "quantityKg": "quantity_kg",
            "storageMode": "storage_mode",
            "temperatureC": "temperature_c",
            "humidityRh": "humidity_rh",
            "remindersEnabled": "reminders_enabled",
            "currentStatus": "current_status",
            "storageRecommendation": "storage_recommendation",
        }
        for c_key, s_key in mapping.items():
            if c_key in update_dict and s_key not in update_dict:
                update_dict[s_key] = update_dict.pop(c_key)
        update_dict["updated_at"] = datetime.now(timezone.utc).isoformat()

        if db is not None:
            try:
                res = await db["smartbag_batches"].find_one_and_update(
                    query,
                    {"$set": update_dict},
                    return_document=True,
                )
                if res:
                    with self._lock:
                        self._memory_batches[batch_id] = res
                    return _compute_status_and_days(res)
            except Exception as e:
                handle_database_error(e, "updating SmartBag batch in MongoDB Atlas")

        with self._lock:
            if batch_id in self._memory_batches:
                b = self._memory_batches[batch_id]
                if is_admin or b.get("user_id") == user_id:
                    b.update(update_dict)
                    return _compute_status_and_days(b)
        return None

    async def transition_status(self, user_id: str, batch_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        now_iso = datetime.now(timezone.utc).isoformat()
        update_data = {
            "current_status": new_status,
            "updated_at": now_iso,
        }
        if new_status == "CONSUMED":
            update_data["consumed_at"] = now_iso
        elif new_status == "SPOILED":
            update_data["spoiled_at"] = now_iso

        return await self.update_batch(user_id, batch_id, update_data)

    async def delete_batch(self, user_id: str, batch_id: str, is_admin: bool = False) -> bool:
        db = enforce_database_available()
        query = {"batch_id": batch_id}
        if not is_admin:
            query["user_id"] = user_id

        if db is not None:
            try:
                res = await db["smartbag_batches"].delete_one(query)
                with self._lock:
                    self._memory_batches.pop(batch_id, None)
                return res.deleted_count > 0
            except Exception as e:
                handle_database_error(e, "deleting SmartBag batch from MongoDB Atlas")

        with self._lock:
            if batch_id in self._memory_batches:
                b = self._memory_batches[batch_id]
                if is_admin or b.get("user_id") == user_id:
                    self._memory_batches.pop(batch_id, None)
                    return True
        return False

    async def rescan_batch(
        self,
        user_id: str,
        batch_id: str,
        temperature_c: Optional[float] = None,
        humidity_rh: Optional[float] = None,
        storage_mode: Optional[str] = None,
        freshness_score: Optional[float] = None,
    ) -> Optional[Dict[str, Any]]:
        batch = await self.get_batch(user_id, batch_id)
        if not batch:
            return None

        temp = temperature_c if temperature_c is not None else batch.get("temperature_c", 22.0)
        rh = humidity_rh if humidity_rh is not None else batch.get("humidity_rh", 75.0)
        mode = storage_mode if storage_mode is not None else batch.get("storage_mode", "ambient")
        freshness = freshness_score if freshness_score is not None else batch.get("freshness_score", 85.0)
        crop = batch.get("crop_type", "tomato")

        pred = predict_shelf_life(
            produce_type=crop,
            freshness_score=freshness,
            quality_score=freshness,
            defect_probability=0.10,
            temperature_c=temp,
            humidity_rh=rh,
            storage_type=mode,
        )

        new_shelf_days = float(pred.get("predicted_shelf_life_days", 4.0))
        use_by_dt = datetime.now(timezone.utc) + timedelta(days=new_shelf_days)
        new_use_by = use_by_dt.strftime("%Y-%m-%d")

        update_dict = {
            "predicted_shelf_life_days": new_shelf_days,
            "predicted_use_by_date": new_use_by,
            "temperature_c": temp,
            "humidity_rh": rh,
            "storage_mode": mode,
            "freshness_score": freshness,
            "storage_recommendation": pred.get("explanation"),
        }

        return await self.update_batch(user_id, batch_id, update_dict)

smartbag_repository = SmartBagRepository()
