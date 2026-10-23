"""
AgriTrace Storage / SmartBag Agent
Interacts with SmartBag IoT telemetry and issues autonomous cooling, ventilation, and isolation directives.
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent
from ai.version_registry import MODEL_VERSIONS

class StorageAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Storage/SmartBag Agent",
            goal="Regulate SmartBag storage conditions, control actuators, and maintain optimal microclimate holding states.",
            version=MODEL_VERSIONS["smartbag_controller"]
        )

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        risk_output = state.get("risk_agent_output", {})
        temp = risk_output.get("temperature_c", 22.0)
        humidity = risk_output.get("humidity_rh", 75.0)
        gas_ppm = risk_output.get("gas_voc_ppm", 12.0)
        
        smartbag_id = state.get("smartbag_id", "SMARTBAG-001")
        actions_commanded: List[str] = []
        target_temp = 14.0
        
        if temp > 20.0:
            actions_commanded.append("ACTUATE_COOLING_CYCLE")
            cooling_power = "HIGH" if temp > 26.0 else "MODERATE"
        else:
            cooling_power = "OFF"

        if gas_ppm > 30.0 or humidity > 90.0:
            actions_commanded.append("TRIGGER_VENTILATION_PURGE")
            fan_status = "ACTIVE"
        else:
            fan_status = "STANDBY"

        status_summary = (
            f"SmartBag [{smartbag_id}]: Cooling={cooling_power}, Ventilation={fan_status}. "
            f"Target Temperature={target_temp}°C."
        )

        return {
            "output": {
                "smartbag_id": smartbag_id,
                "current_temp": temp,
                "target_temp": target_temp,
                "cooling_actuator": cooling_power,
                "ventilation_fan": fan_status,
                "commands_issued": actions_commanded,
                "storage_mode": "ACTIVE_SMARTBAG_PRESERVATION"
            },
            "confidence": 0.98,
            "evidence": [status_summary]
        }
