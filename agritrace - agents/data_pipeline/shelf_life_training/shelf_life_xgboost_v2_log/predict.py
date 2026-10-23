"""Prediction wrapper for isolated V2-Log development artifacts."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor

HERE = Path(__file__).resolve().parent
ART = HERE / "artifacts"


@lru_cache(maxsize=1)
def _load():
    manifest = json.loads((ART / "feature_manifest.json").read_text(encoding="utf-8"))
    preprocessor = joblib.load(ART / manifest["preprocessor_file"])
    model = XGBRegressor()
    model.load_model(ART / manifest["model_file"])
    return manifest, preprocessor, model


def predict(
    produce_type,
    freshness_score,
    quality_score,
    defect_probability,
    temperature_c,
    humidity_rh,
    harvest_age_days,
    storage_type,
):
    """Return raw expm1-transformed model output in days; no clipping is applied."""
    manifest, preprocessor, model = _load()
    values = {
        "produce_type": produce_type,
        "freshness_score": freshness_score,
        "quality_score": quality_score,
        "defect_probability": defect_probability,
        "temperature_c": temperature_c,
        "humidity_rh": humidity_rh,
        "harvest_age_days": harvest_age_days,
        "storage_type": storage_type,
    }
    frame = pd.DataFrame([{name: values[name] for name in manifest["input_order"]}])
    log_prediction = float(model.predict(preprocessor.transform(frame))[0])
    days = float(np.expm1(log_prediction))
    if not np.isfinite(days):
        raise ValueError("Model returned a non-finite shelf-life prediction")
    return days
