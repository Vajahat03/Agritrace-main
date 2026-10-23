from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class SmartBagBatchCreate(BaseModel):
    produceName: str = Field(..., alias="produce_name", min_length=1)
    cropType: str = Field(..., alias="crop_type", min_length=1)
    imageUrl: Optional[str] = Field(None, alias="image_url")
    quantityKg: float = Field(1.0, alias="quantity_kg", gt=0)
    scanId: Optional[str] = Field(None, alias="scan_id")
    workflowId: Optional[str] = Field(None, alias="workflow_id")
    freshnessScore: float = Field(..., alias="freshness_score", ge=0.0, le=100.0)
    qualityScore: float = Field(..., alias="quality_score", ge=0.0, le=100.0)
    predictedShelfLifeDays: float = Field(..., alias="predicted_shelf_life_days", gt=0.0)
    predictedUseByDate: Optional[str] = Field(None, alias="predicted_use_by_date")
    storageMode: str = Field("ambient", alias="storage_mode")
    temperatureC: Optional[float] = Field(22.0, alias="temperature_c")
    humidityRh: Optional[float] = Field(75.0, alias="humidity_rh")
    storageRecommendation: Optional[str] = Field(None, alias="storage_recommendation")
    remindersEnabled: bool = Field(True, alias="reminders_enabled")
    reminderFrequency: str = Field("DAILY", alias="reminder_frequency")

    model_config = ConfigDict(populate_by_name=True)

class SmartBagBatchUpdate(BaseModel):
    quantityKg: Optional[float] = Field(None, alias="quantity_kg", gt=0)
    storageMode: Optional[str] = Field(None, alias="storage_mode")
    temperatureC: Optional[float] = Field(None, alias="temperature_c")
    humidityRh: Optional[float] = Field(None, alias="humidity_rh")
    remindersEnabled: Optional[bool] = Field(None, alias="reminders_enabled")
    currentStatus: Optional[str] = Field(None, alias="current_status")
    storageRecommendation: Optional[str] = Field(None, alias="storage_recommendation")

    model_config = ConfigDict(populate_by_name=True)

class SmartBagBatchResponse(BaseModel):
    id: str
    batch_id: str
    user_id: str
    produce_name: str
    crop_type: str
    image_url: Optional[str] = None
    quantity_kg: float
    scan_id: Optional[str] = None
    workflow_id: Optional[str] = None
    freshness_score: float
    quality_score: float
    predicted_shelf_life_days: float
    prediction_date: str
    predicted_use_by_date: str
    days_remaining: float
    shelf_life_status: str = Field(..., description="FRESH | APPROACHING_EXPIRY | EXPIRES_TODAY | EXPIRED")
    storage_mode: str
    temperature_c: float
    humidity_rh: float
    storage_recommendation: Optional[str] = None
    current_status: str = Field(..., description="ACTIVE | CONSUMED | SPOILED | REMOVED")
    reminders_enabled: bool
    reminder_frequency: str
    next_reminder_date: Optional[str] = None
    created_at: str
    updated_at: str
    consumed_at: Optional[str] = None
    spoiled_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class SmartBagListResponse(BaseModel):
    items: List[SmartBagBatchResponse]
    total: int
    active_count: int
    approaching_expiry_count: int

class ProduceInspectResponse(BaseModel):
    scan_id: str
    workflow_id: str
    status: str
    timestamp: str
    produce_identification: Dict[str, Any]
    freshness_quality: Dict[str, Any]
    shelf_life_prediction: Dict[str, Any]
    executionGraph: Dict[str, Any]
    dag_trace: List[Dict[str, Any]]
    smartbag_compatible: bool = True
    persisted_durably: bool = False
    persistence_tier: str = Field(default="ephemeral_session", description="atlas | ephemeral_session")
    persistence_notice: Optional[str] = None

class NotificationItemResponse(BaseModel):
    id: str
    user_id: str
    title: str
    message: str
    type: str = Field(..., description="SMARTBAG | SHELF_LIFE | WEATHER | SYSTEM")
    is_read: bool = False
    batch_id: Optional[str] = None
    link: Optional[str] = None
    created_at: str

    model_config = ConfigDict(populate_by_name=True)

class NotificationListResponse(BaseModel):
    items: List[NotificationItemResponse]
    total: int
    unread_count: int
