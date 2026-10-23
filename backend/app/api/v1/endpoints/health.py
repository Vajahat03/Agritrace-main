import asyncio
from fastapi import APIRouter
from ....schemas.health import HealthResponse, DatabaseStatus, FirebaseStatus
from ....core.config import settings
from ....db.mongodb import mongodb

router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def get_health() -> HealthResponse:
    """
    Live health and readiness check endpoint.
    Verifies operational status of the gateway, database persistence, and Firebase.
    """
    db_status = "disconnected"
    db_msg = "MongoDB Atlas disconnected"
    try:
        if mongodb.is_connected():
            is_healthy, msg = await asyncio.wait_for(mongodb.ping(), timeout=1.5)
            db_status = "connected" if is_healthy else "degraded"
            db_msg = msg
        else:
            db_msg = mongodb._connection_error or "MongoDB Atlas disconnected (operating in local store fallback mode)"
    except Exception as e:
        db_status = "degraded"
        db_msg = f"Health ping error: {str(e)}"

    return HealthResponse(
        status="healthy",
        service=settings.PROJECT_NAME,
        version=settings.VERSION,
        environment=settings.ENVIRONMENT,
        database=DatabaseStatus(
            status=db_status,
            message=db_msg,
        ),
        firebase=FirebaseStatus(
            configured=bool(settings.FIREBASE_PROJECT_ID),
            projectId=settings.FIREBASE_PROJECT_ID,
        ),
    )
