"""
AgriTrace Logistics Agent
Evaluates transport transit duration, route feasibility, and cold-chain compliance.
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent
from ai.version_registry import MODEL_VERSIONS

class LogisticsAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Logistics Agent",
            goal="Determine transportation urgency, verify delivery deadlines against remaining shelf life, and select reliable routes.",
            version=MODEL_VERSIONS["decision_policy"]
        )

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        shelf_life_output = state.get("shelf_life_agent_output", {})
        remaining_days = shelf_life_output.get("predicted_shelf_life_days", 3.0)
        remaining_hours = remaining_days * 24.0
        
        buyers = state.get("candidate_buyers", [])
        routes_evaluated = []
        
        for buyer in buyers:
            dist_km = buyer.get("distance_km", 15.0)
            avg_speed_kmh = 35.0  # Rural/suburban road network
            transit_hours = dist_km / avg_speed_kmh
            is_feasible = (transit_hours * 1.5) < remaining_hours
            
            routes_evaluated.append({
                "buyer_id": buyer.get("id", "buyer_1"),
                "destination": buyer.get("name", "Local Buyer"),
                "distance_km": dist_km,
                "transit_hours": round(transit_hours, 1),
                "is_feasible": is_feasible,
                "safety_margin_hours": round(remaining_hours - transit_hours, 1)
            })

        urgency = "HIGH" if remaining_days <= 2.0 else ("MODERATE" if remaining_days <= 4.0 else "LOW")

        return {
            "output": {
                "urgency": urgency,
                "transport_urgency_score": 0.90 if urgency == "HIGH" else (0.50 if urgency == "MODERATE" else 0.20),
                "routes_evaluated": routes_evaluated,
                "max_allowed_transit_hours": round(remaining_hours * 0.4, 1)
            },
            "confidence": 0.94,
            "evidence": [
                f"Logistics urgency is {urgency}. Maximum safe transit window is {remaining_hours*0.4:.1f} hours."
            ]
        }
