import os
import json
import logging
import threading
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone

logger = logging.getLogger("agritrace.store")

class MemoryStore:
    """
    Thread-safe store for Phase 3 API contracts and session states with local disk persistence.
    Saves profiles, inventories, crops, and batches to JSON so restarts preserve user roles.
    NOTE: MongoDB Atlas durable persistence is scheduled for Phase 4.
    """
    def __init__(self, persistence_file: Optional[str] = None):
        self._lock = threading.Lock()
        if persistence_file:
            self._file_path = Path(persistence_file)
        else:
            base_dir = Path(__file__).resolve().parent.parent.parent
            self._file_path = base_dir / "data" / "store.json"

        self._profiles: Dict[str, Dict[str, Any]] = {}
        self._vendor_inventories: Dict[str, List[Dict[str, Any]]] = {}
        self._farmer_crops: Dict[str, List[Dict[str, Any]]] = {}
        self._farmer_batches: Dict[str, List[Dict[str, Any]]] = {}
        self._farmer_farms: Dict[str, List[Dict[str, Any]]] = {}
        self._fertilizer_applications: Dict[str, List[Dict[str, Any]]] = {}

        self._load()

    def _load(self):
        try:
            if self._file_path.is_file():
                with open(self._file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._profiles = data.get("profiles", {})
                    self._vendor_inventories = data.get("vendor_inventories", {})
                    self._farmer_crops = data.get("farmer_crops", {})
                    self._farmer_batches = data.get("farmer_batches", {})
                    self._farmer_farms = data.get("farmer_farms", {})
                    self._fertilizer_applications = data.get("fertilizer_applications", {})
                    logger.info("Loaded persisted AgriTrace store from %s with %d profiles", self._file_path, len(self._profiles))
                    return
        except Exception as e:
            logger.warning("Could not read persistence store at %s: %s", self._file_path, e)

        # Seed initial demo profiles if empty
        self._seed_defaults()

    def _seed_defaults(self):
        # Do not seed fabricated demo profiles.
        # Only authentic profiles registered through the application are stored.
        pass

    def _save(self):
        try:
            self._file_path.parent.mkdir(parents=True, exist_ok=True)
            temp_path = self._file_path.with_suffix(".tmp")
            data = {
                "profiles": self._profiles,
                "vendor_inventories": self._vendor_inventories,
                "farmer_crops": self._farmer_crops,
                "farmer_batches": self._farmer_batches,
                "farmer_farms": self._farmer_farms,
                "fertilizer_applications": self._fertilizer_applications,
            }
            with open(temp_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            temp_path.replace(self._file_path)
        except Exception as e:
            logger.warning("Could not persist AgriTrace store to disk: %s", e)

    def get_profile(self, uid: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            return self._profiles.get(uid)

    def save_profile(self, uid: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            existing = self._profiles.get(uid, {})
            merged = {**existing, **profile_data, "id": uid, "updated_at": datetime.now(timezone.utc).isoformat()}
            self._profiles[uid] = merged
            self._save()
            return merged

    def list_farmers(self) -> List[Dict[str, Any]]:
        with self._lock:
            farmers = []
            for uid, prof in self._profiles.items():
                if prof.get("role", "").upper() == "FARMER":
                    farms = self._farmer_farms.get(uid, [])
                    crops = self._farmer_crops.get(uid, [])
                    crops_grown = sorted(list(set(c.get("crop_type") for c in crops if c.get("crop_type"))))
                    farmers.append({
                        "id": uid,
                        "uid": uid,
                        "full_name": prof.get("full_name") or "Registered Farmer",
                        "phone": prof.get("phone"),
                        "address": prof.get("address"),
                        "farm_count": len(farms),
                        "farms": farms,
                        "crops": crops,
                        "crops_grown": crops_grown,
                        "farm_name": farms[0].get("name") if farms else None,
                        "total_area": sum(float(f.get("total_area", 0)) for f in farms),
                        "area_unit": farms[0].get("area_unit", "acres") if farms else None,
                        "location_name": farms[0].get("location_name") if farms else (prof.get("address") or None),
                    })
            return farmers

    def list_vendors(self) -> List[Dict[str, Any]]:
        with self._lock:
            vendors = []
            for uid, prof in self._profiles.items():
                if prof.get("role", "").upper() == "VENDOR":
                    inv = self._vendor_inventories.get(uid, [])
                    product_interests = prof.get("product_interests") or sorted(list(set(i.get("crop_type") for i in inv if i.get("crop_type"))))
                    vendors.append({
                        "id": uid,
                        "uid": uid,
                        "full_name": prof.get("full_name") or "Registered Vendor",
                        "business_name": prof.get("business_name") or prof.get("full_name") or "Registered Vendor",
                        "phone": prof.get("phone"),
                        "address": prof.get("address"),
                        "godown_name": prof.get("godown_name") or (inv[0].get("location") if inv else None),
                        "business_type": prof.get("business_type") or None,
                        "product_interests": product_interests,
                        "inventory_count": len(inv),
                        "inventory": inv,
                        "products": prof.get("products", []),
                    })
            return vendors

    def get_vendor_inventory(self, vendor_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return self._vendor_inventories.get(vendor_id, [])

    def adjust_inventory(self, vendor_id: str, item_id: str, adjustment_type: str, quantity_change: float, reason: str = "") -> Optional[Dict[str, Any]]:
        with self._lock:
            items = self._vendor_inventories.get(vendor_id, [])
            for item in items:
                if item.get("id") == item_id:
                    new_qty = max(0, item.get("quantity", 0) + quantity_change)
                    item["quantity"] = new_qty
                    item["updated_at"] = datetime.now(timezone.utc).isoformat()
                    self._save()
                    return item
            return None

    def get_farmer_batches(self, farmer_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return self._farmer_batches.get(farmer_id, [])

    def get_farmer_crops(self, farmer_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return self._farmer_crops.get(farmer_id, [])

    def get_farmer_farms(self, farmer_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            return self._farmer_farms.get(farmer_id, [])

    def save_farm(self, farmer_id: str, farm_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            existing = self._farmer_farms.get(farmer_id, [])
            existing.append(farm_data)
            self._farmer_farms[farmer_id] = existing
            self._save()
            return farm_data

    def save_crop(self, farmer_id: str, crop_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            existing = self._farmer_crops.get(farmer_id, [])
            existing.append(crop_data)
            self._farmer_crops[farmer_id] = existing
            self._save()
            return crop_data

    def get_crop_fertilizers(self, farmer_id: str, crop_id: str) -> List[Dict[str, Any]]:
        with self._lock:
            records = self._fertilizer_applications.get(farmer_id, [])
            return [r for r in records if r.get("crop_id") == crop_id]

    def get_fertilizer(self, farmer_id: str, fertilizer_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            for r in self._fertilizer_applications.get(farmer_id, []):
                if r.get("id") == fertilizer_id:
                    return r
            return None

    def save_fertilizer(self, farmer_id: str, fertilizer_data: Dict[str, Any]) -> Dict[str, Any]:
        with self._lock:
            existing = self._fertilizer_applications.get(farmer_id, [])
            existing.append(fertilizer_data)
            self._fertilizer_applications[farmer_id] = existing
            self._save()
            return fertilizer_data

    def update_fertilizer(self, farmer_id: str, fertilizer_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        with self._lock:
            records = self._fertilizer_applications.get(farmer_id, [])
            for i, r in enumerate(records):
                if r.get("id") == fertilizer_id:
                    merged = {**r, **updates, "updated_at": datetime.now(timezone.utc).isoformat()}
                    records[i] = merged
                    self._fertilizer_applications[farmer_id] = records
                    self._save()
                    return merged
            return None

    def delete_fertilizer(self, farmer_id: str, fertilizer_id: str) -> bool:
        with self._lock:
            records = self._fertilizer_applications.get(farmer_id, [])
            initial_len = len(records)
            records = [r for r in records if r.get("id") != fertilizer_id]
            if len(records) != initial_len:
                self._fertilizer_applications[farmer_id] = records
                self._save()
                return True
            return False

    def reset_for_tests(self):
        with self._lock:
            self._profiles.clear()
            self._vendor_inventories.clear()
            self._farmer_crops.clear()
            self._farmer_batches.clear()
            self._farmer_farms.clear()
            self._fertilizer_applications.clear()

memory_store = MemoryStore()

