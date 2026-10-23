import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from .core.config import settings
from .core.exceptions import (
    AgriTraceAPIException,
    agritrace_api_exception_handler,
    http_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
from .api.v1.router import api_router
from .api.v1.endpoints.health import get_health

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("agritrace.main")

from contextlib import asynccontextmanager
from .db import mongodb, ensure_indexes, migrate_legacy_store_to_mongodb

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AgriTrace FastAPI Gateway starting up on %s:%s", settings.HOST, settings.PORT)
    logger.info("Environment: %s | API Base: %s", settings.ENVIRONMENT, settings.API_V1_STR)
    logger.info("Firebase Project Target: %s", settings.FIREBASE_PROJECT_ID)

    # 1. Connect to MongoDB Atlas (or fallback to local store resilience)
    connected = await mongodb.connect()
    if connected:
        db = mongodb.get_database()
        await ensure_indexes(db)
        if settings.AUTO_MIGRATE_ON_STARTUP:
            await migrate_legacy_store_to_mongodb(db)
        logger.info("Database Persistence: MongoDB Atlas active and initialized.")
    else:
        logger.info("Database Persistence: Operating in local store fallback mode.")

    yield

    # Shutdown: Disconnect MongoDB connection pool
    await mongodb.disconnect()
    logger.info("AgriTrace FastAPI Gateway shut down cleanly.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url="/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    description="AgriTrace 2.0 Backend Gateway with Cryptographic Firebase Authentication & Role Authorization",
    lifespan=lifespan,
)

# 1. CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Centralized Exception Handlers (Standard error envelopes)
app.add_exception_handler(AgriTraceAPIException, agritrace_api_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

# 3. Root health check endpoint (/health in addition to /api/v1/health)
@app.get("/health", tags=["Health"], include_in_schema=True)
async def root_health():
    return await get_health()


# 4. Mount API v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

