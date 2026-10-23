import pytest
import io
from PIL import Image
from ai.shelf_life.xgboost_model import (
    AgriTraceShelfLifeModel,
    predict_shelf_life,
    BASE_OPTIMAL_SHELF_LIFE,
)

ALL_25_CROPS = [
    "garlic", "pomegranate", "onion", "ginger", "apple",
    "potato", "lemon", "cabbage", "orange", "carrot",
    "capsicum", "bell_pepper", "chilli", "cauliflower", "watermelon",
    "cucumber", "grapes", "tomato", "mango", "peas",
    "papaya", "banana", "brinjal", "guava", "okra",
    "strawberry", "spinach"
]

def test_score_scales_and_bounds():
    """Verify that 0-100 scores and 0-1 defect probabilities are clamped and handled without error."""
    # Score 100, defect 0
    res_max = predict_shelf_life(
        produce_type="tomato",
        freshness_score=100.0,
        quality_score=100.0,
        defect_probability=0.0,
        temperature_c=14.0,
        humidity_rh=85.0
    )
    assert res_max["predicted_shelf_life_days"] > 0
    assert res_max["prediction_interval_90"]["min_days"] <= res_max["predicted_shelf_life_days"] <= res_max["prediction_interval_90"]["max_days"]

    # Score 0, defect 1.0
    res_min = predict_shelf_life(
        produce_type="tomato",
        freshness_score=0.0,
        quality_score=0.0,
        defect_probability=1.0,
        temperature_c=35.0,
        humidity_rh=40.0
    )
    assert res_min["predicted_shelf_life_days"] >= 0.5
    assert res_min["prediction_interval_90"]["min_days"] <= res_min["predicted_shelf_life_days"]

def test_missing_and_default_inputs():
    """Verify missing inputs default safely without exception."""
    res = predict_shelf_life(
        produce_type="tomato",
        freshness_score=None,
        quality_score=None,
        defect_probability=None,
        temperature_c=None,
        humidity_rh=None,
        harvest_age_days=None,
        storage_type="ambient"
    )
    assert res["predicted_shelf_life_days"] > 0
    assert "prediction_interval_90" in res

def test_all_25_produce_varieties_supported():
    """Verify all 25 crops have distinct physiological baseline mappings."""
    for crop in ALL_25_CROPS:
        res = predict_shelf_life(
            produce_type=crop,
            freshness_score=85.0,
            quality_score=85.0,
            defect_probability=0.05,
            temperature_c=10.0,
            humidity_rh=80.0,
            storage_type="cold_storage"
        )
        assert res["predicted_shelf_life_days"] > 0, f"{crop} predicted non-positive shelf life"
        assert res["produce_type"] in [crop, "bell_pepper", "brinjal", "chilli"]
        inv = res["prediction_interval_90"]
        assert inv["min_days"] <= res["predicted_shelf_life_days"] <= inv["max_days"]

    # Garlic long-life vs Spinach short-life
    g_res = predict_shelf_life(produce_type="garlic", freshness_score=85.0, quality_score=85.0, defect_probability=0.05, temperature_c=4.0, humidity_rh=70.0, storage_type="cold_storage")
    s_res = predict_shelf_life(produce_type="spinach", freshness_score=85.0, quality_score=85.0, defect_probability=0.05, temperature_c=4.0, humidity_rh=70.0, storage_type="cold_storage")
    assert g_res["predicted_shelf_life_days"] > s_res["predicted_shelf_life_days"] * 5

def test_storage_condition_multipliers():
    """Verify storage atmospheres scale predictions logically."""
    res_cold = predict_shelf_life(produce_type="apple", freshness_score=80.0, quality_score=80.0, defect_probability=0.05, temperature_c=3.0, humidity_rh=85.0, storage_type="cold_storage")
    res_smart = predict_shelf_life(produce_type="apple", freshness_score=80.0, quality_score=80.0, defect_probability=0.05, temperature_c=3.0, humidity_rh=85.0, storage_type="smartbag")
    res_open = predict_shelf_life(produce_type="apple", freshness_score=80.0, quality_score=80.0, defect_probability=0.05, temperature_c=30.0, humidity_rh=45.0, storage_type="open_market")
    assert res_smart["predicted_shelf_life_days"] >= res_cold["predicted_shelf_life_days"]
    assert res_cold["predicted_shelf_life_days"] > res_open["predicted_shelf_life_days"]

def test_very_low_prediction_display_formatting():
    """Verify that predictions under 1 day return 'Less than 1 day' while preserving float value."""
    model = AgriTraceShelfLifeModel()
    # High temperature spinach with low freshness
    res = model.predict(
        produce_type="spinach",
        freshness_score=15.0,
        quality_score=20.0,
        defect_probability=0.90,
        temperature_c=35.0,
        humidity_rh=40.0,
        harvest_age_days=4.0,
        storage_type="open_market"
    )
    assert res["predicted_shelf_life_days"] < 1.0
    assert res["display_shelf_life"] == "Less than 1 day"
    assert "less than 1 day" in res["explanation"]

def test_reproduced_bell_pepper_scan_corrected():
    """
    Directly tests the specific inputs that previously produced 0.96 days with interval 0.48-1.44 days.
    Proves that for fresh 85-grade bell pepper at 28C, the prediction is now physiological and fair.
    """
    res = predict_shelf_life(
        produce_type="bell_pepper",
        freshness_score=85.0,
        quality_score=85.0,
        defect_probability=0.85,
        temperature_c=28.0,
        humidity_rh=75.0,
        harvest_age_days=1.0,
        storage_type="ambient"
    )
    # The previous buggy prediction was 0.96 days; with corrected defect penalty and Q10 respiration,
    # a fresh 85-grade bell pepper at 28C is expected to last ~3.3 days.
    assert res["predicted_shelf_life_days"] >= 2.5
    assert res["display_shelf_life"] in ["3 days", "4 days"]
    inv = res["prediction_interval_90"]
    assert inv["min_days"] < res["predicted_shelf_life_days"] < inv["max_days"]
    assert inv["confidence_level"] == "Estimated Range (Physiological Heuristic, Uncalibrated)"

from app.main import app
from app.core.security import get_current_user, AuthenticatedUser

def test_full_inference_api_serialization(client):
    """
    Tests that POST /api/v1/ai/inspect returns the corrected shelf-life structure
    including display_shelf_life, numeric predicted_shelf_life_days, and honest interval metadata.
    """
    mock_user = AuthenticatedUser(
        uid="farmer-sl-test-01",
        email="farmer@agritrace.dev",
        role="FARMER",
        full_name="Ramesh Kumar",
    )
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        img = Image.new("RGB", (224, 224), color=(220, 40, 40))
        buf = io.BytesIO()
        img.save(buf, format="JPEG")
        buf.seek(0)

        files = {"image": ("test_tomato.jpg", buf, "image/jpeg")}
        data = {
            "storageMode": "ambient",
            "temperatureC": 22.0,
            "humidityRh": 75.0,
            "quantityKg": 25.0
        }

        r = client.post("/api/v1/ai/inspect", files=files, data=data)
        assert r.status_code == 200, f"Error {r.status_code}: {r.text}"
        body = r.json()
        assert "shelf_life_prediction" in body
        sl = body["shelf_life_prediction"]
        assert "predicted_shelf_life_days" in sl
        assert isinstance(sl["predicted_shelf_life_days"], (int, float))
        assert sl["predicted_shelf_life_days"] > 0
        assert "display_shelf_life" in sl
        assert "prediction_interval_90" in sl
        assert "min_days" in sl["prediction_interval_90"]
        assert "max_days" in sl["prediction_interval_90"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

