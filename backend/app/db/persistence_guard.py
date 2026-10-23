import logging
from typing import Optional
from motor.motor_asyncio import AsyncIOMotorDatabase
from fastapi import status
from ..core.config import settings
from ..core.exceptions import AgriTraceAPIException
from .mongodb import mongodb

logger = logging.getLogger("agritrace.database.guard")

def enforce_database_available(db: Optional[AsyncIOMotorDatabase] = None) -> Optional[AsyncIOMotorDatabase]:
    """
    Enforces explicit persistence behavior:
    When PERSISTENCE_MODE == 'mongodb' and ALLOW_STORE_FALLBACK is False,
    Atlas is authoritative. If MongoDB is unavailable or uninitialized,
    database-dependent operations must fail-fast with HTTP 503 DATABASE_UNAVAILABLE
    rather than silently reporting success from ephemeral/local stores.
    """
    active_db = db if db is not None else mongodb.get_database()
    if active_db is None:
        if settings.PERSISTENCE_MODE == "mongodb" and not settings.ALLOW_STORE_FALLBACK:
            raise AgriTraceAPIException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                code="DATABASE_UNAVAILABLE",
                message="MongoDB Atlas is configured as the authoritative database but is currently unavailable. Operation rejected to prevent unpersisted state.",
            )
    return active_db

def handle_database_error(error: Exception, operation: str = "database operation"):
    """
    Logs database failure and raises HTTP 503 when fallback is disabled.
    """
    logger.error("MongoDB Atlas error during %s: %s", operation, error)
    if settings.PERSISTENCE_MODE == "mongodb" and not settings.ALLOW_STORE_FALLBACK:
        raise AgriTraceAPIException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            code="DATABASE_UNAVAILABLE",
            message=f"MongoDB Atlas operation failed during {operation}. Operation rejected.",
        )
