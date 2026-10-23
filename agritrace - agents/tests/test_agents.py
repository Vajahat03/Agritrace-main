import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from agents.orchestrator.orchestrator import orchestrate_batch
from ai.shelf_life.xgboost_model import predict_shelf_life
from ai.reasoning.fuzzy_engine import evaluate_fuzzy_risk
from ai.reasoning.rule_engine import check_safety_rules
from ai.reasoning.genetic_optimizer import run_genetic_optimization

def test_shelf_life_calibrated_intervals():
    res = predict_shelf_life(
        produce_type="tomato",
        freshness_score=75.0,
        quality_score=75.0,
        defect_probability=0.10,
        temperature_c=14.0,  # Optimal
        humidity_rh=85.0
    )
    assert res["predicted_shelf_life_days"] > 4.0
    interval = res["prediction_interval_90"]
    assert interval["min_days"] < res["predicted_shelf_life_days"] < interval["max_days"]
    assert "risk_24h" in res["spoilage_risk"]

def test_scenario_a_store_and_monitor():
    """
    Scenario A: Fresh produce, optimal temperature, rising market -> STORE / MONITOR
    """
    res = orchestrate_batch(
        batch_id="SCENARIO-A",
        produce_type="apple",
        quantity_kg=800.0,
        telemetry={"temperature_c": 3.0, "humidity_rh": 88.0, "gas_voc_ppm": 4.0},
        market_trend="rising"
    )
    assert res["status"] == "COMPLETED"
    assert res["action_type"] in ["STORE_AND_MONITOR", "MONITOR"]
    print("Scenario A (Store & Monitor) Passed!")

def test_scenario_b_urgent_sale():
    """
    Scenario B: Low freshness, short shelf-life, falling market, buyers nearby -> SELL_SOON / SELL_NOW
    """
    res = orchestrate_batch(
        batch_id="SCENARIO-B",
        produce_type="tomato",
        quantity_kg=500.0,
        telemetry={"temperature_c": 26.0, "humidity_rh": 85.0, "gas_voc_ppm": 35.0},
        market_trend="falling"
    )
    assert res["status"] == "COMPLETED"
    assert res["action_type"] in ["SELL_NOW", "SELL_SOON"]
    assert len(res["dag_trace"]) >= 8
    print("Scenario B (Urgent Sale via GA/Rules) Passed!")

def test_scenario_c_thermal_hazard_smartbag():
    """
    Scenario C: High temperature breach -> Cooling Trigger / Alert
    """
    res = orchestrate_batch(
        batch_id="SCENARIO-C",
        produce_type="tomato",
        quantity_kg=200.0,
        telemetry={"temperature_c": 29.5, "humidity_rh": 88.0, "gas_voc_ppm": 20.0, "smartbag_active": True},
        market_trend="stable"
    )
    assert res["status"] == "COMPLETED"
    assert "COOLING" in res["action_type"] or "TRIGGER" in res["action_type"] or "SELL" in res["action_type"]
    print("Scenario C (Thermal Hazard & SmartBag Cooling) Passed!")

if __name__ == "__main__":
    test_shelf_life_calibrated_intervals()
    test_scenario_a_store_and_monitor()
    test_scenario_b_urgent_sale()
    test_scenario_c_thermal_hazard_smartbag()
    print("All Agent & Scenario Benchmark Tests Passed Successfully!")
