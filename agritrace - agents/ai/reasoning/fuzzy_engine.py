"""
AgriTrace Fuzzy Risk & Urgency Inference Engine (Fuzzy Risk Engine v1.0)
Implements Mamdani Fuzzy Inference to model uncertainty in produce freshness,
thermal risk, market trends, and buyer proximity.
"""

from typing import Dict, Any
import numpy as np
from ai.version_registry import MODEL_VERSIONS

def _triangular_membership(x: float, a: float, b: float, c: float) -> float:
    """Computes triangular membership function μ(x)."""
    if x <= a or x >= c:
        return 0.0
    elif a < x <= b:
        return (x - a) / (b - a + 1e-6)
    else:
        return (c - x) / (c - b + 1e-6)

def _trapezoidal_membership(x: float, a: float, b: float, c: float, d: float) -> float:
    """Computes trapezoidal membership function μ(x)."""
    if x <= a or x >= d:
        return 0.0
    elif a < x <= b:
        return (x - a) / (b - a + 1e-6)
    elif b < x <= c:
        return 1.0
    else:
        return (d - x) / (d - c + 1e-6)

class AgriTraceFuzzyRiskEngine:
    """
    Mamdani Fuzzy Inference System for Agricultural Decision-Making.
    Evaluates Action Urgency Score and Storage Feasibility.
    """
    def __init__(self, version: str = MODEL_VERSIONS["risk_engine"]):
        self.version = version

    def evaluate(
        self,
        freshness_score: float,       # 0 to 100
        remaining_shelf_life: float,  # days
        spoilage_risk_48h: float,     # 0.0 to 1.0
        price_trend: str = "falling", # falling, stable, rising
        nearest_buyer_km: float = 15.0 # km
    ) -> Dict[str, Any]:
        """
        Fuzzifies inputs, evaluates agricultural rules, and defuzzifies to Action Urgency (0-100).
        """
        # 1. Fuzzify Freshness
        mu_fresh_low = _trapezoidal_membership(freshness_score, 0, 0, 40, 60)
        mu_fresh_med = _triangular_membership(freshness_score, 45, 65, 85)
        mu_fresh_high = _trapezoidal_membership(freshness_score, 70, 85, 100, 100)

        # 2. Fuzzify Shelf Life (Days)
        mu_shelf_short = _trapezoidal_membership(remaining_shelf_life, 0, 0, 2.0, 3.5)
        mu_shelf_med = _triangular_membership(remaining_shelf_life, 2.5, 4.5, 7.0)
        mu_shelf_long = _trapezoidal_membership(remaining_shelf_life, 5.5, 8.0, 30.0, 30.0)

        # 3. Fuzzify Spoilage Risk
        mu_risk_low = _trapezoidal_membership(spoilage_risk_48h, 0, 0, 0.20, 0.35)
        mu_risk_med = _triangular_membership(spoilage_risk_48h, 0.25, 0.50, 0.70)
        mu_risk_high = _trapezoidal_membership(spoilage_risk_48h, 0.60, 0.80, 1.0, 1.0)

        # 4. Fuzzify Buyer Distance (km)
        mu_dist_near = _trapezoidal_membership(nearest_buyer_km, 0, 0, 10, 25)
        mu_dist_moderate = _triangular_membership(nearest_buyer_km, 15, 35, 60)
        mu_dist_far = _trapezoidal_membership(nearest_buyer_km, 45, 75, 200, 200)

        # 5. Rule Base Evaluation (Mamdani Min-Max)
        # Rule 1: IF Freshness is LOW and ShelfLife is SHORT -> Urgency is CRITICAL
        r1 = min(mu_fresh_low, mu_shelf_short)
        # Rule 2: IF SpoilageRisk is HIGH and Buyer is NEAR -> Urgency is VERY_HIGH
        r2 = min(mu_risk_high, mu_dist_near)
        # Rule 3: IF PriceTrend is FALLING and ShelfLife is SHORT -> Urgency is HIGH
        r3 = min(1.0 if price_trend == "falling" else 0.0, mu_shelf_short)
        # Rule 4: IF Freshness is HIGH and SpoilageRisk is LOW and Price is RISING -> Urgency is LOW (Store)
        r4 = min(mu_fresh_high, mu_risk_low, 1.0 if price_trend == "rising" else 0.0)
        # Rule 5: IF ShelfLife is LONG and Risk is LOW -> Urgency is LOW
        r5 = min(mu_shelf_long, mu_risk_low)

        urgency_critical = max(r1, r2)
        urgency_high = r3
        urgency_moderate = max(mu_fresh_med, mu_risk_med) * 0.7
        urgency_low = max(r4, r5)

        # 6. Centroid Defuzzification
        # Universe: Urgency from 0 to 100
        # Centers: LOW=15, MODERATE=45, HIGH=75, CRITICAL=95
        numerator = (
            urgency_low * 15.0 +
            urgency_moderate * 45.0 +
            urgency_high * 75.0 +
            urgency_critical * 95.0
        )
        denominator = urgency_low + urgency_moderate + urgency_high + urgency_critical + 1e-6
        action_urgency_score = float(np.clip(numerator / denominator, 5.0, 98.0))

        # Categorical Urgency Label
        if action_urgency_score >= 80.0:
            urgency_label = "CRITICAL"
            recommended_timing = "Within 12-24 Hours"
        elif action_urgency_score >= 60.0:
            urgency_label = "HIGH"
            recommended_timing = "Within 24-48 Hours"
        elif action_urgency_score >= 35.0:
            urgency_label = "MODERATE"
            recommended_timing = "Within 3-5 Days"
        else:
            urgency_label = "LOW"
            recommended_timing = "Safe to Store (5+ Days)"

        storage_feasibility = float(np.clip(100.0 - action_urgency_score, 2.0, 98.0))

        explanation = (
            f"Fuzzy inference computed an Action Urgency of {action_urgency_score:.1f}/100 ({urgency_label}). "
            f"Storage feasibility score is {storage_feasibility:.1f}/100. Action window: {recommended_timing}."
        )

        return {
            "model_version": self.version,
            "action_urgency_score": round(action_urgency_score, 1),
            "urgency_label": urgency_label,
            "recommended_timing": recommended_timing,
            "storage_feasibility": round(storage_feasibility, 1),
            "membership_degrees": {
                "freshness_high": round(float(mu_fresh_high), 3),
                "shelf_short": round(float(mu_shelf_short), 3),
                "risk_high": round(float(mu_risk_high), 3),
                "dist_near": round(float(mu_dist_near), 3)
            },
            "explanation": explanation
        }

_GLOBAL_FUZZY_ENGINE = AgriTraceFuzzyRiskEngine()

def evaluate_fuzzy_risk(**kwargs) -> Dict[str, Any]:
    return _GLOBAL_FUZZY_ENGINE.evaluate(**kwargs)
