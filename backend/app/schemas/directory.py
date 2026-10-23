from typing import Optional, List, Dict, Any
from pydantic import BaseModel

class FarmerDirectorySummary(BaseModel):
    id: str
    full_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    farm_count: int = 0
    farms: List[Dict[str, Any]] = []
    crops: List[Dict[str, Any]] = []

class VendorDirectorySummary(BaseModel):
    id: str
    full_name: str
    phone: Optional[str] = None
    address: Optional[str] = None
    inventory_count: int = 0
    inventory: List[Dict[str, Any]] = []
    products: List[Dict[str, Any]] = []
