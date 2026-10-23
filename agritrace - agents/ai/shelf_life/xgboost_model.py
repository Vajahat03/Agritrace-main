"""
AgriTrace Postharvest Shelf-Life Model (Physiological Degradation Heuristic)

NOTE ON MODEL TYPE & PROVENANCE:
This module implements an evidence-grounded physiological shelf-life heuristic
incorporating postharvest respiration dynamics (Arrhenius/Q10 temperature sensitivity),
storage microclimate multipliers (e.g. SmartBag modified atmosphere, refrigeration),
and visual quality/freshness indices with defect adjustments.

It is NOT a fitted XGBoost statistical estimator. Misleading references to XGBoost
regressor artifacts have been clarified: this module provides physiological degradation
benchmarks across 25 agricultural commodities. For experimental XGBoost models trained
on tabular benchmark datasets, refer to data_pipeline/shelf_life_training/shelf_life_xgboost_v1.
"""

from typing import Dict, Any, List, Tuple, Optional
import numpy as np
from ai.version_registry import MODEL_VERSIONS

# Base shelf-life at optimal storage conditions (days) across all 25 supported produce varieties
BASE_OPTIMAL_SHELF_LIFE: Dict[str, float] = {
    "garlic": 65.0,
    "pomegranate": 55.0,
    "onion": 55.0,
    "ginger": 45.0,
    "apple": 40.0,
    "potato": 35.0,
    "lemon": 35.0,
    "cabbage": 30.0,
    "orange": 28.0,
    "carrot": 25.0,
    "capsicum": 16.0,
    "bell_pepper": 16.0,
    "chilli": 16.0,
    "chili": 16.0,
    "cauliflower": 15.0,
    "watermelon": 15.0,
    "cucumber": 12.0,
    "grapes": 12.0,
    "tomato": 10.0,
    "mango": 10.0,
    "peas": 8.0,
    "papaya": 8.0,
    "banana": 7.0,
    "brinjal": 7.0,
    "eggplant": 7.0,
    "guava": 7.0,
    "okra": 6.0,
    "strawberry": 5.0,
    "spinach": 4.0,
}

# Optimal storage temperature ranges (°C)
OPTIMAL_TEMPERATURE_RANGES: Dict[str, Tuple[float, float]] = {
    "garlic": (0.0, 4.0),
    "pomegranate": (5.0, 8.0),
    "onion": (0.0, 4.0),
    "ginger": (12.0, 14.0),
    "apple": (1.0, 4.0),
    "potato": (7.0, 10.0),
    "lemon": (10.0, 13.0),
    "cabbage": (0.0, 3.0),
    "orange": (4.0, 7.0),
    "carrot": (0.0, 3.0),
    "capsicum": (7.0, 10.0),
    "bell_pepper": (7.0, 10.0),
    "chilli": (7.0, 10.0),
    "chili": (7.0, 10.0),
    "cauliflower": (0.0, 3.0),
    "watermelon": (10.0, 15.0),
    "cucumber": (10.0, 13.0),
    "grapes": (0.0, 2.0),
    "tomato": (12.0, 15.0),
    "mango": (12.0, 14.0),
    "peas": (0.0, 3.0),
    "papaya": (10.0, 13.0),
    "banana": (13.0, 15.0),
    "brinjal": (10.0, 12.0),
    "eggplant": (10.0, 12.0),
    "guava": (8.0, 10.0),
    "okra": (7.0, 10.0),
    "strawberry": (0.0, 2.0),
    "spinach": (0.0, 2.0),
}

# Storage type multiplier mapping common aliases
STORAGE_EFFICIENCY_MULTIPLIER: Dict[str, float] = {
    "smartbag": 1.45,
    "controlled_atmosphere": 1.45,
    "controlled atmosphere": 1.45,
    "cold_storage": 1.35,
    "cold storage": 1.35,
    "refrigerated": 1.15,
    "ventilated_crate": 1.0,
    "ventilated crate": 1.0,
    "ambient": 0.85,
    "room_temperature": 0.85,
    "room temperature": 0.85,
    "open_market": 0.70,
    "open market": 0.70,
    "sealed_plastic": 0.65,
    "sealed plastic": 0.65,
}

class AgriTraceShelfLifeModel:
    """
    AgriTrace Multi-Factor Postharvest Shelf-Life Heuristic Model:
    Calculates remaining usable shelf life from commodity baseline lifespans,
    thermal degradation (Q10 respiration dynamics), storage atmospheric technology,
    visual freshness/quality indices, and defect penalties.
    """
    def __init__(self, version: Optional[str] = None):
        self.version = version or MODEL_VERSIONS.get("shelf_life_model", "ShelfLife-Physiological-v1.1")

    def predict(
        self,
        produce_type: str,
        freshness_score: float,
        quality_score: float,
        defect_probability: float,
        temperature_c: float,
        humidity_rh: float,
        harvest_age_days: float = 1.0,
        storage_type: str = "ambient"
    ) -> Dict[str, Any]:
        """
        Computes remaining shelf-life prediction with uncertainty bounds and temporal spoilage risks.
        """
        raw_key = produce_type.lower().strip().replace(" ", "_")
        # Handle crop aliases
        alias_map = {
            "bell_pepper": "bell_pepper",
            "capsicum": "bell_pepper",
            "brinjal": "brinjal",
            "eggplant": "brinjal",
            "chili": "chilli",
        }
        prod_key = alias_map.get(raw_key, raw_key)
        base_life = BASE_OPTIMAL_SHELF_LIFE.get(prod_key, 12.0)
        temp_opt_min, temp_opt_max = OPTIMAL_TEMPERATURE_RANGES.get(prod_key, (8.0, 12.0))
        
        storage_key = storage_type.lower().strip()
        storage_mult = STORAGE_EFFICIENCY_MULTIPLIER.get(storage_key, 0.85 if "ambient" in storage_key or "room" in storage_key else 1.0)
        
        # 1. Freshness & Quality factor (0.05 to 1.0)
        # Handle cases where freshness or quality may be missing or passed on different scales
        f_score = float(freshness_score) if freshness_score is not None else 75.0
        q_score = float(quality_score) if quality_score is not None else f_score
        
        # Clamp scores to 0-100 range
        f_score = max(0.0, min(100.0, f_score))
        q_score = max(0.0, min(100.0, q_score))
        
        freshness_factor = (f_score / 100.0) * 0.6 + (q_score / 100.0) * 0.4
        freshness_factor = float(np.clip(freshness_factor, 0.05, 1.0))
        
        # 2. Defect penalty
        # Defect probability from the vision model represents detection confidence of surface blemishes.
        # Moderate penalty prevents 100% defect confidence from destroying healthy tissue capacity.
        d_prob = float(defect_probability) if defect_probability is not None else 0.10
        d_prob = max(0.0, min(1.0, d_prob))
        defect_penalty = float(np.clip(1.0 - (d_prob * 0.25), 0.75, 1.0))
        
        # 3. Arrhenius / Q10 Respiration Thermal Degradation Factor
        # Respiration roughly doubles every 10-12°C above optimal.
        t_c = float(temperature_c) if temperature_c is not None else 22.0
        if t_c > temp_opt_max:
            temp_delta = t_c - temp_opt_max
            thermal_degradation = 1.0 / (1.0 + (temp_delta / 12.0) ** 1.2)
        elif t_c < temp_opt_min:
            # Chilling injury sensitivity for tropical produce (tomatoes, bananas, cucumber, eggplant)
            chill_sensitivity = 1.3 if prod_key in ["tomato", "banana", "cucumber", "brinjal", "papaya"] else 0.4
            temp_delta = temp_opt_min - t_c
            thermal_degradation = 1.0 / (1.0 + (temp_delta * chill_sensitivity / 10.0))
        else:
            thermal_degradation = 1.0
        thermal_degradation = float(np.clip(thermal_degradation, 0.15, 1.0))

        # 4. Relative Humidity Factor (Optimal RH typically 85-95%)
        rh = float(humidity_rh) if humidity_rh is not None else 75.0
        if rh < 55.0:
            humidity_factor = 0.88  # Desiccation / moisture loss
        elif rh > 95.0:
            humidity_factor = 0.90  # Excess condensation
        else:
            humidity_factor = 1.0

        # 5. Core Shelf Life Calculation
        effective_capacity = base_life * storage_mult * freshness_factor * defect_penalty * thermal_degradation * humidity_factor
        
        # Harvest age adjustment: elapsed days since harvest gracefully decay capacity
        h_age = max(0.0, float(harvest_age_days) if harvest_age_days is not None else 1.0)
        age_decay = min(0.35, h_age / (base_life * 1.5))
        remaining_days = max(0.5, effective_capacity * (1.0 - age_decay))
        remaining_days = float(np.round(remaining_days, 2))

        # 6. Empirical Prediction Interval
        # Acknowledged as physiological uncertainty range, uncalibrated Gaussian bound
        sigma = max(0.4, remaining_days * 0.25)
        interval_min = float(np.round(max(0.2, remaining_days - sigma), 1))
        interval_max = float(np.round(remaining_days + sigma, 1))

        # 7. Temporal Spoilage Risk Estimation (Cumulative logistic degradation)
        risk_24h = float(np.round(np.clip(1.0 / (1.0 + np.exp((remaining_days - 1.0) * 1.8)), 0.02, 0.99), 3))
        risk_48h = float(np.round(np.clip(1.0 / (1.0 + np.exp((remaining_days - 2.0) * 1.5)), 0.04, 0.99), 3))
        risk_72h = float(np.round(np.clip(1.0 / (1.0 + np.exp((remaining_days - 3.0) * 1.3)), 0.06, 0.99), 3))

        # 8. Physiological Factor Impacts
        physiological_factor_impacts = {
            "freshness_quality": round(0.35 * (1.0 - freshness_factor), 3),
            "storage_temperature": round(0.35 * (1.0 - thermal_degradation), 3),
            "defect_surface_impact": round(0.15 * (1.0 - defect_penalty), 3),
            "relative_humidity": round(0.10 * (1.0 - humidity_factor), 3),
            "storage_technology": round(0.05 * (storage_mult - 1.0), 3)
        }

        # User-facing wording for whole days and positive values under 1 day
        if remaining_days < 1.0:
            life_text = "less than 1 day"
            display_shelf_life = "Less than 1 day"
        elif round(remaining_days) == 1:
            life_text = "1 day"
            display_shelf_life = "1 day"
        else:
            life_text = f"{round(remaining_days)} days"
            display_shelf_life = f"{round(remaining_days)} days"

        explanation = (
            f"Estimated remaining shelf life is {life_text} ({remaining_days:.2f} days numeric, "
            f"estimated range: {interval_min}–{interval_max} days). "
            f"24h spoilage risk is {risk_24h*100:.1f}%, 48h risk is {risk_48h*100:.1f}%."
        )

        return {
            "model_version": self.version,
            "model_type": "physiological_heuristic",
            "produce_type": prod_key,
            "predicted_shelf_life_days": remaining_days,
            "display_shelf_life": display_shelf_life,
            "prediction_interval_90": {
                "min_days": interval_min,
                "max_days": interval_max,
                "confidence_level": "Estimated Range (Physiological Heuristic, Uncalibrated)"
            },
            "spoilage_risk": {
                "risk_24h": risk_24h,
                "risk_48h": risk_48h,
                "risk_72h": risk_72h,
                "urgency_level": "HIGH" if risk_48h > 0.50 else ("MODERATE" if risk_48h > 0.25 else "LOW")
            },
            "thermal_degradation_factor": round(thermal_degradation, 3),
            "feature_importance": physiological_factor_impacts,
            "explanation": explanation
        }

# Aliases for architectural clarity and backwards compatibility
AgriTracePhysiologicalShelfLifeModel = AgriTraceShelfLifeModel

# Global singleton
_GLOBAL_SHELF_LIFE_MODEL = AgriTraceShelfLifeModel()

def predict_shelf_life(**kwargs) -> Dict[str, Any]:
    return _GLOBAL_SHELF_LIFE_MODEL.predict(**kwargs)
