import logging
import uuid
import threading
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from ..db.mongodb import mongodb

logger = logging.getLogger("agritrace.repository.workflow")

class WorkflowRepository:
    """
    Data access repository for Multi-Agent AI Workflows.
    Persists workflow executions, agent traces, and decision plans in MongoDB Atlas collection 'ai_workflows'.
    Guarantees strict ownership isolation by user_id and respects Phase 4 database unavailability safeguards.
    """
    def __init__(self):
        self._lock = threading.Lock()
        self._memory_workflows: Dict[str, Dict[str, Any]] = {}

    async def create_workflow(self, user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
        workflow_id = data.get("workflow_id") or data.get("id") or f"wf-{uuid.uuid4().hex[:10]}"
        now = datetime.now(timezone.utc).isoformat()
        
        doc = {
            **data,
            "id": workflow_id,
            "workflow_id": workflow_id,
            "user_id": user_id,
            "created_at": now,
            "updated_at": now,
        }

        active_db = mongodb.get_database()
        if active_db is not None:
            try:
                await active_db["ai_workflows"].insert_one({**doc})
                doc["persisted_durably"] = True
                doc["persistence_tier"] = "atlas"
                doc["persistence_notice"] = None
            except Exception as e:
                logger.warning("MongoDB Atlas write failed for workflow %s, retaining in session: %s", workflow_id, e)
                doc["persisted_durably"] = False
                doc["persistence_tier"] = "ephemeral_session"
                doc["persistence_notice"] = "Active session inspection. MongoDB Atlas write encountered an error; state is retained in server session memory."
        else:
            doc["persisted_durably"] = False
            doc["persistence_tier"] = "ephemeral_session"
            doc["persistence_notice"] = "Active session preview only. Workflow trace is retained in server session memory and will not survive server restart."

        with self._lock:
            self._memory_workflows[workflow_id] = doc

        doc.pop("_id", None)
        return doc

    async def update_workflow(self, user_id: str, workflow_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        now = datetime.now(timezone.utc).isoformat()
        clean_updates = {k: v for k, v in updates.items() if v is not None}
        clean_updates["updated_at"] = now

        active_db = mongodb.get_database()
        if active_db is not None:
            try:
                result = await active_db["ai_workflows"].find_one_and_update(
                    {"workflow_id": workflow_id, "user_id": user_id},
                    {"$set": clean_updates},
                    return_document=True,
                )
                if result:
                    result.pop("_id", None)
                    result["persisted_durably"] = True
                    result["persistence_tier"] = "atlas"
                    result["persistence_notice"] = None
                    with self._lock:
                        if workflow_id in self._memory_workflows:
                            self._memory_workflows[workflow_id].update(clean_updates)
                        else:
                            self._memory_workflows[workflow_id] = result
                    return result
            except Exception as e:
                logger.warning("MongoDB Atlas update failed for workflow %s: %s", workflow_id, e)

        with self._lock:
            existing = self._memory_workflows.get(workflow_id)
            if existing and (existing.get("user_id") == user_id):
                existing.update(clean_updates)
                if "persisted_durably" not in existing:
                    existing["persisted_durably"] = False
                    existing["persistence_tier"] = "ephemeral_session"
                return existing
        return None

    async def get_workflow(self, user_id: str, workflow_id: str, is_admin: bool = False) -> Optional[Dict[str, Any]]:
        query = {"workflow_id": workflow_id}
        if not is_admin:
            query["user_id"] = user_id

        active_db = mongodb.get_database()
        if active_db is not None:
            try:
                doc = await active_db["ai_workflows"].find_one(query)
                if doc:
                    doc.pop("_id", None)
                    doc["persisted_durably"] = True
                    doc["persistence_tier"] = "atlas"
                    doc["persistence_notice"] = None
                    return doc
            except Exception as e:
                logger.warning("MongoDB Atlas get_workflow failed for workflow %s: %s", workflow_id, e)

        with self._lock:
            doc = self._memory_workflows.get(workflow_id)
            if doc and (is_admin or doc.get("user_id") == user_id):
                res = dict(doc)
                if "persisted_durably" not in res:
                    res["persisted_durably"] = False
                    res["persistence_tier"] = "ephemeral_session"
                return res
        return None

    async def list_workflows(
        self,
        user_id: str,
        page: int = 1,
        page_size: int = 10,
        is_admin: bool = False,
    ) -> Dict[str, Any]:
        page = max(1, page)
        page_size = max(1, min(100, page_size))
        skip = (page - 1) * page_size

        query = {} if is_admin else {"user_id": user_id}

        active_db = mongodb.get_database()
        if active_db is not None:
            try:
                total = await active_db["ai_workflows"].count_documents(query)
                cursor = active_db["ai_workflows"].find(query).sort("created_at", -1).skip(skip).limit(page_size)
                items = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    doc["persisted_durably"] = True
                    doc["persistence_tier"] = "atlas"
                    items.append(doc)
                return {
                    "items": items,
                    "total": total,
                    "page": page,
                    "page_size": page_size,
                }
            except Exception as e:
                logger.warning("MongoDB Atlas list_workflows failed: %s", e)

        with self._lock:
            all_wfs = [
                dict(w) for w in self._memory_workflows.values()
                if is_admin or w.get("user_id") == user_id
            ]
            all_wfs.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            total = len(all_wfs)
            items = all_wfs[skip:skip + page_size]
            for it in items:
                if "persisted_durably" not in it:
                    it["persisted_durably"] = False
                    it["persistence_tier"] = "ephemeral_session"
            return {
                "items": items,
                "total": total,
                "page": page,
                "page_size": page_size,
            }

workflow_repository = WorkflowRepository()
