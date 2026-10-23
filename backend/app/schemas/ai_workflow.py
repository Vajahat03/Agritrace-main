from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field, ConfigDict

class AgentState(BaseModel):
    agent_id: str
    agent_name: str
    agent_goal: Optional[str] = None
    agent_version: Optional[str] = None
    status: str = Field(default="PENDING", description="PENDING | RUNNING | SUCCESS | FAILED | SKIPPED | BLOCKED")
    dependencies: List[str] = Field(default_factory=list)
    execution_time_ms: float = 0.0
    confidence: float = 0.0
    output: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    evidence: List[str] = Field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class WorkflowCreateRequest(BaseModel):
    batchId: Optional[str] = Field(None, alias="batch_id")
    farmId: Optional[str] = Field(None, alias="farm_id")
    cropId: Optional[str] = Field(None, alias="crop_id")
    produceType: str = Field("tomato", alias="produce_type", min_length=1)
    variety: Optional[str] = "Standard"
    quantityKg: float = Field(100.0, alias="quantity_kg", gt=0)
    temperatureC: Optional[float] = Field(22.0, alias="temperature_c")
    humidityRh: Optional[float] = Field(75.0, alias="humidity_rh")
    gasVocPpm: Optional[float] = Field(12.0, alias="gas_voc_ppm")
    storageType: Optional[str] = Field("ambient", alias="storage_type")
    smartbagId: Optional[str] = Field(None, alias="smartbag_id")
    marketTrend: Optional[str] = Field("falling", alias="market_trend")
    candidateBuyers: Optional[List[Dict[str, Any]]] = Field(None, alias="candidate_buyers")
    humanOverride: Optional[Dict[str, Any]] = Field(None, alias="human_override")

    model_config = ConfigDict(populate_by_name=True)

class WorkflowResponse(BaseModel):
    id: str
    workflow_id: str
    user_id: str
    scan_id: Optional[str] = None
    batch_id: Optional[str] = None
    farm_id: Optional[str] = None
    crop_id: Optional[str] = None
    produce_type: str
    status: str = Field(..., description="PENDING | RUNNING | COMPLETED | PARTIAL_SUCCESS | FAILED | CANCELLED")
    total_duration_ms: float = 0.0
    agent_states: Dict[str, AgentState] = Field(default_factory=dict)
    perception: Optional[Dict[str, Any]] = None
    prediction: Optional[Dict[str, Any]] = None
    risk: Optional[Dict[str, Any]] = None
    storage: Optional[Dict[str, Any]] = None
    market: Optional[Dict[str, Any]] = None
    buyer: Optional[Dict[str, Any]] = None
    logistics: Optional[Dict[str, Any]] = None
    decision: Optional[Dict[str, Any]] = None
    action_summary: Optional[str] = None
    action_type: Optional[str] = None
    urgency: Optional[str] = None
    executionGraph: Optional[Dict[str, Any]] = None
    dag_trace: Optional[List[Dict[str, Any]]] = None
    persisted_durably: bool = False
    persistence_tier: str = Field(default="ephemeral_session", description="atlas | ephemeral_session")
    persistence_notice: Optional[str] = None
    created_at: str
    updated_at: str
    completed_at: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class WorkflowListResponse(BaseModel):
    items: List[WorkflowResponse]
    total: int
    page: int
    page_size: int

class ProduceScanResponse(BaseModel):
    status: str
    produce_type: str
    freshness_grade: str
    quality_score: float
    defect_type: Optional[str] = None
    defect_probability: float = 0.0
    confidence: float = 0.0
    explanation: Optional[str] = None
    model_version: str
    inference_time_ms: float = 0.0
