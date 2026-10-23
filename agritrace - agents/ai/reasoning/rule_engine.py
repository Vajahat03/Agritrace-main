"""
AgriTrace Hard Safety Rules & Constraint Validation Engine
Enforces inviolable food safety constraints and human override authority.
"""

from typing import Dict, Any, List, Optional
from ai.version_registry import MODEL_VERSIONS

class SafetyRuleEngine:
    """
    Evaluates hard constraints that supersede all optimization and agent recommendations.
    Hierarchy:
      1. Human Override (ALWAYS WINS)
      2. Food Safety Violation (DISCARD / ISOLATE / ALERT)
      3. Critical Thermal Hazard (COOLING / SMARTBAG ACTUATION)
      4. Transport Shelf-Life Expiry (REJECT ROUTE)
    """
    def __init__(self, version: str = MODEL_VERSIONS["decision_policy"]):
        self.version = version

    def evaluate_constraints(
        self,
        freshness_grade: str,
        quality_score: float,
        remaining_shelf_life: float,
        temperature_c: float,
        human_override: Optional[Dict[str, Any]] = None,
        estimated_transit_hours: float = 0.0
    ) -> Dict[str, Any]:
        """
        Validates safety rules and constraints.
        Returns safety verdict, triggered constraints, and mandatory actions.
        """
        triggered_rules: List[str] = []
        is_safe: bool = True
        mandatory_action: Optional[str] = None
        safety_status: str = "PASSED"

        # 1. Human Override Check (Supreme Authority)
        if human_override and human_override.get("enabled", False):
            override_action = human_override.get("action", "MANUAL_OVERRIDE")
            return {
                "rule_engine_version": self.version,
                "safety_status": "HUMAN_OVERRIDE_APPLIED",
                "is_safe": True,
                "mandatory_action": override_action,
                "override_details": human_override,
                "explanation": f"Human operator manually enacted override action: '{override_action}'."
            }

        # 2. Food Safety & Severe Rot Constraint
        if freshness_grade == "spoiled" or quality_score < 20.0 or remaining_shelf_life <= 0.2:
            is_safe = False
            safety_status = "FOOD_SAFETY_VIOLATION"
            mandatory_action = "DISCARD_AND_ISOLATE"
            triggered_rules.append("Severe produce decay detected. Inviolable safety rule prohibits commercial sale or human consumption.")

        # 3. Critical Thermal Breach in Storage
        if temperature_c >= 28.0:
            safety_status = "CRITICAL_THERMAL_ALERT"
            triggered_rules.append(f"Storage temperature ({temperature_c}°C) exceeds safe ceiling (>28°C). Immediate cooling required.")
            if not mandatory_action:
                mandatory_action = "TRIGGER_SMARTBAG_COOLING"

        # 4. Logistics Transit Viability Constraint
        transit_days = estimated_transit_hours / 24.0
        if transit_days > remaining_shelf_life and remaining_shelf_life > 0.3:
            triggered_rules.append(f"Transit duration ({estimated_transit_hours}h) exceeds remaining shelf life ({remaining_shelf_life*24:.1f}h). Route rejected.")

        explanation = (
            f"Safety verification status: {safety_status}. "
            + (" ".join(triggered_rules) if triggered_rules else "All mandatory safety checks cleared.")
        )

        return {
            "rule_engine_version": self.version,
            "safety_status": safety_status,
            "is_safe": is_safe,
            "mandatory_action": mandatory_action,
            "triggered_rules": triggered_rules,
            "explanation": explanation
        }

_GLOBAL_RULE_ENGINE = SafetyRuleEngine()

def check_safety_rules(**kwargs) -> Dict[str, Any]:
    return _GLOBAL_RULE_ENGINE.evaluate_constraints(**kwargs)
