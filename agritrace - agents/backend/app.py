"""
AgriTrace FastAPI Backend Gateway
Exposes complete REST API routes for AI Perception, Shelf-Life Prediction,
Multi-Agent Orchestration, SmartBag Telemetry, Marketplace, QR Traceability, and Analytics.
"""

from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager
import io
import os
import time
from dotenv import load_dotenv
from PIL import Image
from fastapi import FastAPI, File, UploadFile, Form, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

from ai.version_registry import get_system_manifest, MODEL_VERSIONS
from data_pipeline.shelf_life_training.shelf_life_xgboost_v1.predict import predict as predict_shelf_life_v1
from ai.reasoning.fuzzy_engine import evaluate_fuzzy_risk
from ai.nlp.rag_engine import query_agritrace_nlp
from backend.database import DB
from backend.security import (
    AuthStore, get_auth_store, require_authenticated_user,
    require_role, require_workspace_access, router as security_router,
)


@asynccontextmanager
async def lifespan(application):
    # Tests can inject an isolated in-memory store; real startup must confirm
    # that the configured persistent database can actually be initialized.
    if get_auth_store not in application.dependency_overrides:
        get_auth_store()
    yield


app = FastAPI(
    title="AgriTrace Agentic AI Gateway",
    description="Autonomous Agentic AI Platform for Post-Harvest Food Waste Reduction and Produce Intelligence",
    version="1.0.0",
    lifespan=lifespan,
)

from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

allowed_origins = [origin.strip() for origin in os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:8000,http://127.0.0.1:8000,http://localhost:3000,http://127.0.0.1:3000"
).split(",") if origin.strip()]
if os.getenv("APP_ENV", "development").lower() != "production":
    # Local Next.js frontend: credentials cookies need an explicit CORS origin.
    allowed_origins = list(dict.fromkeys(allowed_origins + ["http://localhost:3000", "http://127.0.0.1:3000"]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Content-Type"],
)

app.include_router(security_router)
from backend.workflow import router as farmer_workflow_router
app.include_router(farmer_workflow_router)


@app.middleware("http")
async def same_origin_state_change_guard(request, call_next):
    """Cookie-authenticated writes accept only configured browser origins."""
    if request.method not in {"GET", "HEAD", "OPTIONS"}:
        origin = request.headers.get("origin")
        if origin and origin not in allowed_origins:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=403, content={"detail": "Request origin is not allowed"})
    return await call_next(request)

@app.get("/")
def serve_index():
    return {"message": "AgriTrace Agentic AI Gateway running.", "version": "1.0.0"}

# ----------------- SYSTEM & MANIFEST -----------------
@app.get("/api/manifest")
def get_manifest():
    return get_system_manifest()

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "AgriTrace AI Engine",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "active_models": MODEL_VERSIONS
    }

# ----------------- AI PERCEPTION (CV) -----------------
@app.post("/api/produce/analyze")
async def analyze_produce(file: UploadFile = File(...),
                         user: dict = Depends(require_role("farmer", "vendor"))):
    """
    Sprint 1 Vision Perception Pipeline:
    Uploads image -> Quality Check -> OOD Check -> DenseNet-121 -> Grad-CAM
    """
    try:
        from ai.vision.inference import run_vision_pipeline
        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image file: {str(e)}")

    result = run_vision_pipeline(image)
    return result

# ----------------- SHELF-LIFE PREDICTION -----------------
class ShelfLifeRequest(BaseModel):
    # freshness_score is an explicit development-model input; vision does not
    # currently produce a validated numeric value for this field.
    produce_type: str
    freshness_score: float
    quality_score: float
    defect_probability: float
    temperature_c: float
    humidity_rh: float
    harvest_age_days: float
    storage_type: str

@app.post("/api/shelf-life/predict")
def predict_shelf_life_endpoint(req: ShelfLifeRequest,
                                user: dict = Depends(require_authenticated_user),
                                store: AuthStore = Depends(get_auth_store)):
    try:
        prediction = predict_shelf_life_v1(
            produce_type=req.produce_type,
            freshness_score=req.freshness_score,
            quality_score=req.quality_score,
            defect_probability=req.defect_probability,
            temperature_c=req.temperature_c,
            humidity_rh=req.humidity_rh,
            harvest_age_days=req.harvest_age_days,
            storage_type=req.storage_type,
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except (FileNotFoundError, OSError) as exc:
        raise HTTPException(status_code=503, detail="V1 shelf-life model is unavailable") from exc
    model_name = "shelf_life_xgboost_v1"
    model_version = "shelf_life_xgboost_v1"
    provenance = {
        "freshness_score": "explicit_development_model_input",
        "quality_score": "caller_supplied",
        "defect_probability": "caller_supplied",
        "harvest_age_days": "caller_supplied",
        "temperature_c": "caller_supplied",
        "humidity_rh": "caller_supplied",
        "storage_type": "caller_supplied",
    }
    prediction_id = store.save_prediction(
        user, model_name=model_name, model_version=model_version,
        predicted_days=prediction, provenance=provenance,
    )
    return {
        "prediction_id": prediction_id,
        "model_name": model_name,
        "model_version": model_version,
        "predicted_days": prediction,
        "development_only": True,
        "real_world_validated": False,
        "input_provenance": provenance,
    }

# ----------------- AGENT ORCHESTRATION -----------------
@app.post("/api/agents/run")
async def run_agent_orchestrator(
    batch_id: str = Form("BATCH-TOM-001"),
    produce_type: str = Form("tomato"),
    quantity_kg: float = Form(500.0),
    temperature_c: float = Form(24.0),
    humidity_rh: float = Form(78.0),
    gas_voc_ppm: float = Form(18.0),
    market_trend: str = Form("falling"),
    smartbag_active: bool = Form(True),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(require_role("farmer", "vendor")),
    store: AuthStore = Depends(get_auth_store),
):
    """
    Executes the autonomous 9-Agent DAG workflow coordinating perception,
    shelf-life, environmental risk, market intelligence, buyer matching, and decision action.
    """
    from agents.orchestrator.orchestrator import orchestrate_batch
    image = None
    if file:
        try:
            contents = await file.read()
            image = Image.open(io.BytesIO(contents)).convert("RGB")
        except Exception:
            pass

    telemetry = {
        "temperature_c": temperature_c,
        "humidity_rh": humidity_rh,
        "gas_voc_ppm": gas_voc_ppm,
        "smartbag_active": smartbag_active
    }

    result = orchestrate_batch(
        batch_id=batch_id,
        image=image,
        produce_type=produce_type,
        quantity_kg=quantity_kg,
        telemetry=telemetry,
        market_trend=market_trend,
        candidate_buyers=list(DB.buyers.values())
    )

    # Save to database memory
    store.save_agent_run(user, result["run_id"], result)
    return result

# ----------------- BATCH MANAGEMENT -----------------
@app.get("/api/batches")
def list_batches(user: dict = Depends(require_role("admin"))):
    return DB.get_batches()

@app.get("/api/batches/{batch_id}")
def get_batch(batch_id: str, user: dict = Depends(require_role("admin"))):
    batch = DB.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch

@app.post("/api/batches")
def create_batch(batch: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    return DB.create_batch(batch)

@app.patch("/api/batches/{batch_id}/status")
def update_batch_status(batch_id: str, payload: Dict[str, str], user: dict = Depends(require_role("admin"))):
    new_status = payload.get("status", "ACTIVE")
    res = DB.update_batch_status(batch_id, new_status)
    if not res:
        raise HTTPException(status_code=404, detail="Batch not found")
    return res

# ----------------- SMARTBAG IOT -----------------
@app.get("/api/smartbag/{smartbag_id}/status")
def get_smartbag_status(smartbag_id: str, user: dict = Depends(require_role("admin"))):
    return {
        "smartbag_id": smartbag_id,
        "telemetry": {
            "temperature_c": 14.2,
            "humidity_rh": 84.5,
            "gas_voc_ppm": 12.0,
            "cooling_actuator": "ACTIVE",
            "ventilation_fan": "STANDBY",
            "battery_percentage": 91
        },
        "target_temperature_c": 13.5,
        "holding_produce": "Tomato Batch #BATCH-TOM-001",
        "last_sync": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

@app.post("/api/smartbag/{smartbag_id}/action")
def execute_smartbag_action(smartbag_id: str, action: Dict[str, str], user: dict = Depends(require_role("admin"))):
    command = action.get("command", "COOL")
    return {
        "smartbag_id": smartbag_id,
        "command_executed": command,
        "status": "COMMAND_ENACTED",
        "new_state": {
            "cooling_actuator": "HIGH" if command == "COOL" else "OFF",
            "ventilation_fan": "ACTIVE" if command == "VENTILATE" else "STANDBY"
        },
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }

# ----------------- BUYERS MARKETPLACE -----------------
@app.get("/api/buyers")
def list_buyers(user: dict = Depends(require_authenticated_user)):
    return list(DB.buyers.values())

# ----------------- ALERTS -----------------
@app.get("/api/alerts")
def get_alerts(user: dict = Depends(require_role("admin"))):
    return DB.alerts

@app.patch("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, user: dict = Depends(require_role("admin"))):
    for a in DB.alerts:
        if a["id"] == alert_id:
            a["resolved"] = True
            return a
    raise HTTPException(status_code=404, detail="Alert not found")

# ----------------- QR TRACEABILITY -----------------
@app.get("/api/traceability/{batch_id}")
def get_traceability_record(batch_id: str):
    batch = DB.get_batch(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    return {
        "batch_id": batch["id"],
        "qr_hash": batch["qr_hash"],
        "farm_name": batch.get("farm_name", "AgriTrace Partner Farm"),
        "farmer_name": batch.get("farmer_name", "Verified Producer"),
        "location": batch.get("location", "Maharashtra, India"),
        "produce_type": batch["produce_type"],
        "harvest_date": batch["harvest_date"],
        "freshness_grade": batch.get("freshness_grade", "Fresh"),
        "quality_score": batch.get("quality_score", 85.0),
        "status": batch["status"],
        "storage_mode": batch.get("storage_type", "SmartBag"),
        "inspection_history": [
            {"date": "2026-09-03", "event": "Batch harvested and registered at farm gate"},
            {"date": "2026-09-04", "event": "Vision-D121 AI quality inspection passed (Grade: A)"},
            {"date": "2026-09-05", "event": "SmartBag IoT microclimate tracking active"}
        ],
        "verification_url": f"https://agritrace.ai/verify/{batch['qr_hash']}"
    }

# ----------------- DOMAIN NLP / RAG -----------------
class NLPRequest(BaseModel):
    query: str
    active_batch_id: Optional[str] = None

@app.post("/api/nlp/query")
def nlp_query(req: NLPRequest, user: dict = Depends(require_authenticated_user)):
    if req.active_batch_id and user["role"] != "admin":
        # Legacy in-memory batches have no tenant owner, so never disclose one
        # as context to an ordinary user's query.
        raise HTTPException(status_code=404, detail="Batch not found")
    batch = DB.get_batch(req.active_batch_id) if req.active_batch_id else None
    return query_agritrace_nlp(user_query=req.query, active_batch=batch)

# ----------------- FEEDBACK & HUMAN OVERRIDE -----------------
@app.post("/api/feedback")
def record_feedback(feedback: Dict[str, Any], user: dict = Depends(require_role("admin"))):
    return DB.log_feedback(feedback)

# ----------------- SUSTAINABILITY ANALYTICS -----------------
@app.get("/api/analytics/sustainability")
def get_sustainability(user: dict = Depends(require_role("admin"))):
    return DB.calculate_sustainability_metrics()
