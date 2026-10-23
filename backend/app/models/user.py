from typing import Optional, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field

class UserDocument(BaseModel):
    uid: str = Field(..., description="Firebase Unique Identifier")
    email: Optional[str] = None
    full_name: str
    role: str = "CUSTOMER"
    phone: Optional[str] = None
    address: Optional[str] = None
    language_preference: str = "en"
    onboarding_completed: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
