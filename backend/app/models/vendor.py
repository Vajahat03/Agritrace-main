from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class VendorInventoryDocument(BaseModel):
    id: str
    vendor_id: str
    product_name: str
    crop_type: str
    batch_id: Optional[str] = None
    batch_code: Optional[str] = None
    quantity: float
    unit: str = "kg"
    location: Optional[str] = "Central Warehouse"
    status: str = "IN_STOCK"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class InventoryAdjustmentDocument(BaseModel):
    id: str
    vendor_id: str
    inventory_id: str
    adjustment_type: str  # DAMAGE, DISCARD, CORRECTION, RESTOCK
    quantity_change: float
    reason: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
