"""
AgriTrace Environmental Risk Agent
Monitors temperature anomalies, moisture saturation, heatwaves, and storage volatility.
"""

from typing import Dict, Any, List
from agents.base_agent import BaseAgent
from ai.version_registry import MODEL_VERSIONS

class RiskAgent(BaseAgent):
    def __init__(self):
        super().__init__(
            name="Environment/Risk Agent",
            goal="Analyze microclimate telemetry and weather risks to identify post-harvest environmental threats.",
            version=MODEL_VERSIONS["risk_engine"]
        )

    def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        telemetry = state.get("telemetry", {})
        temp = telemetry.get("temperature_c", state.get("temperature_c", 24.0))
        humidity = telemetry.get("humidity_rh", state.get("humidity_rh", 78.0))
        gas_ppm = telemetry.get("gas_voc_ppm", 12.0)
        
        risks: List[str] = []
        thermal_risk_level = "LOW"
        
        if temp >= 28.0:
            thermal_risk_level = "CRITICAL"
            risks.append(f"Storage temperature ({temp}°C) is critical. Accelerated respiration will induce rapid rot.")
        elif temp >= 22.0:
            thermal_risk_level = "HIGH"
            risks.append(f"Storage temperature ({temp}°C) exceeds recommended produce holding range.")
        elif temp < 4.0:
            thermal_risk_level = "CHILLING_RISK"
            risks.append(f"Low temperature ({temp}°C) may cause chilling injury.")

        if humidity > 92.0:
            risks.append(f"High humidity ({humidity}%) creates severe condensation and fungal spore germination hazard.")
        elif humidity < 60.0:
            risks.append(f"Low humidity ({humidity}%) will cause rapid moisture loss and shriveling.")

        if gas_ppm > 45.0:
            risks.append(f"Elevated VOC/Ethylene gas ({gas_ppm} ppm) indicates ripening acceleration from neighboring batches.")

        overall_risk = "HIGH" if (temp >= 24.0 or gas_ppm > 40.0) else ("MODERATE" if temp >= 18.0 else "LOW")

        return {
            "output": {
                "overall_risk": overall_risk,
                "thermal_risk": thermal_risk_level,
                "temperature_c": temp,
                "humidity_rh": humidity,
                "gas_voc_ppm": gas_ppm,
                "detected_hazards": risks,
                "risk_score": 0.85 if overall_risk == "HIGH" else (0.45 if overall_risk == "MODERATE" else 0.15)
            },
            "confidence": 0.95,
            "evidence": risks if risks else ["Environmental parameters are within acceptable safe tolerances."]
        }
