import math
import uuid
import logging
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone, timedelta

from ..db.mongodb import mongodb
from ..db.persistence_guard import enforce_database_available, handle_database_error
from ..repositories.notification_repository import notification_repository
from ..repositories.smartbag_repository import smartbag_repository

logger = logging.getLogger("agritrace.services.reminders")

class ReminderService:
    """
    Manages durable daily freshness reminder schedules for SmartBag inventory batches.
    Guarantees idempotency via unique (batch_id, due_date) records in MongoDB Atlas.
    """

    def __init__(self):
        self._memory_reminders: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def generate_reminder_message(self, produce_name: str, days_left: int, is_expiry: bool) -> str:
        """
        Dynamically formats user-facing reminder copy based on real days remaining.
        """
        if is_expiry or days_left <= 0:
            return (
                f"Your {produce_name} have reached their predicted expiry date. "
                "Inspect them carefully; the prediction is a calibrated model estimate, not a safety guarantee."
            )
        elif days_left == 1:
            return (
                f"Your {produce_name} have an estimated 1 day of shelf life remaining. "
                "Plan to consume them today or reassess their storage condition."
            )
        elif days_left == 2:
            return (
                f"Your {produce_name} have an estimated 2 days remaining. "
                "Consider preparing or utilizing them soon."
            )
        else:
            return (
                f"Your {produce_name} have an estimated {days_left} days of shelf life remaining. "
                "Check storage temperature and maintain optimal humidity."
            )

    async def schedule_batch_reminders(self, user_id: str, batch: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Schedules a sequence of daily reminders from Day 1 to expiration day.
        Persisted in MongoDB Atlas collection 'smartbag_reminders'.
        """
        db = enforce_database_available()
        batch_id = batch["batch_id"]
        produce_name = batch.get("produce_name", "Produce")
        shelf_days = max(1, int(math.ceil(float(batch.get("predicted_shelf_life_days", 3.0)))))
        
        now = datetime.now(timezone.utc)
        scheduled_records = []

        try:
            for day_offset in range(1, shelf_days + 1):
                due_dt = now + timedelta(days=day_offset)
                due_date_str = due_dt.strftime("%Y-%m-%d")
                days_left = max(0, shelf_days - day_offset)
                is_expiry = (day_offset == shelf_days)

                reminder_key = f"{batch_id}:{due_date_str}"
                message = self.generate_reminder_message(produce_name, days_left, is_expiry)

                reminder_doc = {
                    "reminder_key": reminder_key,
                    "reminder_id": f"rem-{uuid.uuid4().hex[:10]}",
                    "batch_id": batch_id,
                    "user_id": user_id,
                    "produce_name": produce_name,
                    "due_date": due_date_str,
                    "day_offset": day_offset,
                    "days_remaining_at_due": days_left,
                    "title": f"Freshness Bag Alert: {produce_name}",
                    "message": message,
                    "status": "PENDING",  # PENDING | SENT | CANCELLED | SUPERSEDED
                    "created_at": now.isoformat(),
                    "updated_at": now.isoformat(),
                    "sent_at": None,
                }

                if db is not None:
                    # Idempotent upsert by reminder_key
                    await db["smartbag_reminders"].update_one(
                        {"reminder_key": reminder_key},
                        {"$setOnInsert": reminder_doc},
                        upsert=True,
                    )
                
                with self._lock:
                    if reminder_key not in self._memory_reminders:
                        self._memory_reminders[reminder_key] = reminder_doc

                scheduled_records.append(reminder_doc)

            logger.info("Scheduled %d daily reminders for batch %s", len(scheduled_records), batch_id)
            return scheduled_records

        except Exception as e:
            handle_database_error(e, "ReminderService.schedule_batch_reminders")
            return scheduled_records

    async def cancel_batch_reminders(self, user_id: str, batch_id: str) -> int:
        """
        Cancels any pending future reminders when a batch is marked consumed, spoiled, or removed.
        """
        db = enforce_database_available()
        modified_count = 0
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            if db is not None:
                res = await db["smartbag_reminders"].update_many(
                    {"user_id": user_id, "batch_id": batch_id, "status": "PENDING"},
                    {"$set": {"status": "CANCELLED", "updated_at": now_iso}},
                )
                modified_count = res.modified_count
            
            with self._lock:
                for rem in self._memory_reminders.values():
                    if rem.get("user_id") == user_id and rem.get("batch_id") == batch_id and rem.get("status") == "PENDING":
                        rem["status"] = "CANCELLED"
                        rem["updated_at"] = now_iso
                        if db is None:
                            modified_count += 1

            logger.info("Cancelled %d pending reminders for batch %s", modified_count, batch_id)
            return modified_count
        except Exception as e:
            handle_database_error(e, "ReminderService.cancel_batch_reminders")
            return modified_count

    async def reschedule_batch_reminders(self, user_id: str, batch: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Cancels stale pending reminders and schedules a fresh sequence when prediction is updated.
        """
        await self.cancel_batch_reminders(user_id, batch["batch_id"])
        return await self.schedule_batch_reminders(user_id, batch)

    async def get_reminders_for_batch(self, user_id: str, batch_id: str) -> List[Dict[str, Any]]:
        """
        Retrieves all scheduled reminder records for a specific batch.
        """
        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["smartbag_reminders"].find({"user_id": user_id, "batch_id": batch_id})
                items = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    items.append(doc)
                return items
            except Exception as e:
                handle_database_error(e, "ReminderService.get_reminders_for_batch")
        with self._lock:
            return [
                dict(r) for r in self._memory_reminders.values()
                if r.get("user_id") == user_id and r.get("batch_id") == batch_id
            ]

    async def dispatch_due_reminders(
        self,
        user_id: Optional[str] = None,
        as_of_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Scans for due PENDING reminders as of today's calendar date, marks them SENT,
        and posts persistent in-app notifications into 'user_notifications'.
        Idempotent and safe to run multiple times without duplicate notifications.
        """
        db = enforce_database_available()
        today_str = as_of_date or datetime.now(timezone.utc).strftime("%Y-%m-%d")

        query: Dict[str, Any] = {
            "due_date": {"$lte": today_str},
            "status": "PENDING",
        }
        if user_id:
            query["user_id"] = user_id

        dispatched = []
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            if db is not None:
                due_cursor = db["smartbag_reminders"].find(query)
                due_list = await due_cursor.to_list(length=100)
            else:
                with self._lock:
                    due_list = [
                        dict(r) for r in self._memory_reminders.values()
                        if r.get("due_date", "") <= today_str
                        and r.get("status") == "PENDING"
                        and (user_id is None or r.get("user_id") == user_id)
                    ]

            for rem in due_list:
                # 1. Check if parent batch is still ACTIVE
                batch = None
                if db is not None:
                    batch = await db["smartbag_batches"].find_one({
                        "batch_id": rem["batch_id"],
                        "current_status": "ACTIVE",
                    })
                else:
                    batch = await smartbag_repository.get_batch(rem["user_id"], rem["batch_id"])
                    if batch and batch.get("current_status") != "ACTIVE":
                        batch = None

                if not batch or not batch.get("reminders_enabled", True):
                    # Mark cancelled
                    if db is not None and "_id" in rem:
                        await db["smartbag_reminders"].update_one(
                            {"_id": rem["_id"]},
                            {"$set": {"status": "CANCELLED", "updated_at": now_iso}},
                        )
                    with self._lock:
                        if rem["reminder_key"] in self._memory_reminders:
                            self._memory_reminders[rem["reminder_key"]]["status"] = "CANCELLED"
                    continue

                # 2. Dispatch persistent in-app notification
                await notification_repository.create_notification(
                    user_id=rem["user_id"],
                    title=rem["title"],
                    message=rem["message"],
                    type="SMARTBAG",
                    batch_id=rem["batch_id"],
                    link=f"/customer/freshness-bag?batch_id={rem['batch_id']}",
                )

                # 3. Mark reminder SENT
                if db is not None and "_id" in rem:
                    await db["smartbag_reminders"].update_one(
                        {"_id": rem["_id"]},
                        {"$set": {"status": "SENT", "sent_at": now_iso, "updated_at": now_iso}},
                    )
                with self._lock:
                    if rem["reminder_key"] in self._memory_reminders:
                        self._memory_reminders[rem["reminder_key"]]["status"] = "SENT"
                        self._memory_reminders[rem["reminder_key"]]["sent_at"] = now_iso

                dispatched.append({**rem, "status": "SENT", "sent_at": now_iso})

            logger.info("Dispatched %d due freshness reminders", len(dispatched))
            return dispatched

        except Exception as e:
            handle_database_error(e, "ReminderService.dispatch_due_reminders")
            return dispatched

reminder_service = ReminderService()
