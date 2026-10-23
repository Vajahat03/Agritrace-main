import uuid
import logging
import threading
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

from ..db.mongodb import mongodb
from ..db.persistence_guard import enforce_database_available, handle_database_error

logger = logging.getLogger("agritrace.repository.notifications")

class NotificationRepository:
    """
    Authoritative MongoDB Atlas persistence repository for in-app freshness and reminder notifications.
    """

    def __init__(self):
        self._memory_notifications: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    async def create_notification(
        self,
        user_id: str,
        title: str,
        message: str,
        type: str = "SMARTBAG",
        batch_id: Optional[str] = None,
        link: Optional[str] = None,
    ) -> Dict[str, Any]:
        db = enforce_database_available()
        now_iso = datetime.now(timezone.utc).isoformat()
        notif_id = f"notif-{uuid.uuid4().hex[:10]}"

        doc = {
            "notification_id": notif_id,
            "id": notif_id,
            "user_id": user_id,
            "title": title,
            "message": message,
            "type": type,
            "is_read": False,
            "batch_id": batch_id,
            "link": link or "/customer/freshness-bag",
            "created_at": now_iso,
            "updated_at": now_iso,
        }

        if db is not None:
            try:
                await db["user_notifications"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "persisting user notification to MongoDB Atlas")

        with self._lock:
            self._memory_notifications[notif_id] = doc

        return doc

    async def list_notifications(self, user_id: str, limit: int = 50) -> Dict[str, Any]:
        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["user_notifications"].find({"user_id": user_id}).sort("created_at", -1).limit(limit)
                items = await cursor.to_list(length=limit)
                for it in items:
                    it["id"] = it.get("notification_id") or str(it.get("_id", ""))

                unread = await db["user_notifications"].count_documents({"user_id": user_id, "is_read": False})
                return {
                    "items": items,
                    "total": len(items),
                    "unread_count": unread,
                }
            except Exception as e:
                handle_database_error(e, "fetching user notifications from MongoDB Atlas")

        with self._lock:
            items = [n for n in self._memory_notifications.values() if n.get("user_id") == user_id]
            items.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            items = items[:limit]
            unread = sum(1 for n in items if not n.get("is_read", False))
            return {
                "items": items,
                "total": len(items),
                "unread_count": unread,
            }

    async def mark_as_read(self, user_id: str, notification_id: str) -> bool:
        db = enforce_database_available()
        now_iso = datetime.now(timezone.utc).isoformat()
        if db is not None:
            try:
                res = await db["user_notifications"].update_one(
                    {"user_id": user_id, "notification_id": notification_id},
                    {"$set": {"is_read": True, "updated_at": now_iso}},
                )
                if res.modified_count > 0:
                    with self._lock:
                        if notification_id in self._memory_notifications:
                            self._memory_notifications[notification_id]["is_read"] = True
                    return True
            except Exception as e:
                handle_database_error(e, "marking notification read in MongoDB Atlas")

        with self._lock:
            if notification_id in self._memory_notifications:
                n = self._memory_notifications[notification_id]
                if n.get("user_id") == user_id:
                    n["is_read"] = True
                    return True
        return False

    async def mark_all_read(self, user_id: str) -> int:
        db = enforce_database_available()
        now_iso = datetime.now(timezone.utc).isoformat()
        if db is not None:
            try:
                res = await db["user_notifications"].update_many(
                    {"user_id": user_id, "is_read": False},
                    {"$set": {"is_read": True, "updated_at": now_iso}},
                )
                with self._lock:
                    for n in self._memory_notifications.values():
                        if n.get("user_id") == user_id:
                            n["is_read"] = True
                return res.modified_count
            except Exception as e:
                handle_database_error(e, "marking all notifications read in MongoDB Atlas")

        with self._lock:
            c = 0
            for n in self._memory_notifications.values():
                if n.get("user_id") == user_id and not n.get("is_read", False):
                    n["is_read"] = True
                    c += 1
            return c

notification_repository = NotificationRepository()
