from typing import Optional, Any
from pydantic import BaseModel, Field, ConfigDict

class UserProfileData(BaseModel):
    id: str
    email: Optional[str] = None
    full_name: str
    role: str
    phone: Optional[str] = None
    address: Optional[str] = None
    language_preference: str = "en"
    onboarding_completed: bool = True

class UserProfileResponse(BaseModel):
    success: bool = True
    data: UserProfileData

class UpdateProfileRequest(BaseModel):
    fullName: Optional[str] = Field(None, alias="full_name")
    phone: Optional[str] = None
    address: Optional[str] = None
    languagePreference: Optional[str] = Field("en", alias="language_preference")
    role: Optional[str] = None

    model_config = ConfigDict(populate_by_name=True)

class SyncProfileRequest(BaseModel):
    fullName: str = Field(..., alias="full_name")
    role: str = "CUSTOMER"
    phone: Optional[str] = None
    address: Optional[str] = None
    languagePreference: Optional[str] = Field("en", alias="language_preference")

    model_config = ConfigDict(populate_by_name=True)

class OnboardingRequest(BaseModel):
    role: str
    fullName: Optional[str] = Field(None, alias="full_name")
    phone: Optional[str] = None
    address: Optional[str] = None
    languagePreference: Optional[str] = Field("en", alias="language_preference")

    model_config = ConfigDict(populate_by_name=True)

