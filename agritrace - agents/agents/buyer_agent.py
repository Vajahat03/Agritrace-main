"""
AgriTrace Buyer Matching Agent
Matches produce batches with candidate wholesale, retail, and food processor buyers based on multi-criteria scoring.
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent
from ai.version_registry import MODEL_VERSIONS

class BuyerAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Buyer Matching Agent",
            goal="Identify and rank compatible buyers using distance, price, quality requirements, and reliability metrics.",
            version=MODEL_VERSIONS["decision_policy"]
        )

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        produce_type = state.get("produce_type", "tomato").lower()
        quality_score = state.get("quality_score", 72.0)
        remaining_days = state.get("shelf_life_agent_output", {}).get("predicted_shelf_life_days", 3.0)
        
        buyers = state.get("candidate_buyers")
        if not buyers:
            buyers = [
                {"id": "b1", "name": "Kisan Fresh Hub (Retail)", "distance_km": 12.0, "offered_price_per_kg": 34.0, "min_quality": 65.0, "reliability": 0.95, "max_capacity_kg": 300},
                {"id": "b2", "name": "Sahyadri Food Processors (Sauce/Puree)", "distance_km": 18.0, "offered_price_per_kg": 29.0, "min_quality": 40.0, "reliability": 0.98, "max_capacity_kg": 1000},
                {"id": "b3", "name": "Apex City Wholesaler", "distance_km": 42.0, "offered_price_per_kg": 36.0, "min_quality": 75.0, "reliability": 0.88, "max_capacity_kg": 500}
            ]

        scored_buyers = []
        for b in buyers:
            # 1. Quality Compatibility (0.0 to 1.0)
            min_q = b.get("min_quality", 50.0)
            quality_comp = 1.0 if quality_score >= min_q else max(0.0, 1.0 - (min_q - quality_score) / 30.0)
            
            # 2. Distance Score (Closer is better)
            dist_km = b.get("distance_km", 20.0)
            dist_score = max(0.1, 1.0 - (dist_km / 100.0))
            
            # 3. Urgency suitability (Short shelf life favors close buyers)
            urgency_factor = 1.2 if (remaining_days <= 2.5 and dist_km <= 20.0) else 1.0
            
            # 4. Total Composite Score (0 to 100)
            composite_score = (
                quality_comp * 0.35 +
                dist_score * 0.25 +
                (b.get("offered_price_per_kg", 30.0) / 40.0) * 0.20 +
                b.get("reliability", 0.9) * 0.20
            ) * urgency_factor * 100.0
            composite_score = float(min(99.0, max(10.0, composite_score)))

            scored_buyers.append({
                **b,
                "compatibility_score": round(composite_score, 1),
                "quality_compatible": quality_score >= min_q
            })

        scored_buyers.sort(key=lambda x: x["compatibility_score"], reverse=True)
        top_buyer = scored_buyers[0] if scored_buyers else None

        return {
            "output": {
                "top_matches": scored_buyers,
                "best_buyer": top_buyer,
                "total_available_buyers": len(scored_buyers)
            },
            "confidence": 0.95,
            "evidence": [
                f"Ranked {len(scored_buyers)} buyers. Top match: {top_buyer['name']} ({top_buyer['compatibility_score']}% compatibility)." if top_buyer else "No compatible buyers available."
            ]
        }
