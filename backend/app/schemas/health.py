from typing import Dict, Any, Optional
from pydantic import BaseModel

class DatabaseStatus(BaseModel):
    status: str = "disconnected"
    message: str = "MongoDB Atlas persistence scheduled for Phase 4"

class FirebaseStatus(BaseModel):
    configured: bool = True
    projectId: str = "agritrace-ab141"

class HealthResponse(BaseModel):
    status: str = "healthy"
    service: str = "agritrace-backend"
    version: str = "1.0.0"
    environment: str = "development"
    database: DatabaseStatus
    firebase: FirebaseStatus
