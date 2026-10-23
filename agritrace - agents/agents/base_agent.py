"""
AgriTrace Base Agent Interface
Defines the standard contract for all specialized agricultural intelligence agents.
Contract: input_state -> agent_reasoning -> output -> confidence/evidence -> updated_state
"""

from typing import Dict, Any, Optional
import time
from abc import ABC, abstractmethod

class BaseAgent(ABC):
    def __init__(self, name: str, goal: str, version: str):
        self.name = name
        self.goal = goal
        self.version = version

    @abstractmethod
    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Executes the agent logic over current shared pipeline state.
        Must return structured dict containing:
          - output: result payload
          - confidence: float 0.0 to 1.0
          - evidence: list of reasoning explanations
          - execution_time_ms: latency
        """
        pass

    def run(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """Wrapped execution with latency profiling and audit packaging."""
        start_time = time.time()
        try:
            result = self.execute(state)
            latency = round((time.time() - start_time) * 1000, 2)
            result["execution_time_ms"] = latency
            result["status"] = "SUCCESS"
            result["agent_name"] = self.name
            result["agent_goal"] = self.goal
            result["agent_version"] = self.version
            return result
        except Exception as e:
            latency = round((time.time() - start_time) * 1000, 2)
            return {
                "status": "FAILED",
                "agent_name": self.name,
                "agent_goal": self.goal,
                "agent_version": self.version,
                "execution_time_ms": latency,
                "error": str(e),
                "output": None,
                "confidence": 0.0,
                "evidence": [f"Execution failed: {str(e)}"]
            }
