import logging
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, status, Query

from ....core.security import get_current_user, AuthenticatedUser
from ....core.exceptions import AgriTraceAPIException
from ....schemas.smartbag import (
    SmartBagBatchCreate,
    SmartBagBatchUpdate,
    SmartBagBatchResponse,
    SmartBagListResponse,
)
from ....repositories.smartbag_repository import smartbag_repository
from ....repositories.workflow_repository import workflow_repository
from ....services.reminder_service import reminder_service

logger = logging.getLogger("agritrace.api.smartbag")

router = APIRouter()

@router.post("/batches", response_model=SmartBagBatchResponse, status_code=status.HTTP_201_CREATED, tags=["SmartBag & Freshness Inventory"])
async def create_smartbag_batch(
    payload: SmartBagBatchCreate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Persists a scanned produce batch in MongoDB Atlas SmartBag inventory.
    Schedules an idempotent daily reminder sequence based on predicted shelf life.
    Validates ownership of any referenced workflow.
    """
    if payload.workflowId:
        wf = await workflow_repository.get_workflow(
            current_user.uid,
            payload.workflowId,
            is_admin=(current_user.role == "ADMIN"),
        )
        if not wf:
            raise AgriTraceAPIException(
                status_code=status.HTTP_403_FORBIDDEN,
                code="FORBIDDEN_WORKFLOW_ACCESS",
                message=f"Workflow '{payload.workflowId}' does not belong to authenticated user '{current_user.uid}'.",
            )

    batch_data = payload.model_dump()
    created_batch = await smartbag_repository.create_batch(current_user.uid, batch_data)

    # Schedule daily freshness reminders if enabled
    if batch_data.get("reminders_enabled", True):
        try:
            await reminder_service.schedule_batch_reminders(current_user.uid, created_batch)
        except Exception as e:
            logger.warning("Failed to schedule daily reminders for batch %s: %s", created_batch.get("batch_id"), e)

    return created_batch

@router.get("/batches", response_model=SmartBagListResponse, tags=["SmartBag & Freshness Inventory"])
async def list_smartbag_batches(
    status: Optional[str] = Query("ACTIVE", description="ACTIVE | CONSUMED | SPOILED | ALL"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves the authenticated user's SmartBag batches from MongoDB Atlas.
    Dynamically recalculates days_remaining and urgency status against current UTC time.
    """
    is_admin = current_user.role == "ADMIN"
    return await smartbag_repository.list_batches(
        user_id=current_user.uid,
        status_filter=status,
        page=page,
        page_size=page_size,
        is_admin=is_admin,
    )

@router.get("/batches/{batch_id}", response_model=SmartBagBatchResponse, tags=["SmartBag & Freshness Inventory"])
async def get_smartbag_batch(
    batch_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Retrieves single SmartBag batch with strict ownership isolation.
    """
    is_admin = current_user.role == "ADMIN"
    batch = await smartbag_repository.get_batch(current_user.uid, batch_id, is_admin=is_admin)
    if not batch:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="BATCH_NOT_FOUND",
            message=f"SmartBag batch '{batch_id}' was not found or access denied.",
        )
    return batch

@router.patch("/batches/{batch_id}", response_model=SmartBagBatchResponse, tags=["SmartBag & Freshness Inventory"])
async def update_smartbag_batch(
    batch_id: str,
    payload: SmartBagBatchUpdate,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Updates quantity, storage conditions, or reminder settings for a batch.
    """
    is_admin = current_user.role == "ADMIN"
    existing = await smartbag_repository.get_batch(current_user.uid, batch_id, is_admin=is_admin)
    if not existing:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="BATCH_NOT_FOUND",
            message=f"SmartBag batch '{batch_id}' was not found.",
        )

    updated = await smartbag_repository.update_batch(
        user_id=current_user.uid,
        batch_id=batch_id,
        update_data=payload.model_dump(exclude_unset=True, by_alias=True),
        is_admin=is_admin,
    )
    return updated

@router.post("/batches/{batch_id}/consume", response_model=SmartBagBatchResponse, tags=["SmartBag & Freshness Inventory"])
async def mark_batch_as_consumed(
    batch_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Marks a SmartBag batch as consumed and cancels remaining daily reminders.
    """
    is_admin = current_user.role == "ADMIN"
    batch = await smartbag_repository.get_batch(current_user.uid, batch_id, is_admin=is_admin)
    if not batch:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="BATCH_NOT_FOUND",
            message=f"SmartBag batch '{batch_id}' was not found.",
        )

    updated = await smartbag_repository.transition_status(current_user.uid, batch_id, "CONSUMED")
    await reminder_service.cancel_batch_reminders(current_user.uid, batch_id)
    return updated

@router.post("/batches/{batch_id}/spoil", response_model=SmartBagBatchResponse, tags=["SmartBag & Freshness Inventory"])
async def mark_batch_as_spoiled(
    batch_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Marks a SmartBag batch as spoiled/discarded and cancels future reminders.
    """
    is_admin = current_user.role == "ADMIN"
    batch = await smartbag_repository.get_batch(current_user.uid, batch_id, is_admin=is_admin)
    if not batch:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="BATCH_NOT_FOUND",
            message=f"SmartBag batch '{batch_id}' was not found.",
        )

    updated = await smartbag_repository.transition_status(current_user.uid, batch_id, "SPOILED")
    await reminder_service.cancel_batch_reminders(current_user.uid, batch_id)
    return updated

@router.post("/batches/{batch_id}/rescan", response_model=SmartBagBatchResponse, tags=["SmartBag & Freshness Inventory"])
async def rescan_batch_shelf_life(
    batch_id: str,
    temperatureC: Optional[float] = Query(None, alias="temperature_c"),
    humidityRh: Optional[float] = Query(None, alias="humidity_rh"),
    storageMode: Optional[str] = Query(None, alias="storage_mode"),
    freshnessScore: Optional[float] = Query(None, alias="freshness_score"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Re-evaluates remaining shelf life using the actual calibrated XGBoost model and reschedules reminders.
    """
    is_admin = current_user.role == "ADMIN"
    batch = await smartbag_repository.get_batch(current_user.uid, batch_id, is_admin=is_admin)
    if not batch:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="BATCH_NOT_FOUND",
            message=f"SmartBag batch '{batch_id}' was not found.",
        )

    updated = await smartbag_repository.rescan_batch(
        user_id=current_user.uid,
        batch_id=batch_id,
        temperature_c=temperatureC,
        humidity_rh=humidityRh,
        storage_mode=storageMode,
        freshness_score=freshnessScore,
    )
    if updated and updated.get("reminders_enabled", True):
        await reminder_service.reschedule_batch_reminders(current_user.uid, updated)

    return updated

@router.delete("/batches/{batch_id}", tags=["SmartBag & Freshness Inventory"])
async def delete_smartbag_batch(
    batch_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Permanently deletes a batch from SmartBag and purges pending reminders.
    """
    is_admin = current_user.role == "ADMIN"
    batch = await smartbag_repository.get_batch(current_user.uid, batch_id, is_admin=is_admin)
    if not batch:
        raise AgriTraceAPIException(
            status_code=status.HTTP_404_NOT_FOUND,
            code="BATCH_NOT_FOUND",
            message=f"SmartBag batch '{batch_id}' was not found.",
        )

    await smartbag_repository.delete_batch(current_user.uid, batch_id, is_admin=is_admin)
    await reminder_service.cancel_batch_reminders(current_user.uid, batch_id)
    return {
        "success": True,
        "message": f"SmartBag batch '{batch_id}' deleted successfully.",
    }

@router.post("/reminders/process", tags=["SmartBag Reminders"])
async def process_due_reminders(
    targetDate: Optional[str] = Query(None, alias="target_date"),
    current_user: AuthenticatedUser = Depends(get_current_user),
):
    """
    Worker trigger: Evaluates due freshness reminders, marks them SENT, and creates user in-app notifications.
    """
    user_id = None if current_user.role == "ADMIN" else current_user.uid
    dispatched = await reminder_service.dispatch_due_reminders(user_id=user_id, as_of_date=targetDate)
    return {
        "success": True,
        "dispatched_count": len(dispatched),
        "dispatched": dispatched,
    }
