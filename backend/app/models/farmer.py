from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class FarmDocument(BaseModel):
    id: str
    farmer_id: str
    name: str
    location_name: str
    address: Optional[str] = None
    total_area: float = 0.0
    area_unit: str = "acres"
    soil_info: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CropDocument(BaseModel):
    id: str
    farmer_id: str
    farm_id: Optional[str] = None
    crop_type: str
    variety: str
    area: float = 0.0
    area_unit: str = "acres"
    planting_date: str
    expected_harvest_date: Optional[str] = None
    status: str = "GROWING"
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProduceBatchDocument(BaseModel):
    id: str
    farmer_id: str
    batch_code: str
    crop_type: str
    variety: str
    initial_quantity: float
    current_quantity: float
    unit: str = "kg"
    harvest_date: str
    current_status: str = "MINTED"
    quality_grade: Optional[str] = "A"
    farm_location: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FertilizerApplicationDocument(BaseModel):
    id: str
    crop_id: str
    farmer_id: str
    fertilizer_name: str
    fertilizer_type: str
    application_date: str
    quantity: float
    unit: str = "kg"
    method: str = "SOIL"
    n_value: Optional[float] = None
    p_value: Optional[float] = None
    k_value: Optional[float] = None
    cost: float = 0.0
    supplier: Optional[str] = None
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
