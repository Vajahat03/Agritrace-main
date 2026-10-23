"""
AgriTrace Dependency-Aware DAG Orchestrator
Coordinates the eight specialized agricultural AI agents with explicit dependency tracking,
cycle detection, wave-based concurrent execution, upstream failure propagation,
partial success reporting, and graceful retry support.
"""

import sys
import time
import asyncio
import logging
from typing import Dict, Any, List, Set, Optional
from datetime import datetime, timezone
from pathlib import Path

# Ensure AI agents directory is in sys.path
from ..core.config import AGENTS_DIR, ROOT_DIR
if str(AGENTS_DIR) not in sys.path:
    sys.path.insert(0, str(AGENTS_DIR))

from agents.vision_agent import VisionAgent
from agents.shelf_life_agent import ShelfLifeAgent
from agents.risk_agent import RiskAgent
from agents.storage_agent import StorageAgent
from agents.market_agent import MarketAgent
from agents.buyer_agent import BuyerAgent
from agents.logistics_agent import LogisticsAgent
from agents.decision_agent import DecisionAgent

logger = logging.getLogger("agritrace.ai.orchestrator")

AGENT_DEPENDENCIES: Dict[str, List[str]] = {
    "vision": [],
    "shelf_life": ["vision"],
    "risk": [],
    "storage": ["risk"],
    "market": ["vision"],
    "buyer": ["vision", "shelf_life"],
    "logistics": ["shelf_life", "buyer"],
    "decision": ["vision", "shelf_life", "risk", "storage", "market", "buyer", "logistics"],
}

AGENT_META: Dict[str, Dict[str, str]] = {
    "vision": {
        "name": "Produce & Defect Vision Agent",
        "goal": "Perceive commodity identity, assess visual freshness, detect surface defects and quality.",
    },
    "shelf_life": {
        "name": "Shelf-Life Forecasting Agent",
        "goal": "Predict remaining usable shelf life, 90% prediction intervals, and multi-horizon spoilage curves.",
    },
    "risk": {
        "name": "Environmental Risk Agent",
        "goal": "Analyze microclimate temperature, moisture saturation, and ethylene gas degradation risks.",
    },
    "storage": {
        "name": "Storage / SmartBag Agent",
        "goal": "Prescribe microclimate cooling, ventilation, and atmospheric storage holding parameters.",
    },
    "market": {
        "name": "Market Intelligence Agent",
        "goal": "Analyze commodity benchmark prices, localized price trends, and economic selling windows.",
    },
    "buyer": {
        "name": "Buyer Matching Agent",
        "goal": "Match produce against genuine buyer profiles using quality, distance, urgency, and pricing criteria.",
    },
    "logistics": {
        "name": "Logistics Feasibility Agent",
        "goal": "Evaluate transit duration, route feasibility, and verify delivery deadlines against remaining shelf life.",
    },
    "decision": {
        "name": "Central Decision & Planning Agent",
        "goal": "Synthesize validated upstream intelligence into an actionable, explainable operational directive.",
    },
}

class DAGOrchestrator:
    """
    Dependency-aware DAG Orchestrator executing the 8 specialized agents.
    Uses topological execution waves to run independent agents concurrently.
    """
    def __init__(self):
        self.dependencies = AGENT_DEPENDENCIES
        self._validate_dag(self.dependencies)

        # Instantiate agent instances
        self.agents = {
            "vision": VisionAgent(),
            "shelf_life": ShelfLifeAgent(),
            "risk": RiskAgent(),
            "storage": StorageAgent(),
            "market": MarketAgent(),
            "buyer": BuyerAgent(),
            "logistics": LogisticsAgent(),
            "decision": DecisionAgent(),
        }

    def _validate_dag(self, graph: Dict[str, List[str]]):
        """
        Validates that the dependency graph has no cycles using Kahn's algorithm.
        """
        in_degree = {k: 0 for k in graph}
        for node, deps in graph.items():
            for dep in deps:
                if dep not in graph:
                    raise ValueError(f"Unknown agent dependency '{dep}' for node '{node}'")
        
        # Calculate in-degree (count how many nodes depend on node)
        adj: Dict[str, List[str]] = {k: [] for k in graph}
        for node, deps in graph.items():
            in_degree[node] = len(deps)
            for dep in deps:
                adj[dep].append(node)

        queue = [k for k, deg in in_degree.items() if deg == 0]
        visited_count = 0

        while queue:
            curr = queue.pop(0)
            visited_count += 1
            for neighbor in adj[curr]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    queue.append(neighbor)

        if visited_count != len(graph):
            raise ValueError("Cyclic dependency detected in agent DAG")

    async def _execute_agent_node(
        self,
        agent_id: str,
        state: Dict[str, Any],
        agent_states: Dict[str, Dict[str, Any]],
        timeout_seconds: float = 12.0
    ) -> Dict[str, Any]:
        """
        Executes a single agent node within a bounded async task.
        """
        agent = self.agents[agent_id]
        meta = AGENT_META[agent_id]
        start_iso = datetime.now(timezone.utc).isoformat()
        t0 = time.time()

        agent_states[agent_id]["status"] = "RUNNING"
        agent_states[agent_id]["started_at"] = start_iso

        try:
            # Run synchronous agent code in default thread pool executor to prevent event loop blocking
            loop = asyncio.get_running_loop()
            result = await asyncio.wait_for(
                loop.run_in_executor(None, agent.run, state),
                timeout=timeout_seconds,
            )

            latency = round((time.time() - t0) * 1000, 2)
            completed_iso = datetime.now(timezone.utc).isoformat()

            if result.get("status") == "SUCCESS":
                agent_states[agent_id].update({
                    "status": "SUCCESS",
                    "execution_time_ms": latency,
                    "confidence": result.get("confidence", 0.9),
                    "output": result.get("output"),
                    "evidence": result.get("evidence", []),
                    "completed_at": completed_iso,
                })
                # Update pipeline state with agent output key
                state_key = f"{agent_id}_agent_output"
                state[state_key] = result.get("output", {})
                if agent_id == "vision" and result.get("output"):
                    out = result["output"]
                    if out.get("produce_type"):
                        state["produce_type"] = out["produce_type"]
                    if out.get("quality_score") is not None:
                        state["quality_score"] = out["quality_score"]
                return result
            else:
                agent_states[agent_id].update({
                    "status": "FAILED",
                    "execution_time_ms": latency,
                    "confidence": 0.0,
                    "error": result.get("error", "Agent execution returned FAILED status"),
                    "evidence": result.get("evidence", ["Execution failed"]),
                    "completed_at": completed_iso,
                })
                return result

        except asyncio.TimeoutError:
            latency = round((time.time() - t0) * 1000, 2)
            completed_iso = datetime.now(timezone.utc).isoformat()
            err_msg = f"Agent execution timed out after {timeout_seconds}s"
            logger.warning("Agent '%s' timed out: %s", agent_id, err_msg)
            agent_states[agent_id].update({
                "status": "FAILED",
                "execution_time_ms": latency,
                "confidence": 0.0,
                "error": err_msg,
                "evidence": [err_msg],
                "completed_at": completed_iso,
            })
            return {"status": "FAILED", "error": err_msg}

        except Exception as e:
            latency = round((time.time() - t0) * 1000, 2)
            completed_iso = datetime.now(timezone.utc).isoformat()
            err_msg = f"Unexpected agent exception: {str(e)}"
            logger.error("Agent '%s' failed with error: %s", agent_id, err_msg)
            agent_states[agent_id].update({
                "status": "FAILED",
                "execution_time_ms": latency,
                "confidence": 0.0,
                "error": err_msg,
                "evidence": [err_msg],
                "completed_at": completed_iso,
            })
            return {"status": "FAILED", "error": err_msg}

    async def run_workflow(
        self,
        workflow_id: str,
        initial_state: Dict[str, Any],
        existing_agent_states: Optional[Dict[str, Dict[str, Any]]] = None,
        retry_failed_only: bool = False,
        target_agent_id: Optional[str] = None,
        on_progress: Optional[Any] = None,
    ) -> Dict[str, Any]:
        """
        Executes the full multi-agent DAG workflow using topological concurrency.
        Supports progressive on_progress callback and single-agent targeted retry.
        """
        start_overall = time.time()
        state: Dict[str, Any] = dict(initial_state)

        # Initialize agent states
        agent_states: Dict[str, Dict[str, Any]] = {}
        for agent_id, deps in self.dependencies.items():
            meta = AGENT_META[agent_id]
            # Handle targeted single-agent retry or general retry_failed_only
            if (target_agent_id or retry_failed_only) and existing_agent_states and agent_id in existing_agent_states:
                prev = existing_agent_states[agent_id]
                # If target_agent_id specified, preserve all other agents that succeeded or don't match target (except decision which synthesizes)
                if target_agent_id:
                    if agent_id != target_agent_id and agent_id != "decision" and prev.get("status") == "SUCCESS":
                        agent_states[agent_id] = dict(prev)
                        state[f"{agent_id}_agent_output"] = prev.get("output", {})
                        continue
                elif retry_failed_only:
                    if prev.get("status") == "SUCCESS":
                        agent_states[agent_id] = dict(prev)
                        state[f"{agent_id}_agent_output"] = prev.get("output", {})
                        continue

            agent_states[agent_id] = {
                "agent_id": agent_id,
                "agent_name": meta["name"],
                "agent_goal": meta["goal"],
                "agent_version": getattr(self.agents[agent_id], "version", "1.0.0"),
                "status": "PENDING",
                "dependencies": list(deps),
                "execution_time_ms": 0.0,
                "confidence": 0.0,
                "output": None,
                "error": None,
                "evidence": [],
                "started_at": None,
                "completed_at": None,
            }

        completed_agents: Set[str] = set()
        failed_agents: Set[str] = set()
        blocked_agents: Set[str] = set()

        for a_id, a_data in agent_states.items():
            if a_data.get("status") == "SUCCESS":
                completed_agents.add(a_id)

        all_agent_ids = list(self.dependencies.keys())

        # Notify initial progress state
        if on_progress:
            try:
                cb_res = on_progress({
                    "workflow_id": workflow_id,
                    "status": "RUNNING",
                    "produce_type": state.get("produce_type", "tomato"),
                    "agent_states": agent_states,
                })
                if asyncio.iscoroutine(cb_res):
                    await cb_res
            except Exception as cb_err:
                logger.warning("Initial on_progress callback error: %s", cb_err)

        # Execute in waves until all nodes reach terminal states
        while len(completed_agents) + len(failed_agents) + len(blocked_agents) < len(all_agent_ids):
            ready_wave: List[str] = []
            
            for agent_id in all_agent_ids:
                if agent_id in completed_agents or agent_id in failed_agents or agent_id in blocked_agents:
                    continue

                deps = self.dependencies[agent_id]
                # Check if any dependency failed or was blocked
                deps_failed = any(d in failed_agents or d in blocked_agents for d in deps)
                if deps_failed:
                    # Upstream failed: mark this node BLOCKED
                    blocked_agents.add(agent_id)
                    agent_states[agent_id]["status"] = "BLOCKED"
                    agent_states[agent_id]["error"] = f"Upstream dependency failed or blocked: {[d for d in deps if d in failed_agents or d in blocked_agents]}"
                    agent_states[agent_id]["evidence"] = [f"Blocked: cannot proceed due to incomplete upstream parent nodes: {deps}"]
                    agent_states[agent_id]["completed_at"] = datetime.now(timezone.utc).isoformat()
                    continue

                # Check if all dependencies completed successfully
                deps_satisfied = all(d in completed_agents for d in deps)
                if deps_satisfied:
                    ready_wave.append(agent_id)

            if not ready_wave:
                # No more nodes can run
                break

            # Execute wave concurrently
            tasks = [self._execute_agent_node(agent_id, state, agent_states) for agent_id in ready_wave]
            results = await asyncio.gather(*tasks, return_exceptions=True)

            for agent_id, res in zip(ready_wave, results):
                if isinstance(res, Exception):
                    failed_agents.add(agent_id)
                    agent_states[agent_id]["status"] = "FAILED"
                    agent_states[agent_id]["error"] = str(res)
                elif isinstance(res, dict) and res.get("status") == "SUCCESS":
                    completed_agents.add(agent_id)
                else:
                    failed_agents.add(agent_id)

            # Trigger progress callback after wave
            if on_progress:
                try:
                    cb_res = on_progress({
                        "workflow_id": workflow_id,
                        "status": "RUNNING",
                        "produce_type": state.get("produce_type", "tomato"),
                        "agent_states": agent_states,
                        "perception": agent_states.get("vision", {}).get("output"),
                        "prediction": agent_states.get("shelf_life", {}).get("output"),
                        "risk": agent_states.get("risk", {}).get("output"),
                        "storage": agent_states.get("storage", {}).get("output"),
                        "market": agent_states.get("market", {}).get("output"),
                        "buyer": agent_states.get("buyer", {}).get("output"),
                        "logistics": agent_states.get("logistics", {}).get("output"),
                        "decision": agent_states.get("decision", {}).get("output"),
                    })
                    if asyncio.iscoroutine(cb_res):
                        await cb_res
                except Exception as cb_err:
                    logger.warning("Wave on_progress callback error: %s", cb_err)

        total_duration = round((time.time() - start_overall) * 1000, 2)

        # Determine overall workflow status
        if len(completed_agents) == len(all_agent_ids):
            overall_status = "COMPLETED"
        elif len(completed_agents) > 0 and (failed_agents or blocked_agents):
            overall_status = "PARTIAL_SUCCESS"
        else:
            overall_status = "FAILED"

        decision_output = agent_states.get("decision", {}).get("output") or {}

        action_summary = decision_output.get("recommended_action")
        action_type = decision_output.get("action_type")
        urgency = decision_output.get("urgency")

        if not action_summary and overall_status == "PARTIAL_SUCCESS":
            action_summary = "Partial Analysis Available: Review individual perception and risk findings."
            action_type = "PARTIAL_REVIEW"
            urgency = "MODERATE"
        elif not action_summary:
            action_summary = "Workflow Incomplete: Core intelligence agents encountered upstream errors."
            action_type = "FAILED_REVIEW"
            urgency = "HIGH"

        now_iso = datetime.now(timezone.utc).isoformat()

        return {
            "workflow_id": workflow_id,
            "status": overall_status,
            "produce_type": state.get("produce_type", "tomato"),
            "total_duration_ms": total_duration,
            "agent_states": agent_states,
            "perception": agent_states.get("vision", {}).get("output"),
            "prediction": agent_states.get("shelf_life", {}).get("output"),
            "risk": agent_states.get("risk", {}).get("output"),
            "storage": agent_states.get("storage", {}).get("output"),
            "market": agent_states.get("market", {}).get("output"),
            "buyer": agent_states.get("buyer", {}).get("output"),
            "logistics": agent_states.get("logistics", {}).get("output"),
            "decision": decision_output if decision_output else None,
            "action_summary": action_summary,
            "action_type": action_type,
            "urgency": urgency,
            "completed_at": now_iso,
        }

dag_orchestrator = DAGOrchestrator()
