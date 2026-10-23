import logging
from typing import Optional
from fastapi import APIRouter, Depends, status, Query

from ....core.security import get_current_user, AuthenticatedUser
from ....schemas.smartbag import NotificationListResponse
from ....repositories.notification_repository import notification_repository

logger = logging.getLogger("agritrace.api.notifications")

router = APIRouter()

@router.get("", response_model=NotificationListResponse, tags=["Notifications & Alerts"])
async def list_user_notifications(
    limit: int = Query(50, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves in-app freshness notifications and alerts for the authenticated user.
    """
    return await notification_repository.list_notifications(current_user.uid, limit=limit)

@router.patch("/{notif_id}/read", tags=["Notifications & Alerts"])
async def mark_notification_read(
    notif_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Marks a single notification as read.
    """
    success = await notification_repository.mark_as_read(current_user.uid, notif_id)
    return {
        "success": success,
        "notification_id": notif_id,
        "is_read": True,
    }

@router.post("/mark-all-read", tags=["Notifications & Alerts"])
async def mark_all_notifications_read(
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Marks all notifications for the authenticated user as read.
    """
    count = await notification_repository.mark_all_read(current_user.uid)
    return {
        "success": True,
        "marked_read_count": count,
    }
