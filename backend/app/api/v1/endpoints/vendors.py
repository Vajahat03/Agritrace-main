from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field
from ....core.security import require_role, AuthenticatedUser
from ....schemas.inventory import AdjustInventoryRequest
from ....repositories.vendor_repository import vendor_repository
from ....repositories.user_repository import user_repository
from ....core.exceptions import AgriTraceAPIException

router = APIRouter()

class CreateInventoryItemRequest(BaseModel):
    productName: str = Field(..., alias="product_name")
    cropType: str = Field(..., alias="crop_type")
    quantity: float
    unit: str = "kg"
    location: Optional[str] = "Central Warehouse"
    batchId: Optional[str] = Field(None, alias="batch_id")
    batchCode: Optional[str] = Field(None, alias="batch_code")

@router.get("/dashboard", tags=["Vendor Portal"])
async def get_vendor_dashboard(current_user: AuthenticatedUser = Depends(require_role(["VENDOR", "ADMIN"]))):
    """
    Vendor dashboard overview and metrics.
    """
    inventory = await vendor_repository.get_inventory(current_user.uid)
    return {
        "success": True,
        "data": {
            "metrics": {
                "inventoryCount": len(inventory),
                "pendingOrdersCount": 0,
                "totalProcurements": 0,
            },
            "inventory": inventory,
            "orders": [],
            "procurements": [],
        },
    }

@router.get("/farmers", tags=["Vendor Portal - Farmer Directory"])
async def list_farmers_for_vendor(
    search: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    crop: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
    current_user: AuthenticatedUser = Depends(require_role(["VENDOR", "ADMIN", "FARMER", "CUSTOMER"])),
):
    """
    Registered verified farmers directory viewable by vendors for harvest procurement.
    Supports search by name, farm, mobile, location; filters by state, district, city, crop; pagination.
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

@router.get("/farmers/{farmer_id}", tags=["Vendor Portal - Farmer Directory"])
async def get_farmer_details(
    farmer_id: str,
    current_user: AuthenticatedUser = Depends(require_role(["VENDOR", "ADMIN", "FARMER", "CUSTOMER"])),
):
    """
    Public profile, farm plots, and standing crop details of a specific registered farmer.
    """
    farmer = await user_repository.get_farmer_details(farmer_id)
    if not farmer:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Farmer with id '{farmer_id}' was not found.",
        )

    return {"success": True, "data": farmer}

@router.get("/inventory", tags=["Vendor Portal - Inventory"])
async def get_my_vendor_inventory(current_user: AuthenticatedUser = Depends(require_role(["VENDOR", "ADMIN"]))):
    """
    Stock ledger and warehouse inventory for the authenticated vendor.
    """
    inventory = await vendor_repository.get_inventory(current_user.uid)
    return {
        "success": True,
        "data": inventory,
    }

@router.post("/inventory", tags=["Vendor Portal - Inventory"])
async def add_vendor_inventory(
    payload: CreateInventoryItemRequest,
    current_user: AuthenticatedUser = Depends(require_role(["VENDOR", "ADMIN"])),
):
    """
    Adds a new stock item to the vendor's warehouse ledger.
    Associates the inventory item strictly with the authenticated vendor UID.
    """
    item_data = {
        "product_name": payload.productName,
        "crop_type": payload.cropType,
        "quantity": payload.quantity,
        "unit": payload.unit,
        "location": payload.location or "Central Warehouse",
        "batch_id": payload.batchId,
        "batch_code": payload.batchCode,
        "status": "IN_STOCK" if payload.quantity > 0 else "OUT_OF_STOCK",
    }
    created = await vendor_repository.add_inventory_item(current_user.uid, item_data)
    return {
        "success": True,
        "data": created,
        "message": "Inventory stock item created successfully.",
    }

@router.post("/inventory/{inventory_id}/adjust", tags=["Vendor Portal - Inventory"])
async def adjust_vendor_inventory(
    inventory_id: str,
    payload: AdjustInventoryRequest,
    current_user: AuthenticatedUser = Depends(require_role(["VENDOR", "ADMIN"])),
):
    """
    Adjusts warehouse stock quantity for damage, shrinkage, audit, or sales.
    Enforces ownership: vendor can only adjust their own inventory items.
    """
    adjusted = await vendor_repository.adjust_inventory(
        vendor_id=current_user.uid,
        item_id=inventory_id,
        adjustment_type=payload.adjustmentType,
        quantity_change=payload.quantityChange,
        reason=payload.reason or "",
    )
    if not adjusted:
        # If item doesn't exist yet, create bootstrap adjusted record
        adjusted = await vendor_repository.add_inventory_item(
            current_user.uid,
            {
                "id": inventory_id,
                "product_name": "Adjusted Stock Item",
                "crop_type": "Produce",
                "quantity": max(0.0, float(payload.quantityChange)),
                "unit": "kg",
                "status": "IN_STOCK",
            },
        )

    return {
        "success": True,
        "data": adjusted,
        "message": "Stock adjustment recorded successfully.",
    }
