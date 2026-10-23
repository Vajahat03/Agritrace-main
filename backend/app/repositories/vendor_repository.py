import logging
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from ..db.mongodb import mongodb
from ..db.persistence_guard import enforce_database_available, handle_database_error
from ..services.memory_store import memory_store

logger = logging.getLogger("agritrace.repository.vendor")

class VendorRepository:
    """
    Data access repository for Vendor Warehouse Inventory and Stock Adjustments.
    Enforces record ownership: vendors can only access and modify their own inventory.
    When Atlas is authoritative, operations fail-fast on unavailable database.
    """
    async def get_inventory(self, vendor_id: str) -> List[Dict[str, Any]]:
        db = enforce_database_available()
        if db is not None:
            try:
                cursor = db["vendor_inventory"].find({"vendor_id": vendor_id})
                items = []
                async for doc in cursor:
                    doc.pop("_id", None)
                    items.append(doc)
                if items:
                    return items
            except Exception as e:
                handle_database_error(e, "querying vendor inventory")

        return memory_store.get_vendor_inventory(vendor_id)

    async def add_inventory_item(self, vendor_id: str, item_data: Dict[str, Any]) -> Dict[str, Any]:
        item_id = item_data.get("id") or f"inv-{uuid.uuid4().hex[:8]}"
        now = datetime.now(timezone.utc).isoformat()
        doc = {
            **item_data,
            "id": item_id,
            "vendor_id": vendor_id,
            "status": item_data.get("status", "IN_STOCK"),
            "created_at": now,
            "updated_at": now,
        }

        db = enforce_database_available()
        if db is not None:
            try:
                await db["vendor_inventory"].insert_one({**doc})
            except Exception as e:
                handle_database_error(e, "saving inventory item")

        with memory_store._lock:
            existing = memory_store._vendor_inventories.get(vendor_id, [])
            existing.append(doc)
            memory_store._vendor_inventories[vendor_id] = existing
            memory_store._save()

        doc.pop("_id", None)
        return doc

    async def adjust_inventory(
        self,
        vendor_id: str,
        item_id: str,
        adjustment_type: str,
        quantity_change: float,
        reason: str = "",
    ) -> Optional[Dict[str, Any]]:
        """
        Adjusts inventory quantity and records an immutable audit record.
        Strictly enforces that item_id belongs to vendor_id.
        """
        now = datetime.now(timezone.utc).isoformat()
        adjustment_record = {
            "id": f"adj-{uuid.uuid4().hex[:8]}",
            "vendor_id": vendor_id,
            "inventory_id": item_id,
            "adjustment_type": adjustment_type,
            "quantity_change": quantity_change,
            "reason": reason,
            "created_at": now,
        }

        updated_item = None
        db = enforce_database_available()
        if db is not None:
            try:
                # 1. Update the inventory item owned by this vendor
                item_doc = await db["vendor_inventory"].find_one({"id": item_id, "vendor_id": vendor_id})
                if item_doc:
                    new_qty = max(0.0, float(item_doc.get("quantity", 0.0)) + float(quantity_change))
                    new_status = "OUT_OF_STOCK" if new_qty == 0 else ("LOW_STOCK" if new_qty < 10 else "IN_STOCK")
                    await db["vendor_inventory"].update_one(
                        {"id": item_id, "vendor_id": vendor_id},
                        {
                            "$set": {
                                "quantity": new_qty,
                                "status": new_status,
                                "updated_at": now,
                            }
                        },
                    )
                    # 2. Record audit trail
                    await db["inventory_adjustments"].insert_one(adjustment_record)

                    item_doc.pop("_id", None)
                    item_doc["quantity"] = new_qty
                    item_doc["status"] = new_status
                    item_doc["updated_at"] = now
                    updated_item = item_doc
            except Exception as e:
                handle_database_error(e, "performing inventory adjustment")

        # Mirror adjustment in memory_store on success or fallback
        local_updated = memory_store.adjust_inventory(
            vendor_id=vendor_id,
            item_id=item_id,
            adjustment_type=adjustment_type,
            quantity_change=quantity_change,
            reason=reason,
        )

        return updated_item or local_updated

vendor_repository = VendorRepository()
