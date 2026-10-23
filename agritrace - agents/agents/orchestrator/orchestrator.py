"""
AgriTrace Agent Orchestrator
Executes Computational Thinking DAG workflow coordinating autonomous specialized agents.
Decomposition -> Pattern Recognition -> Abstraction -> Algorithmic Execution -> Action & Trace
"""

from typing import Dict, Any, List, Optional
import time
import uuid

from ai.version_registry import get_system_manifest
from agents.vision_agent import VisionAgent
from agents.shelf_life_agent import ShelfLifeAgent
from agents.risk_agent import RiskAgent
from agents.storage_agent import StorageAgent
from agents.market_agent import MarketAgent
from agents.logistics_agent import LogisticsAgent
from agents.buyer_agent import BuyerAgent
from agents.decision_agent import DecisionAgent

class AgentOrchestrator:
    """
    Coordinates multi-agent perception, reasoning, planning, and action cycles.
    """
    def __init__(self):
        self.vision_agent = VisionAgent()
        self.shelf_life_agent = ShelfLifeAgent()
        self.risk_agent = RiskAgent()
        self.storage_agent = StorageAgent()
        self.market_agent = MarketAgent()
        self.logistics_agent = LogisticsAgent()
        self.buyer_agent = BuyerAgent()
        self.decision_agent = DecisionAgent()

    def run_pipeline(
        self,
        batch_id: str,
        image=None,
        produce_type: str = "tomato",
        quantity_kg: float = 500.0,
        telemetry: Optional[Dict[str, Any]] = None,
        market_trend: str = "falling",
        candidate_buyers: Optional[List[Dict[str, Any]]] = None,
        human_override: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Executes the end-to-end multi-agent DAG workflow.
        """
        run_id = f"RUN-{uuid.uuid4().hex[:8].upper()}"
        start_time = time.time()
        
        # Shared Pipeline State
        state: Dict[str, Any] = {
            "run_id": run_id,
            "batch_id": batch_id,
            "image": image,
            "produce_type": produce_type,
            "quantity_kg": quantity_kg,
            "telemetry": telemetry or {"temperature_c": 24.0, "humidity_rh": 78.0, "gas_voc_ppm": 15.0},
            "market_trend": market_trend,
            "candidate_buyers": candidate_buyers or [],
            "human_override": human_override
        }

        dag_trace: List[Dict[str, Any]] = []

        # Step 1: Vision Agent
        vis_res = self.vision_agent.run(state)
        state["vision_agent_output"] = vis_res.get("output", {})
        if vis_res.get("output") and vis_res["output"].get("produce_type"):
            state["produce_type"] = vis_res["output"]["produce_type"]
            state["quality_score"] = vis_res["output"].get("quality_score", 70.0)
        dag_trace.append(vis_res)

        # Early check for OOD rejection
        if vis_res.get("output", {}).get("status") in ["REJECTED_BAD_QUALITY", "REJECTED_OOD"]:
            total_duration = round((time.time() - start_time) * 1000, 2)
            return {
                "run_id": run_id,
                "batch_id": batch_id,
                "status": "REJECTED",
                "message": vis_res["output"]["message"],
                "total_duration_ms": total_duration,
                "dag_trace": dag_trace,
                "manifest": get_system_manifest()
            }

        # Step 2: Shelf-Life Agent
        shelf_res = self.shelf_life_agent.run(state)
        state["shelf_life_agent_output"] = shelf_res.get("output", {})
        dag_trace.append(shelf_res)

        # Step 3: Risk Agent
        risk_res = self.risk_agent.run(state)
        state["risk_agent_output"] = risk_res.get("output", {})
        dag_trace.append(risk_res)

        # Step 4: Storage / SmartBag Agent
        storage_res = self.storage_agent.run(state)
        state["storage_agent_output"] = storage_res.get("output", {})
        dag_trace.append(storage_res)

        # Step 5: Market Intelligence Agent
        market_res = self.market_agent.run(state)
        state["market_agent_output"] = market_res.get("output", {})
        dag_trace.append(market_res)

        # Step 6: Buyer Matching Agent
        buyer_res = self.buyer_agent.run(state)
        state["buyer_agent_output"] = buyer_res.get("output", {})
        dag_trace.append(buyer_res)

        # Step 7: Logistics Agent
        logistics_res = self.logistics_agent.run(state)
        state["logistics_agent_output"] = logistics_res.get("output", {})
        dag_trace.append(logistics_res)

        # Step 8: Central Decision Agent
        decision_res = self.decision_agent.run(state)
        state["decision_agent_output"] = decision_res.get("output", {})
        dag_trace.append(decision_res)

        total_duration = round((time.time() - start_time) * 1000, 2)

        final_decision = decision_res.get("output", {})

        return {
            "run_id": run_id,
            "batch_id": batch_id,
            "status": "COMPLETED",
            "produce_type": state["produce_type"],
            "action_summary": final_decision.get("recommended_action", "Action determined"),
            "action_type": final_decision.get("action_type", "MONITOR"),
            "urgency": final_decision.get("urgency", "MODERATE"),
            "timing_window": final_decision.get("timing_window", "Within 48h"),
            "allocation_plan": final_decision.get("allocation_plan", []),
            "total_duration_ms": total_duration,
            "perception": vis_res.get("output", {}),
            "prediction": shelf_res.get("output", {}),
            "risk": risk_res.get("output", {}),
            "storage": storage_res.get("output", {}),
            "market": market_res.get("output", {}),
            "buyer": buyer_res.get("output", {}),
            "logistics": logistics_res.get("output", {}),
            "decision": final_decision,
            "dag_trace": dag_trace,
            "manifest": get_system_manifest()
        }

_GLOBAL_ORCHESTRATOR = AgentOrchestrator()

def orchestrate_batch(**kwargs) -> Dict[str, Any]:
    return _GLOBAL_ORCHESTRATOR.run_pipeline(**kwargs)
