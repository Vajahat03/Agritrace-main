from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from ....core.security import require_role, get_current_user, AuthenticatedUser
from ....repositories.user_repository import user_repository
from ....repositories.farmer_repository import farmer_repository
from ....repositories.smartbag_repository import smartbag_repository
from ....services.reminder_service import reminder_service
from ....core.exceptions import AgriTraceAPIException

router = APIRouter()

def _map_to_freshness_bag_item(batch: Dict[str, Any]) -> Dict[str, Any]:
    latest_scan = {
        "id": batch.get("scan_id") or f"scan-{batch['batch_id']}",
        "bag_id": batch["batch_id"],
        "customer_id": batch["user_id"],
        "image_url": batch.get("image_url"),
        "scan_date": batch.get("prediction_date", batch.get("created_at")),
        "freshness_score": float(batch.get("freshness_score", 85.0)),
        "remaining_shelf_life_days": float(batch.get("days_remaining", batch.get("predicted_shelf_life_days", 4.0))),
        "predicted_use_by_date": batch.get("predicted_use_by_date"),
        "prediction_interval_lower_days": round(max(0.5, float(batch.get("days_remaining", 4.0)) - 1.2), 1),
        "prediction_interval_upper_days": round(float(batch.get("days_remaining", 4.0)) + 1.5, 1),
        "model_name": "AgriTrace-ShelfLife-XGB-v1.0",
        "model_version": "1.0.0",
    }
    return {
        "id": batch["batch_id"],
        "customer_id": batch["user_id"],
        "produce_name": batch["produce_name"],
        "crop_type": batch["crop_type"],
        "current_status": batch["current_status"],
        "storage_recommendation": batch.get("storage_recommendation"),
        "created_at": batch["created_at"],
        "updated_at": batch["updated_at"],
        "latest_scan": latest_scan,
        "scan_history": [latest_scan],
    }

@router.get("/dashboard", tags=["Customer Portal"])
async def get_customer_dashboard(current_user: AuthenticatedUser = Depends(require_role(["CUSTOMER", "ADMIN"]))):
    """
    Customer portal overview metrics and stored produce items.
    """
    try:
        res = await smartbag_repository.list_batches(
            user_id=current_user.uid,
            status_filter="ACTIVE",
            page=1,
            page_size=50,
            is_admin=current_user.role == "ADMIN",
        )
        mapped = [_map_to_freshness_bag_item(b) for b in res["items"]]
        active_count = len(mapped)
        expiring_soon = sum(
            1 for item in mapped
            if (item.get("latest_scan", {}).get("remaining_shelf_life_days") or 5) <= 2
        )
    except Exception:
        mapped = []
        active_count = 0
        expiring_soon = 0

    return {
        "success": True,
        "data": {
            "metrics": {
                "totalOrders": 4,
                "savedFavorites": 6,
                "activeFreshnessItems": active_count,
                "itemsExpiringSoon": expiring_soon,
            },
            "orders": [],
            "freshnessBag": mapped,
        },
    }

@router.get("/farmers", tags=["Customer Portal - Directory"])
async def list_farmers_for_customer(
    search: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    crop: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
):
    """
    Public directory of registered verified farmers viewable by customers for farm-to-table transparency.
    """
    directory = await user_repository.get_farmers_directory(
        search=search,
        state=state,
        district=district,
        city=city,
        crop=crop,
        page=page,
        page_size=page_size,
    )
    return {
        "success": True,
        "data": directory["items"],
        "meta": {
            "total": directory["total"],
            "page": directory["page"],
            "page_size": directory["page_size"],
        },
    }

@router.get("/vendors", tags=["Customer Portal - Directory"])
async def list_vendors_for_customer(
    search: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    crop: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
):
    """
    Public directory of registered vendors viewable by customers.
    """
    directory = await user_repository.get_vendors_directory(
        search=search,
        state=state,
        district=district,
        city=city,
        business_type=business_type,
        crop=crop,
        page=page,
        page_size=page_size,
    )
    return {
        "success": True,
        "data": directory["items"],
        "meta": {
            "total": directory["total"],
            "page": directory["page"],
            "page_size": directory["page_size"],
        },
    }

@router.get("/vendors/{vendor_id}", tags=["Customer Portal - Directory"])
async def get_vendor_details_for_customer(vendor_id: str):
    """
    Public profile and product catalog of a specific registered vendor.
    """
    vendor = await user_repository.get_vendor_details(vendor_id)
    if not vendor:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Vendor with id '{vendor_id}' was not found.",
        )
    return {"success": True, "data": vendor}

@router.get("/farmers/{farmer_id}", tags=["Customer Portal - Directory"])
async def get_farmer_details_for_customer(farmer_id: str):
    """
    Public profile, farm plots, and crop details of a specific registered farmer.
    """
    farmer = await user_repository.get_farmer_details(farmer_id)
    if not farmer:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Farmer with id '{farmer_id}' was not found.",
        )
    return {"success": True, "data": farmer}

@router.get("/batches/{batch_code}", tags=["Traceability - Public Verification"])
async def get_batch_traceability(batch_code: str):
    """
    Public traceability verification endpoint.
    Retrieves farm origin, harvest date, and produce details by batch code.
    """
    batch = await farmer_repository.get_batch_by_code(batch_code)
    if not batch:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Produce batch with code '{batch_code}' was not found in the immutable ledger.",
        )
    return {
        "success": True,
        "data": batch,
    }

@router.get("/freshness-bag", tags=["Customer Portal - Freshness Bag"])
async def list_customer_freshness_bag(
    status: Optional[str] = "ACTIVE",
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves user's Freshness Bag items stored in MongoDB Atlas.
    """
    res = await smartbag_repository.list_batches(
        user_id=current_user.uid,
        status_filter=status,
        page=1,
        page_size=100,
        is_admin=current_user.role == "ADMIN",
    )
    mapped = [_map_to_freshness_bag_item(b) for b in res["items"]]
    return {
        "success": True,
        "data": mapped,
        "meta": {
            "total": res["total"],
            "active_count": res["active_count"],
        },
    }

@router.post("/freshness-bag", status_code=status.HTTP_201_CREATED, tags=["Customer Portal - Freshness Bag"])
async def add_customer_freshness_bag_item(
    payload: Dict[str, Any],
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Adds produce to user's Freshness Bag.
    """
    created = await smartbag_repository.create_batch(current_user.uid, {
        "produce_name": payload.get("produceName") or payload.get("produce_name") or "Roma Tomatoes",
        "crop_type": payload.get("cropType") or payload.get("crop_type") or "tomato",
        "image_url": payload.get("imageUrl") or payload.get("image_url"),
        "freshness_score": float(payload.get("freshnessScore") or payload.get("freshness_score") or 90.0),
        "quality_score": float(payload.get("freshnessScore") or payload.get("freshness_score") or 90.0),
        "predicted_shelf_life_days": float(payload.get("remainingShelfLifeDays") or payload.get("remaining_shelf_life_days") or 5.0),
        "predicted_use_by_date": payload.get("predictedUseByDate") or payload.get("predicted_use_by_date"),
        "storage_recommendation": payload.get("storageRecommendation") or payload.get("storage_recommendation"),
        "quantity_kg": float(payload.get("quantityKg") or payload.get("quantity_kg") or 0.5),
    })
    await reminder_service.schedule_batch_reminders(current_user.uid, created)
    return {
        "success": True,
        "data": _map_to_freshness_bag_item(created),
    }

@router.delete("/freshness-bag/{batch_id}", tags=["Customer Portal - Freshness Bag"])
async def remove_customer_freshness_bag_item(
    batch_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Removes item from Freshness Bag.
    """
    await smartbag_repository.delete_batch(current_user.uid, batch_id, is_admin=current_user.role == "ADMIN")
    await reminder_service.cancel_batch_reminders(current_user.uid, batch_id)
    return {
        "success": True,
        "message": f"Item '{batch_id}' removed from Freshness Bag.",
    }

# Aliases for Customer Farm Produce Storage
@router.get("/produce", tags=["Customer Portal - Farm Produce Storage"])
async def list_customer_produce(
    status: Optional[str] = "ACTIVE",
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return await list_customer_freshness_bag(status=status, current_user=current_user)

@router.post("/produce", status_code=status.HTTP_201_CREATED, tags=["Customer Portal - Farm Produce Storage"])
async def store_customer_produce(
    payload: Dict[str, Any],
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return await add_customer_freshness_bag_item(payload=payload, current_user=current_user)

@router.delete("/produce/{batch_id}", tags=["Customer Portal - Farm Produce Storage"])
async def delete_customer_produce(
    batch_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    return await remove_customer_freshness_bag_item(batch_id=batch_id, current_user=current_user)

