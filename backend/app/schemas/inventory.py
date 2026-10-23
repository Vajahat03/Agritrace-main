from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class BatchSummary(BaseModel):
    batch_code: str
    quality_grade: Optional[str] = "Grade A"
    harvest_date: Optional[str] = None

class VendorInventoryItem(BaseModel):
    id: str
    vendor_id: str
    batch_id: Optional[str] = None
    product_name: str
    crop_type: str
    quantity: float
    unit: str
    status: str = "IN_STOCK"
    location: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None
    batch: Optional[BatchSummary] = None

class AdjustInventoryRequest(BaseModel):
    adjustmentType: str = Field(..., alias="adjustment_type")
    quantityChange: float = Field(..., alias="quantity_change")
    reason: Optional[str] = ""

    model_config = ConfigDict(populate_by_name=True)

class ProduceBatchItem(BaseModel):
    id: str
    farmer_id: str
    batch_code: str
    crop_type: str
    variety: Optional[str] = None
    initial_quantity: float
    current_quantity: float
    unit: str
    harvest_date: str
    current_status: str = "HARVESTED"
    qr_code_url: Optional[str] = None

class FarmCropItem(BaseModel):
    id: str
    farmer_id: str
    farm_id: Optional[str] = None
    crop_type: str
    variety: Optional[str] = None
    status: str = "GROWING"
    area: float
    area_unit: str = "acre"
    planting_date: Optional[str] = None
