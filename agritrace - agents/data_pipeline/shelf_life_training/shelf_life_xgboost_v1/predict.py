"""Prediction wrapper for the isolated shelf-life development model."""
from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from xgboost import XGBRegressor


# Development-model training ranges, not universal physiological limits. V1 has
# not been externally validated; validation here does not make it production-ready.
_CATEGORIES = {
    "produce_type": frozenset((
        "Apple", "Banana", "Brinjal", "Cabbage", "Capsicum", "Carrot",
        "Cauliflower", "Chilli", "Cucumber", "Garlic", "Ginger", "Grapes",
        "Guava", "Lemon", "Mango", "Okra", "Onion", "Orange", "Papaya",
        "Peas", "Pomegranate", "Potato", "Spinach", "Tomato", "Watermelon",
    )),
    "storage_type": frozenset((
        "Cold Storage", "Controlled Atmosphere", "Open Market", "Refrigerated",
        "Room Temperature",
    )),
}
_RANGES = {
    "freshness_score": (15, 99),
    "quality_score": (15.27, 100),
    "defect_probability": (0.1463, 0.95),
    "temperature_c": (0, 37.69),
    "humidity_rh": (35, 98),
    "harvest_age_days": (0.20, 26.56),
}


HERE = Path(__file__).resolve().parent
ARTIFACTS = HERE / "artifacts"


@lru_cache(maxsize=1)
def _load():
    manifest = json.loads((ARTIFACTS / "feature_manifest.json").read_text(encoding="utf-8"))
    preprocessor = joblib.load(ARTIFACTS / manifest["preprocessor_file"])
    model = XGBRegressor()
    model.load_model(ARTIFACTS / manifest["model_file"])
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
    """Predict development-model shelf life with input and output checks.

    Ranges reflect V1 training data, not universal physiological limits. V1 has
    not been externally validated, and this wrapper does not make it production-ready.
    """
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
    for name, allowed in _CATEGORIES.items():
        value = values[name]
        if not isinstance(value, str) or value not in allowed:
            raise ValueError(f"Unknown {name} {value!r}; allowed values: {', '.join(sorted(allowed))}")
    for name, (low, high) in _RANGES.items():
        value = values[name]
        if value is None:
            raise ValueError(f"{name} is required and must be numeric; received None")
        try:
            number = float(value)
        except (TypeError, ValueError, OverflowError) as exc:
            raise ValueError(f"{name} must be numeric; received {value!r}") from exc
        if not np.isfinite(number):
            raise ValueError(f"{name} must be finite; received {value!r}")
        if not low <= number <= high:
            raise ValueError(f"{name} value {value!r} is outside allowed range [{low}, {high}]")
        values[name] = number

    manifest, preprocessor, model = _load()
    frame = pd.DataFrame([{name: values[name] for name in manifest["input_order"]}])
    transformed = preprocessor.transform(frame)
    result = float(model.predict(transformed)[0])
    if not np.isfinite(result):
        raise ValueError("Model returned a non-finite prediction")
    if result < 0:
        raise ValueError(f"Trained model produced a negative shelf-life prediction: {result}")
    return result
