from typing import List, Dict, Any
from fastapi import APIRouter, Depends, status
from ....core.security import require_role, AuthenticatedUser
from ....repositories.user_repository import user_repository
from ....repositories.farmer_repository import farmer_repository
from ....repositories.vendor_repository import vendor_repository
from ....db.mongodb import mongodb

router = APIRouter()

@router.get("/dashboard", tags=["Admin Portal"])
async def get_admin_dashboard(current_user: AuthenticatedUser = Depends(require_role(["ADMIN"]))):
    """
    Administrative platform governance dashboard overview and ecosystem metrics.
    Strictly restricted to users with ADMIN role.
    """
    farmers = await user_repository.list_by_role("FARMER")
    vendors = await user_repository.list_by_role("VENDOR")
    customers = await user_repository.list_by_role("CUSTOMER")
    
    total_users = len(farmers) + len(vendors) + len(customers)

    return {
        "success": True,
        "data": {
            "metrics": {
                "totalUsers": total_users,
                "farmersCount": len(farmers),
                "vendorsCount": len(vendors),
                "customersCount": len(customers),
                "platformStatus": "OPTIMAL",
            },
            "recentUsers": (farmers[:5] + vendors[:5] + customers[:5])[:10],
        },
    }

@router.get("/users", tags=["Admin Portal - User Management"])
async def list_all_users_for_admin(current_user: AuthenticatedUser = Depends(require_role(["ADMIN"]))):
    """
    Platform user management directory. Restricted to ADMIN.
    """
    farmers = await user_repository.list_by_role("FARMER")
    vendors = await user_repository.list_by_role("VENDOR")
    customers = await user_repository.list_by_role("CUSTOMER")
    admins = await user_repository.list_by_role("ADMIN")

    return {
        "success": True,
        "data": farmers + vendors + customers + admins,
    }
