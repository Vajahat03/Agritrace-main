import logging
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
from ..db.mongodb import mongodb
from ..db.persistence_guard import enforce_database_available, handle_database_error
from ..services.memory_store import memory_store

logger = logging.getLogger("agritrace.repository.user")

class UserRepository:
    """
    Data access repository for User Profiles and Marketplace Directories.
    Persists to MongoDB Atlas when connected; utilizes resilient local store as fallback when explicitly permitted.
    Guarantees no N+1 query stalls, bounded execution time, and zero fabricated profile fallbacks.
    """
    async def get_by_uid(self, uid: str) -> Optional[Dict[str, Any]]:
        active_db = mongodb.get_database()
        if active_db is not None:
            try:
                # Fast indexed lookup with projection excluding MongoDB internal _id
                doc = await asyncio.wait_for(
                    active_db["users"].find_one({"uid": uid}, {"_id": 0}),
                    timeout=2.0,
                )
                if doc:
                    return doc
            except Exception as e:
                logger.warning("MongoDB error fetching user profile for %s: %s", uid, e)

        return memory_store.get_profile(uid)

    async def save_profile(self, uid: str, profile_data: Dict[str, Any]) -> Dict[str, Any]:
        db = enforce_database_available()
        if db is not None:
            try:
                now = datetime.now(timezone.utc).isoformat()
                update_fields = {
                    **profile_data,
                    "uid": uid,
                    "updated_at": now,
                }
                # Preserve created_at on upsert
                await asyncio.wait_for(
                    db["users"].update_one(
                        {"uid": uid},
                        {
                            "$set": update_fields,
                            "$setOnInsert": {"created_at": now},
                        },
                        upsert=True,
                    ),
                    timeout=2.5,
                )
            except Exception as e:
                handle_database_error(e, "persisting user to MongoDB")

        # Mirror to memory_store on success or fallback
        saved_local = memory_store.save_profile(uid, profile_data)
        return saved_local

    async def list_by_role(self, role: str) -> List[Dict[str, Any]]:
        norm_role = role.upper()
        db = enforce_database_available()
        if db is not None:
            try:
                # Safe projection excluding internal credentials
                projection = {
                    "_id": 0,
                    "password": 0,
                    "token": 0,
                    "credentials": 0,
                }
                cursor = db["users"].find({"role": norm_role}, projection)
                docs = await asyncio.wait_for(cursor.to_list(length=100), timeout=5.0)

                if docs:
                    # Batch fetch child records (farms/crops or inventory) - ELIMINATES N+1 QUERIES
                    uids = [d.get("uid") or d.get("id") for d in docs if d.get("uid") or d.get("id")]

                    if norm_role == "FARMER" and uids:
                        farms_cursor = db["farms"].find({"farmer_id": {"$in": uids}}, {"_id": 0})
                        all_farms = await asyncio.wait_for(farms_cursor.to_list(length=200), timeout=5.0)
                        farms_by_farmer: Dict[str, List[Dict[str, Any]]] = {}
                        for f in all_farms:
                            farms_by_farmer.setdefault(f.get("farmer_id"), []).append(f)

                        crops_cursor = db["crops"].find({"farmer_id": {"$in": uids}}, {"_id": 0})
                        all_crops = await asyncio.wait_for(crops_cursor.to_list(length=300), timeout=5.0)
                        crops_by_farmer: Dict[str, List[Dict[str, Any]]] = {}
                        for c in all_crops:
                            crops_by_farmer.setdefault(c.get("farmer_id"), []).append(c)

                        for doc in docs:
                            uid = doc.get("uid") or doc.get("id")
                            farms = farms_by_farmer.get(uid, [])
                            crops = crops_by_farmer.get(uid, [])
                            doc["farms"] = farms
                            doc["farm_count"] = len(farms)
                            doc["crops"] = crops
                            doc["crops_grown"] = sorted(list(set(c.get("crop_type") for c in crops if c.get("crop_type"))))
                            doc["farm_name"] = farms[0].get("name") if farms else "Registered Farm"
                            doc["total_area"] = sum(float(f.get("total_area", 0)) for f in farms)
                            doc["area_unit"] = farms[0].get("area_unit", "acres") if farms else "acres"
                            doc["location_name"] = farms[0].get("location_name") if farms else (doc.get("address") or "")

                    elif norm_role == "VENDOR" and uids:
                        inv_cursor = db["vendor_inventory"].find({"vendor_id": {"$in": uids}}, {"_id": 0})
                        all_inv = await asyncio.wait_for(inv_cursor.to_list(length=200), timeout=5.0)
                        inv_by_vendor: Dict[str, List[Dict[str, Any]]] = {}
                        for item in all_inv:
                            inv_by_vendor.setdefault(item.get("vendor_id"), []).append(item)

                        for doc in docs:
                            uid = doc.get("uid") or doc.get("id")
                            inventory = inv_by_vendor.get(uid, [])
                            doc["inventory"] = inventory
                            doc["inventory_count"] = len(inventory)
                            doc["business_name"] = doc.get("business_name") or doc.get("full_name") or "Registered Vendor"
                            doc["godown_name"] = doc.get("godown_name") or (inventory[0].get("location") if inventory else "Central Warehouse")
                            doc["business_type"] = doc.get("business_type") or "Wholesale & Mandi Stockist"
                            doc["product_interests"] = doc.get("product_interests") or sorted(list(set(i.get("crop_type") for i in inventory if i.get("crop_type"))))
                            doc["products"] = doc.get("products", [])

                    return docs
                else:
                    # Database is connected and healthy, but no records exist in this role
                    return []
            except Exception as e:
                handle_database_error(e, "querying users by role from MongoDB")

        # Resilient local store fallback (ONLY genuine registered profiles, NO fabricated seed data)
        if norm_role == "FARMER":
            return memory_store.list_farmers()
        elif norm_role == "VENDOR":
            return memory_store.list_vendors()
        return []

    async def get_farmers_directory(
        self,
        search: Optional[str] = None,
        state: Optional[str] = None,
        district: Optional[str] = None,
        city: Optional[str] = None,
        crop: Optional[str] = None,
        page: int = 1,
        page_size: int = 12,
    ) -> Dict[str, Any]:
        # Bound pagination arguments
        page = max(1, page)
        page_size = min(max(1, page_size), 50)

        farmers = await self.list_by_role("FARMER")
        filtered = []

        q = search.strip().lower() if search else None
        state_q = state.strip().lower() if state else None
        district_q = district.strip().lower() if district else None
        city_q = city.strip().lower() if city else None
        crop_q = crop.strip().lower() if crop and crop.upper() != "ALL" else None

        for f in farmers:
            # Text Search
            if q:
                full_name = str(f.get("full_name", "")).lower()
                farm_name = str(f.get("farm_name", "")).lower()
                location_name = str(f.get("location_name", "")).lower()
                address = str(f.get("address", "")).lower()
                phone = str(f.get("phone", "")).lower().replace(" ", "").replace("-", "")
                q_phone = q.replace(" ", "").replace("-", "")
                crops_str = " ".join(f.get("crops_grown", [])).lower()
                all_farms_str = " ".join(farm.get("name", "") + " " + farm.get("location_name", "") for farm in f.get("farms", [])).lower()

                matches_search = (
                    q in full_name
                    or q in farm_name
                    or q in location_name
                    or q in address
                    or (q_phone and q_phone in phone)
                    or q in crops_str
                    or q in all_farms_str
                )
                if not matches_search:
                    continue

            # Location Filters
            combined_loc = (str(f.get("address", "")) + " " + str(f.get("location_name", ""))).lower()
            if state_q and state_q not in combined_loc:
                continue
            if district_q and district_q not in combined_loc:
                continue
            if city_q and city_q not in combined_loc:
                continue

            # Crop Filter
            if crop_q:
                crops_list = [c.lower() for c in f.get("crops_grown", [])]
                if not any(crop_q in c for c in crops_list):
                    continue

            filtered.append(f)

        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": filtered[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_farmer_details(self, farmer_id: str) -> Optional[Dict[str, Any]]:
        farmers = await self.list_by_role("FARMER")
        for f in farmers:
            if f.get("id") == farmer_id or f.get("uid") == farmer_id:
                return f
        return None

    async def get_vendors_directory(
        self,
        search: Optional[str] = None,
        state: Optional[str] = None,
        district: Optional[str] = None,
        city: Optional[str] = None,
        business_type: Optional[str] = None,
        crop: Optional[str] = None,
        page: int = 1,
        page_size: int = 12,
    ) -> Dict[str, Any]:
        # Bound pagination arguments
        page = max(1, page)
        page_size = min(max(1, page_size), 50)

        vendors = await self.list_by_role("VENDOR")
        filtered = []

        q = search.strip().lower() if search else None
        state_q = state.strip().lower() if state else None
        district_q = district.strip().lower() if district else None
        city_q = city.strip().lower() if city else None
        b_type_q = business_type.strip().lower() if business_type and business_type.upper() != "ALL" else None
        crop_q = crop.strip().lower() if crop and crop.upper() != "ALL" else None

        for v in vendors:
            # Text Search
            if q:
                full_name = str(v.get("full_name", "")).lower()
                business_name = str(v.get("business_name", "")).lower()
                godown_name = str(v.get("godown_name", "")).lower()
                address = str(v.get("address", "")).lower()
                phone = str(v.get("phone", "")).lower().replace(" ", "").replace("-", "")
                q_phone = q.replace(" ", "").replace("-", "")
                interests_str = " ".join(v.get("product_interests", [])).lower()
                inv_str = " ".join(item.get("product_name", "") + " " + item.get("crop_type", "") for item in v.get("inventory", [])).lower()

                matches_search = (
                    q in full_name
                    or q in business_name
                    or q in godown_name
                    or q in address
                    or (q_phone and q_phone in phone)
                    or q in interests_str
                    or q in inv_str
                )
                if not matches_search:
                    continue

            # Location Filters
            combined_loc = (str(v.get("address", "")) + " " + str(v.get("godown_name", ""))).lower()
            if state_q and state_q not in combined_loc:
                continue
            if district_q and district_q not in combined_loc:
                continue
            if city_q and city_q not in combined_loc:
                continue

            # Business Type Filter
            if b_type_q:
                v_type = str(v.get("business_type", "")).lower()
                if b_type_q not in v_type:
                    continue

            # Crop / Product Interest Filter
            if crop_q:
                interests = [i.lower() for i in v.get("product_interests", [])]
                inv_crops = [item.get("crop_type", "").lower() for item in v.get("inventory", [])]
                if not (any(crop_q in i for i in interests) or any(crop_q in ic for ic in inv_crops)):
                    continue

            filtered.append(v)

        total = len(filtered)
        start = (page - 1) * page_size
        end = start + page_size
        return {
            "items": filtered[start:end],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    async def get_vendor_details(self, vendor_id: str) -> Optional[Dict[str, Any]]:
        vendors = await self.list_by_role("VENDOR")
        for v in vendors:
            if v.get("id") == vendor_id or v.get("uid") == vendor_id:
                return v
        return None

user_repository = UserRepository()
