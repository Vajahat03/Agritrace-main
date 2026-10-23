import math

import pytest
from fastapi.testclient import TestClient

from backend.intelligence import (UnavailableMarketProvider, decision_for,
                                  market_snapshot_for, normalize_market_data,
                                  normalize_price_per_kg)
from backend.security import AuthStore
import backend.workflow as workflow
from backend.workflow import ProducePayload, _inventory_kg


@pytest.mark.parametrize(("price", "unit", "expected"), [
    (40, "kg", 40), (2000, "quintal", 20), (40000, "tonne", 40),
])
def test_market_price_units_normalize_deterministically(price, unit, expected):
    assert normalize_price_per_kg(price, unit) == expected


def test_unknown_or_invalid_market_units_are_unavailable_not_guessed():
    assert normalize_price_per_kg(100, "crate") is None
    assert normalize_price_per_kg(float("inf"), "kg") is None
    snapshot = normalize_market_data("Tomato", "Pune", {"price": 100, "unit": "crate"}, "test")
    assert snapshot.price_status == "unavailable" and snapshot.price_per_kg is None


def test_market_provider_failure_is_safe_and_never_returns_a_fabricated_quote():
    snapshot = market_snapshot_for(UnavailableMarketProvider(), "Tomato", "Pune")
    assert snapshot["price_status"] == "unavailable"
    assert snapshot["price_per_kg"] is None


def test_successful_market_snapshot_is_cached_per_workspace_context(tmp_path, monkeypatch):
    store = AuthStore(database_path=tmp_path / "market.sqlite3")
    user, _ = store.register(full_name="Market User", email="market@example.test",
                             phone="+919876543210", password="correct horse battery staple",
                             role="farmer", workspace_name="Market Farm")
    user["user_id"] = user["id"]
    class Provider:
        name = "test-feed"
        calls = 0

        def get_market_data(self, produce_type, location):
            self.calls += 1
            return {"price": 2000, "unit": "quintal", "currency": "INR",
                    "source": "test-feed", "timestamp": "2026-01-01T10:00:00Z"}
    provider = Provider()
    monkeypatch.setattr(workflow, "MARKET_DATA_PROVIDER", provider)
    workflow.ensure_schema(store)
    first = workflow._market_snapshot(store, user, "Tomato", "Pune")
    second = workflow._market_snapshot(store, user, "Tomato", "Pune")
    assert first["price_per_kg"] == second["price_per_kg"] == 20
    assert first["observed_at"] == "2026-01-01T10:00:00Z"
    assert provider.calls == 1


def test_inventory_values_must_be_finite_nonnegative_and_unit_valid():
    assert ProducePayload(farm_id="f", produce_type="Tomato", quantity=45, unit="kg").quantity == 45
    assert _inventory_kg(2, "tonne") == 2000
    assert _inventory_kg(4, "crate") is None
    assert ProducePayload(farm_id="f", produce_type="Tomato", quantity=0, unit="kg").quantity == 0
    for quantity in (-1, float("inf"), float("nan")):
        with pytest.raises(ValueError):
            ProducePayload(farm_id="f", produce_type="Tomato", quantity=quantity, unit="kg")
    with pytest.raises(ValueError):
        ProducePayload(farm_id="f", produce_type="Tomato", quantity=1, unit="bushel")


def test_phase4_decision_precedence_and_actionable_recommendations():
    vision = {"quality_score": 50, "defect_probability": .1, "freshness_grade": "poor"}
    urgent = decision_for(vision, {"predicted_days": 1}, {"quantity": 45, "unit": "kg"})
    assert urgent["action"] == "URGENT SALE"
    assert "45 kg" in urgent["supporting_factors"][-1]
    assert "within" in urgent["recommendation"]
    defect = decision_for({"quality_score": 90, "defect_probability": .8}, {"predicted_days": 1})
    assert defect["action"] == "INSPECT / SORT"
    recovery = decision_for(vision, {"predicted_days": 4})
    assert recovery["action"] == "PRIORITIZE SALE"
    waste = decision_for(vision, None)
    assert waste["action"] == "WASTE REDUCTION"
    assert "processing" in waste["recommendation"]


def test_market_quote_is_reported_as_context_without_changing_condition_action():
    vision = {"quality_score": 90, "defect_probability": .1}
    without = decision_for(vision, {"predicted_days": 1})
    with_quote = decision_for(vision, {"predicted_days": 1}, market={
        "price_status": "available", "price_per_kg": 40, "currency": "INR", "source": "fixture"
    })
    assert with_quote["action"] == without["action"]
    assert with_quote["market_data_available"] is True
    assert "did not change" in with_quote["reason"]
