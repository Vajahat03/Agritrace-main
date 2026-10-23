from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, status
from pydantic import BaseModel, Field, ConfigDict
from ....core.security import require_role, AuthenticatedUser
from ....repositories.farmer_repository import farmer_repository
from ....repositories.user_repository import user_repository
from ....core.exceptions import AgriTraceAPIException

router = APIRouter()

class CreateBatchRequest(BaseModel):
    batchCode: Optional[str] = Field(None, alias="batch_code")
    cropType: str = Field(..., alias="crop_type", min_length=1)
    variety: str = "Standard"
    initialQuantity: float = Field(..., alias="initial_quantity", gt=0)
    currentQuantity: Optional[float] = Field(None, alias="current_quantity")
    unit: str = "kg"
    harvestDate: str = Field(..., alias="harvest_date", min_length=1)
    qualityGrade: Optional[str] = Field("A", alias="quality_grade")
    farmLocation: Optional[str] = Field(None, alias="farm_location")

    model_config = ConfigDict(populate_by_name=True)

class CreateCropRequest(BaseModel):
    cropType: str = Field(..., alias="crop_type", min_length=1)
    variety: str = "Standard"
    area: float = Field(1.0, gt=0)
    areaUnit: str = Field("acres", alias="area_unit")
    plantingDate: str = Field(..., alias="planting_date", min_length=1)
    expectedHarvestDate: Optional[str] = Field(None, alias="expected_harvest_date")
    farmId: Optional[str] = Field(None, alias="farm_id")

    model_config = ConfigDict(populate_by_name=True)

class CreateFarmRequest(BaseModel):
    name: str = Field(..., min_length=1)
    locationName: str = Field(..., alias="location_name", min_length=1)
    totalArea: float = Field(..., alias="total_area", gt=0)
    areaUnit: str = Field("acres", alias="area_unit")
    address: Optional[str] = None
    soilInfo: Optional[str] = Field(None, alias="soil_info")

    model_config = ConfigDict(populate_by_name=True)

class CreateFertilizerRequest(BaseModel):
    fertilizerName: str = Field(..., alias="fertilizer_name", min_length=1)
    fertilizerType: str = Field("NPK", alias="fertilizer_type")
    applicationDate: str = Field(..., alias="application_date", min_length=1)
    quantity: float = Field(..., gt=0)
    unit: str = "kg"
    method: str = "SOIL"
    nValue: Optional[float] = Field(None, alias="n_value")
    pValue: Optional[float] = Field(None, alias="p_value")
    kValue: Optional[float] = Field(None, alias="k_value")
    cost: Optional[float] = 0.0
    supplier: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class UpdateFertilizerRequest(BaseModel):
    fertilizerName: Optional[str] = Field(None, alias="fertilizer_name")
    fertilizerType: Optional[str] = Field(None, alias="fertilizer_type")
    applicationDate: Optional[str] = Field(None, alias="application_date")
    quantity: Optional[float] = Field(None, gt=0)
    unit: Optional[str] = None
    method: Optional[str] = None
    nValue: Optional[float] = Field(None, alias="n_value")
    pValue: Optional[float] = Field(None, alias="p_value")
    kValue: Optional[float] = Field(None, alias="k_value")
    cost: Optional[float] = None
    supplier: Optional[str] = None
    notes: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

@router.get("/dashboard", tags=["Farmer Portal"])
async def get_farmer_dashboard(current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"]))):
    """
    Farmer dashboard overview and operational metrics.
    """
    farms = await farmer_repository.get_farms(current_user.uid)
    crops = await farmer_repository.get_crops(current_user.uid)
    batches = await farmer_repository.get_batches(current_user.uid)

    return {
        "success": True,
        "data": {
            "metrics": {
                "totalFarms": len(farms),
                "totalActiveCrops": len(crops),
                "harvestReadyCrops": len([c for c in crops if c.get("status") == "READY_FOR_HARVEST"]),
                "activeBatches": len(batches),
                "unreadAlerts": 0,
            },
            "farms": farms,
            "crops": crops,
            "batches": batches,
            "activeCrops": crops,
            "recentBatches": batches,
        },
    }

@router.get("/vendors", tags=["Farmer Portal - Vendor Directory"])
async def list_vendors_for_farmer(
    search: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    crop: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Public verified vendors directory viewable by farmers for direct procurement.
    Supports search by name, godown, mobile, location; filters by state, district, city, business type, crop; pagination.
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

@router.get("/vendors/{vendor_id}", tags=["Farmer Portal - Vendor Directory"])
async def get_vendor_details(
    vendor_id: str,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Public profile, godown details, product interests, and available stock of a specific registered vendor.
    """
    vendor = await user_repository.get_vendor_details(vendor_id)
    if not vendor:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Vendor with id '{vendor_id}' was not found.",
        )

    return {"success": True, "data": vendor}

@router.get("/batches", tags=["Farmer Portal - Harvest & Produce Batches"])
async def get_my_batches(current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"]))):
    """
    Harvested produce batches and traceability codes for the authenticated farmer.
    """
    batches = await farmer_repository.get_batches(current_user.uid)
    return {
        "success": True,
        "data": batches,
    }

@router.post("/batches", tags=["Farmer Portal - Harvest & Produce Batches"])
async def create_my_batch(
    payload: CreateBatchRequest,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Mints a new harvest produce batch with a unique QR verification code.
    Associates the batch strictly with the authenticated farmer UID.
    """
    batch_data = {
        "batch_code": payload.batchCode,
        "crop_type": payload.cropType,
        "variety": payload.variety,
        "initial_quantity": payload.initialQuantity,
        "current_quantity": payload.currentQuantity if payload.currentQuantity is not None else payload.initialQuantity,
        "unit": payload.unit,
        "harvest_date": payload.harvestDate,
        "quality_grade": payload.qualityGrade or "A",
        "farm_location": payload.farmLocation,
    }
    created = await farmer_repository.create_batch(current_user.uid, batch_data)
    return {
        "success": True,
        "data": created,
        "message": "Harvest produce batch minted successfully.",
    }

@router.get("/crops", tags=["Farmer Portal - Crops"])
async def get_my_crops(
    status: Optional[str] = None,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Active crops and standing field inventory for the authenticated farmer.
    Supports optional status filtering (e.g. GROWING, READY_FOR_HARVEST).
    """
    crops = await farmer_repository.get_crops(current_user.uid, status=status)
    return {
        "success": True,
        "data": crops,
    }

@router.post("/crops", tags=["Farmer Portal - Crops"])
async def create_my_crop(
    payload: CreateCropRequest,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Creates an active crop standing field record for the authenticated farmer.
    Validates farm ownership if farmId is provided.
    """
    if payload.farmId:
        farms = await farmer_repository.get_farms(current_user.uid)
        valid_farm_ids = {f.get("id") for f in farms}
        if payload.farmId not in valid_farm_ids:
            raise AgriTraceAPIException(
                status_code=status.HTTP_400_BAD_REQUEST,
                code="INVALID_FARM_OWNERSHIP",
                message=f"Farm '{payload.farmId}' does not belong to the authenticated farmer.",
            )

    crop_data = {
        "crop_type": payload.cropType,
        "variety": payload.variety,
        "area": payload.area,
        "area_unit": payload.areaUnit,
        "planting_date": payload.plantingDate,
        "expected_harvest_date": payload.expectedHarvestDate,
        "farm_id": payload.farmId,
        "status": "GROWING",
    }
    created = await farmer_repository.create_crop(current_user.uid, crop_data)
    return {
        "success": True,
        "data": created,
        "message": "Crop standing record created successfully.",
    }

@router.get("/crops/{crop_id}", tags=["Farmer Portal - Crops"])
async def get_crop_details(
    crop_id: str,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Detailed view of a single crop including field holdings and fertilizer application history.
    """
    crop = await farmer_repository.get_crop(current_user.uid, crop_id)
    if not crop:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Crop with id '{crop_id}' was not found.",
        )
    fertilizers = await farmer_repository.get_fertilizers(current_user.uid, crop_id)
    total_cost = sum(float(f.get("cost") or 0) for f in fertilizers)
    total_qty = sum(float(f.get("quantity") or 0) for f in fertilizers)
    crop_data = dict(crop)
    crop_data["fertilizerHistory"] = {
        "records": fertilizers,
        "totalCost": total_cost,
        "totalQuantity": total_qty,
    }
    return {
        "success": True,
        "data": crop_data,
    }

@router.get("/crops/{crop_id}/fertilizers", tags=["Farmer Portal - Fertilizers"])
async def list_crop_fertilizers(
    crop_id: str,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Lists historical fertilizer applications for a specific crop.
    Validates crop ownership.
    """
    crop = await farmer_repository.get_crop(current_user.uid, crop_id)
    if not crop:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Crop with id '{crop_id}' was not found.",
        )
    fertilizers = await farmer_repository.get_fertilizers(current_user.uid, crop_id)
    return {
        "success": True,
        "data": fertilizers,
    }

@router.post("/crops/{crop_id}/fertilizers", status_code=status.HTTP_201_CREATED, tags=["Farmer Portal - Fertilizers"])
async def add_crop_fertilizer(
    crop_id: str,
    payload: CreateFertilizerRequest,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Records a historical fertilizer application for a specific crop.
    Validates crop ownership before persisting.
    """
    crop = await farmer_repository.get_crop(current_user.uid, crop_id)
    if not crop:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Crop with id '{crop_id}' was not found.",
        )

    fert_data = {
        "fertilizer_name": payload.fertilizerName,
        "fertilizer_type": payload.fertilizerType,
        "application_date": payload.applicationDate,
        "quantity": payload.quantity,
        "unit": payload.unit,
        "method": payload.method,
        "n_value": payload.nValue,
        "p_value": payload.pValue,
        "k_value": payload.kValue,
        "cost": payload.cost or 0.0,
        "supplier": payload.supplier,
        "notes": payload.notes,
    }
    created = await farmer_repository.create_fertilizer(current_user.uid, crop_id, fert_data)
    return {
        "success": True,
        "data": created,
        "message": "Fertilizer application logged successfully.",
    }

@router.patch("/crops/{crop_id}/fertilizers/{fertilizer_id}", tags=["Farmer Portal - Fertilizers"])
async def update_crop_fertilizer(
    crop_id: str,
    fertilizer_id: str,
    payload: UpdateFertilizerRequest,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Updates an existing historical fertilizer application.
    Validates crop and record ownership.
    """
    crop = await farmer_repository.get_crop(current_user.uid, crop_id)
    if not crop:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Crop with id '{crop_id}' was not found.",
        )

    existing = await farmer_repository.get_fertilizer(current_user.uid, fertilizer_id)
    if not existing or existing.get("crop_id") != crop_id:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Fertilizer record with id '{fertilizer_id}' was not found.",
        )

    updates = {}
    if payload.fertilizerName is not None:
        updates["fertilizer_name"] = payload.fertilizerName
    if payload.fertilizerType is not None:
        updates["fertilizer_type"] = payload.fertilizerType
    if payload.applicationDate is not None:
        updates["application_date"] = payload.applicationDate
    if payload.quantity is not None:
        updates["quantity"] = payload.quantity
    if payload.unit is not None:
        updates["unit"] = payload.unit
    if payload.method is not None:
        updates["method"] = payload.method
    if payload.nValue is not None:
        updates["n_value"] = payload.nValue
    if payload.pValue is not None:
        updates["p_value"] = payload.pValue
    if payload.kValue is not None:
        updates["k_value"] = payload.kValue
    if payload.cost is not None:
        updates["cost"] = payload.cost
    if payload.supplier is not None:
        updates["supplier"] = payload.supplier
    if payload.notes is not None:
        updates["notes"] = payload.notes

    updated = await farmer_repository.update_fertilizer(current_user.uid, fertilizer_id, updates)
    return {
        "success": True,
        "data": updated,
        "message": "Fertilizer application record updated successfully.",
    }

@router.delete("/crops/{crop_id}/fertilizers/{fertilizer_id}", tags=["Farmer Portal - Fertilizers"])
async def delete_crop_fertilizer(
    crop_id: str,
    fertilizer_id: str,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Deletes a historical fertilizer application record.
    Validates crop and record ownership.
    """
    crop = await farmer_repository.get_crop(current_user.uid, crop_id)
    if not crop:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Crop with id '{crop_id}' was not found.",
        )

    existing = await farmer_repository.get_fertilizer(current_user.uid, fertilizer_id)
    if not existing or existing.get("crop_id") != crop_id:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Fertilizer record with id '{fertilizer_id}' was not found.",
        )

    await farmer_repository.delete_fertilizer(current_user.uid, fertilizer_id)
    return {
        "success": True,
        "message": "Fertilizer record removed successfully.",
    }

@router.get("/farms", tags=["Farmer Portal - Farms"])
async def get_my_farms(current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"]))):
    """
    Farm plots and geolocation credentials for the authenticated farmer.
    """
    farms = await farmer_repository.get_farms(current_user.uid)
    return {
        "success": True,
        "data": farms,
    }

@router.post("/farms", tags=["Farmer Portal - Farms"])
async def create_my_farm(
    payload: CreateFarmRequest,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "ADMIN"])),
):
    """
    Creates a new farm plot for the authenticated farmer.
    """
    farm_data = {
        "name": payload.name,
        "location_name": payload.locationName,
        "total_area": payload.totalArea,
        "area_unit": payload.areaUnit,
        "address": payload.address,
        "soil_info": payload.soilInfo,
    }
    created = await farmer_repository.create_farm(current_user.uid, farm_data)
    return {
        "success": True,
        "data": created,
        "message": "Farm plot registered successfully.",
    }

@router.get("/vendors", tags=["Farmer Portal - Vendors Directory"])
async def get_vendors_directory_for_farmer(
    search: Optional[str] = None,
    state: Optional[str] = None,
    district: Optional[str] = None,
    city: Optional[str] = None,
    business_type: Optional[str] = None,
    crop: Optional[str] = None,
    page: int = 1,
    page_size: int = 12,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "VENDOR", "ADMIN", "CUSTOMER"])),
):
    """
    Public directory of registered vendors viewable by farmers for produce sale and contracts.
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

@router.get("/vendors/{vendor_id}", tags=["Farmer Portal - Vendors Directory"])
async def get_vendor_details_for_farmer(
    vendor_id: str,
    current_user: AuthenticatedUser = Depends(require_role(["FARMER", "VENDOR", "ADMIN", "CUSTOMER"])),
):
    """
    Profile and active product interests of a specific registered vendor.
    """
    vendor = await user_repository.get_vendor_details(vendor_id)
    if not vendor:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="NOT_FOUND",
            message=f"Vendor with id '{vendor_id}' was not found.",
        )
    return {"success": True, "data": vendor}
