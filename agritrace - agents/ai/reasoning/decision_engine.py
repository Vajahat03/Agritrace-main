"""
AgriTrace Hybrid Decision Engine (Decision Policy v1.0)
Synthesizes multi-agent predictions, fuzzy risk evaluation, hard safety constraints,
and genetic optimization into an actionable produce strategy.
"""

from typing import Dict, Any, List, Optional
from ai.version_registry import MODEL_VERSIONS
from ai.reasoning.fuzzy_engine import evaluate_fuzzy_risk
from ai.reasoning.rule_engine import check_safety_rules
from ai.reasoning.genetic_optimizer import run_genetic_optimization

class HybridDecisionEngine:
    def __init__(self, version: str = MODEL_VERSIONS["decision_policy"]):
        self.version = version

    def formulate_action_plan(
        self,
        batch_id: str,
        produce_type: str,
        quantity_kg: float,
        vision_result: Dict[str, Any],
        shelf_life_result: Dict[str, Any],
        environmental_telemetry: Dict[str, Any],
        market_intel: Dict[str, Any],
        candidate_buyers: List[Dict[str, Any]],
        human_override: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Formulates the final autonomous action plan.
        """
        freshness_grade = vision_result.get("freshness_grade", "moderately_fresh")
        quality_score = vision_result.get("quality_score", 70.0)
        freshness_score = vision_result.get("quality_score", 70.0)
        
        predicted_shelf_life = shelf_life_result.get("predicted_shelf_life_days", 3.0)
        spoilage_48h = shelf_life_result.get("spoilage_risk", {}).get("risk_48h", 0.3)
        
        temperature_c = environmental_telemetry.get("temperature_c", 22.0)
        price_trend = market_intel.get("price_trend", "stable")
        
        nearest_buyer_dist = 15.0
        if candidate_buyers:
            nearest_buyer_dist = min([b.get("distance_km", 15.0) for b in candidate_buyers])

        # Step 1: Inviolable Safety Constraint Evaluation
        safety_check = check_safety_rules(
            freshness_grade=freshness_grade,
            quality_score=quality_score,
            remaining_shelf_life=predicted_shelf_life,
            temperature_c=temperature_c,
            human_override=human_override
        )

        if not safety_check["is_safe"] or safety_check["safety_status"] == "HUMAN_OVERRIDE_APPLIED":
            action_code = safety_check["mandatory_action"]
            return {
                "decision_version": self.version,
                "batch_id": batch_id,
                "action_type": action_code,
                "urgency": "CRITICAL" if not safety_check["is_safe"] else "MANUAL",
                "recommended_action": f"ENACT {action_code}",
                "safety_status": safety_check["safety_status"],
                "reasoning_trace": [
                    safety_check["explanation"]
                ],
                "allocation_plan": [],
                "monitoring_frequency": "Continuous",
                "versions_used": MODEL_VERSIONS.copy()
            }

        # Step 2: Mamdani Fuzzy Risk & Urgency Inference
        fuzzy_eval = evaluate_fuzzy_risk(
            freshness_score=freshness_score,
            remaining_shelf_life=predicted_shelf_life,
            spoilage_risk_48h=spoilage_48h,
            price_trend=price_trend,
            nearest_buyer_km=nearest_buyer_dist
        )
        urgency_score = fuzzy_eval["action_urgency_score"]
        urgency_label = fuzzy_eval["urgency_label"]

        # Step 3: Action Determination Policy
        reasoning_trace: List[str] = [
            f"Perception: {produce_type.title()} quality assessed at {quality_score}/100 with freshness '{freshness_grade}'.",
            f"Prediction: Remaining shelf life estimated at {predicted_shelf_life} days with {spoilage_48h*100:.1f}% 48h spoilage risk.",
            f"Fuzzy Risk: Evaluated action urgency score of {urgency_score}/100 ({urgency_label})."
        ]

        allocation_plan = []
        action_type = "MONITOR"
        recommended_action = "Maintain standard storage and continue daily monitoring."

        # Case A: Urgent Sale Needed (Short shelf life / High urgency / Falling price)
        if predicted_shelf_life <= 2.5 or urgency_score >= 60.0:
            action_type = "SELL_NOW" if predicted_shelf_life <= 1.5 else "SELL_SOON"
            
            # Use Genetic Algorithm if complex (multiple candidate buyers and batch > 50kg)
            if len(candidate_buyers) > 1 and quantity_kg >= 50.0:
                ga_result = run_genetic_optimization(
                    total_quantity_kg=quantity_kg,
                    remaining_shelf_life_days=predicted_shelf_life,
                    current_freshness_score=freshness_score,
                    candidate_buyers=candidate_buyers,
                    base_market_price_per_kg=market_intel.get("current_price_per_kg", 30.0)
                )
                allocation_plan = ga_result["recommended_allocation"]
                reasoning_trace.append(ga_result["explanation"])
                
                top_buyer = allocation_plan[0] if allocation_plan else None
                if top_buyer:
                    recommended_action = (
                        f"{action_type.replace('_', ' ')} — Allocate {top_buyer['allocated_quantity_kg']} kg to "
                        f"{top_buyer['buyer_name']} ({top_buyer['distance_km']} km away) within {fuzzy_eval['recommended_timing']}."
                    )
            else:
                # Direct Rule Selection for single buyer or small batch
                best_buyer = candidate_buyers[0] if candidate_buyers else {
                    "name": "Local Agricultural Market",
                    "distance_km": nearest_buyer_dist,
                    "offered_price_per_kg": market_intel.get("current_price_per_kg", 25.0)
                }
                allocation_plan = [{
                    "buyer_name": best_buyer.get("name", "Local Buyer"),
                    "allocated_quantity_kg": quantity_kg,
                    "offered_price_per_kg": best_buyer.get("offered_price_per_kg", 25.0),
                    "distance_km": best_buyer.get("distance_km", 10.0),
                    "estimated_transit_hours": round(best_buyer.get("distance_km", 10.0) / 35.0, 1),
                    "projected_revenue": round(quantity_kg * best_buyer.get("offered_price_per_kg", 25.0), 2)
                }]
                recommended_action = (
                    f"{action_type.replace('_', ' ')} — Deliver {quantity_kg} kg to {allocation_plan[0]['buyer_name']} "
                    f"within {fuzzy_eval['recommended_timing']} to avoid post-harvest food waste."
                )

        # Case B: High Thermal Risk / Storage Adjustment
        elif temperature_c >= 22.0 and environmental_telemetry.get("smartbag_active", False):
            action_type = "TRIGGER_COOLING"
            recommended_action = f"Activate SmartBag thermoelectric cooling to drop temperature from {temperature_c}°C to 14°C."
            reasoning_trace.append("Thermal risk elevated; automated SmartBag cooling adjustment requested to extend shelf life.")

        # Case C: Safe to Store
        else:
            action_type = "STORE_AND_MONITOR"
            recommended_action = f"Produce condition is healthy ({predicted_shelf_life} days remaining). Safe to store in cool ventilated area."
            reasoning_trace.append("Quality is high, market trend is favorable, and environmental risks are nominal. Storage recommended.")

        return {
            "decision_version": self.version,
            "batch_id": batch_id,
            "action_type": action_type,
            "urgency": urgency_label,
            "action_urgency_score": urgency_score,
            "recommended_action": recommended_action,
            "timing_window": fuzzy_eval["recommended_timing"],
            "storage_feasibility": fuzzy_eval["storage_feasibility"],
            "safety_status": safety_check["safety_status"],
            "reasoning_trace": reasoning_trace,
            "allocation_plan": allocation_plan,
            "monitoring_frequency": "Every 6 Hours" if urgency_score >= 60.0 else "Daily",
            "versions_used": MODEL_VERSIONS.copy()
        }

_GLOBAL_DECISION_ENGINE = HybridDecisionEngine()

def make_decision(**kwargs) -> Dict[str, Any]:
    return _GLOBAL_DECISION_ENGINE.formulate_action_plan(**kwargs)
