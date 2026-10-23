"""
AgriTrace Central Decision / Planning Agent
Final authority synthesizing specialized agent findings into clear action directives.
"""

from typing import Dict, Any
from agents.base_agent import BaseAgent
from ai.version_registry import MODEL_VERSIONS
from ai.reasoning.decision_engine import make_decision

class DecisionAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Decision/Planning Agent",
            goal="Synthesize multi-agent perception, prediction, risks, and economic factors into an optimal, explainable action plan.",
            version=MODEL_VERSIONS["decision_policy"]
        )

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        batch_id = state.get("batch_id", "BATCH-001")
        quantity_kg = state.get("quantity_kg", 500.0)
        produce_type = state.get("produce_type", "tomato")
        
        vision_res = state.get("vision_agent_output", {})
        shelf_life_res = state.get("shelf_life_agent_output", {})
        risk_res = state.get("risk_agent_output", {})
        market_res = state.get("market_agent_output", {})
        buyer_res = state.get("buyer_agent_output", {})
        candidate_buyers = buyer_res.get("top_matches", state.get("candidate_buyers", []))
        human_override = state.get("human_override")

        decision_result = make_decision(
            batch_id=batch_id,
            produce_type=produce_type,
            quantity_kg=quantity_kg,
            vision_result=vision_res,
            shelf_life_result=shelf_life_res,
            environmental_telemetry=risk_res,
            market_intel=market_res,
            candidate_buyers=candidate_buyers,
            human_override=human_override
        )

        return {
            "output": decision_result,
            "confidence": 0.96,
            "evidence": decision_result.get("reasoning_trace", ["Decision plan formulated."])
        }
