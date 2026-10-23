"""Market data normalization and deterministic Phase 4 decision policy.

No live market provider is configured in this repository. The default provider
therefore reports unavailable; tests may inject deterministic provider fixtures.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
import math
from typing import Any, Protocol


@dataclass(frozen=True)
class MarketSnapshot:
    produce_type: str
    location: str
    price_per_kg: float | None
    currency: str | None
    observed_at: str | None
    source: str | None
    price_status: str
    fetched_at: str
    unit: str = "kg"
    source_metadata: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class MarketDataProvider(Protocol):
    name: str

    def get_market_data(self, produce_type: str, location: str) -> dict[str, Any] | None: ...


class UnavailableMarketProvider:
    """Safe default when no real, configured price source exists."""
    name = "unavailable"

    def get_market_data(self, produce_type: str, location: str) -> None:
        return None


def normalize_price_per_kg(value: Any, unit: str) -> float | None:
    """Convert a finite positive price to INR/other-currency per kg by unit only.

    Unknown or malformed units return None. Provider currency is carried
    separately and is never converted implicitly.
    """
    try:
        price = float(value)
    except (TypeError, ValueError):
        return None
    if not math.isfinite(price) or price < 0:
        return None
    scale = {"kg": 1.0, "kilogram": 1.0, "quintal": 100.0,
             "100 kg": 100.0, "tonne": 1000.0, "metric ton": 1000.0,
             "metric tonne": 1000.0}.get(str(unit).strip().casefold())
    return price / scale if scale is not None else None


def normalize_market_data(produce_type: str, location: str, raw: dict[str, Any] | None,
                          source: str | None = None) -> MarketSnapshot:
    if not raw:
        return MarketSnapshot(produce_type=produce_type, location=location,
                              price_per_kg=None, currency=None, observed_at=None,
                              source=source, price_status="unavailable",
                              fetched_at=datetime.now(timezone.utc).isoformat())
    unit = str(raw.get("unit", ""))
    normalized = normalize_price_per_kg(raw.get("price"), unit)
    stamp = raw.get("observed_at") or raw.get("timestamp")
    if stamp is not None:
        stamp = str(stamp)
    status = "available" if normalized is not None else "unavailable"
    return MarketSnapshot(
        produce_type=produce_type, location=location, price_per_kg=normalized,
        currency=str(raw["currency"]) if raw.get("currency") else None,
        observed_at=stamp, source=str(raw.get("source") or source) if raw.get("source") or source else None,
        price_status=status, fetched_at=datetime.now(timezone.utc).isoformat(),
        source_metadata=raw.get("metadata") if isinstance(raw.get("metadata"), dict) else None,
    )


# All decision thresholds live here and are also exposed via workflow for
# compatibility. Priority order: missing core vision -> defect -> urgent life
# -> short life/poor quality -> healthy -> ordinary handling.
DECISION_THRESHOLDS = {
    "urgent_days": 2.0,
    "priority_days": 5.0,
    "priority_quality": 60.0,
    "defect_inspect": 0.35,
}

ACTION_GUIDANCE = {
    "URGENT SALE": "Prioritize this batch for sale within the estimated remaining shelf-life window.",
    "PRIORITIZE SALE": "Move this batch ahead of healthier inventory for sale while it remains suitable.",
    "INSPECT / SORT": "Separate visibly defective produce and inspect the remaining batch before storage or sale.",
    "NORMAL STORAGE": "Continue normal storage and monitor the batch during the next scan.",
    "WASTE REDUCTION": "Consider local sale, processing, or another available recovery action for this batch.",
    "INSUFFICIENT DATA": "Record missing condition or inventory details and scan again before choosing a handling action.",
    "NORMAL HANDLING": "Continue routine handling and rescan to obtain an estimated shelf-life window.",
}


def decision_for(vision: dict[str, Any], shelf: dict[str, Any] | None,
                 inventory: dict[str, Any] | None = None,
                 market: dict[str, Any] | None = None) -> dict[str, Any]:
    """Return a deterministic, explainable recommendation; market never invents price."""
    inventory = inventory or {}
    market = market or {}
    factors: list[str] = []
    completeness: list[str] = []
    quality = vision.get("quality_score")
    defects = vision.get("defect_probability")
    if not isinstance(quality, (int, float)) or not math.isfinite(float(quality)) or not isinstance(defects, (int, float)) or not math.isfinite(float(defects)):
        action, priority = "INSUFFICIENT DATA", "normal"
        reason = "Vision quality and defect values are required for a condition-based recommendation."
    else:
        quality, defects = float(quality), float(defects)
        factors.extend([f"Vision quality: {quality:.1f}/100", f"Vision defect probability: {defects:.1%}"])
        completeness.append("vision")
        days = shelf.get("predicted_days") if shelf else None
        if isinstance(days, (int, float)) and math.isfinite(float(days)):
            days = float(days)
            factors.append(f"V1 development estimate: {days:.2f} days")
            completeness.append("shelf_life")
        else:
            days = None
        if inventory.get("quantity") is not None:
            factors.append(f"Recorded inventory: {inventory['quantity']} {inventory.get('unit') or 'unit'}")
            completeness.append("inventory")
        if defects >= DECISION_THRESHOLDS["defect_inspect"]:
            action, priority = "INSPECT / SORT", "high"
            reason = f"Vision defect probability was {defects:.1%}, at or above the {DECISION_THRESHOLDS['defect_inspect']:.0%} inspection threshold."
        elif days is not None and days <= DECISION_THRESHOLDS["urgent_days"]:
            action, priority = "URGENT SALE", "urgent"
            reason = f"Shelf-Life V1 estimated {days:.2f} days, at or below the {DECISION_THRESHOLDS['urgent_days']:.1f}-day urgent threshold."
        elif days is not None and days <= DECISION_THRESHOLDS["priority_days"]:
            if quality < DECISION_THRESHOLDS["priority_quality"]:
                action, priority = "PRIORITIZE SALE", "high"
                reason = f"Shelf life is short ({days:.2f} days) and quality ({quality:.1f}/100) is below {DECISION_THRESHOLDS['priority_quality']:.0f}; prioritize sale and consider recovery options if sale is unsuitable."
            else:
                action, priority = "PRIORITIZE SALE", "high"
                reason = f"Shelf-Life V1 estimated a short {days:.2f}-day window; prioritize this batch for sale."
        elif days is not None and quality >= DECISION_THRESHOLDS["priority_quality"]:
            action, priority = "NORMAL STORAGE", "normal"
            reason = f"Quality was {quality:.1f}/100, defect probability {defects:.1%}, and V1 estimated {days:.2f} days."
        elif vision.get("freshness_grade") in {"spoiled", "poor", "stale"} or quality < DECISION_THRESHOLDS["priority_quality"]:
            action, priority = "WASTE REDUCTION", "high"
            reason = "Vision condition indicates reduced quality; consider local sale, processing, or another available recovery action."
        elif days is None:
            # Keep Phase 3 response compatibility while making missing data explicit.
            action, priority = "NORMAL HANDLING", "normal"
            reason = "Vision condition is available; Shelf-Life V1 was not run, so routine handling is suggested pending a shelf-life estimate."
        else:
            action, priority = "NORMAL STORAGE", "normal"
            reason = f"Vision quality was {quality:.1f}/100 and V1 estimated {days:.2f} days."

    available = market.get("price_status") == "available" and market.get("price_per_kg") is not None
    if available:
        currency = market.get("currency") or ""
        factors.append(f"Market quote: {currency} {market['price_per_kg']:.2f}/kg".strip())
        observed = f" as of {market['observed_at']}" if market.get("observed_at") else ""
        reason += f" A market quote of {currency} {market['price_per_kg']:.2f}/kg is available from {market.get('source') or 'the configured provider'}{observed}; it is context only and did not change the condition-based action."
    else:
        reason += " Market information is unavailable; this recommendation uses recorded condition, inventory, and shelf-life data where available."
    quantity = inventory.get("quantity")
    urgency = ("immediate" if action == "URGENT SALE" else "prompt" if action in {"PRIORITIZE SALE", "WASTE REDUCTION", "INSPECT / SORT"} else "routine")
    return {
        "action": action, "priority": priority, "reason": reason,
        "recommendation": ACTION_GUIDANCE[action], "urgency": urgency,
        "decision_context": "partial" if "shelf_life" not in completeness or "inventory" not in completeness or not available else "complete",
        "data_completeness": completeness, "market_data_available": available,
        "market_snapshot": market if available else {"price_status": "unavailable", "source": market.get("source")},
        "supporting_factors": factors,
        "inventory": {"quantity": quantity, "unit": inventory.get("unit"), "quantity_kg": inventory.get("quantity_kg")},
    }


def market_snapshot_for(provider: MarketDataProvider, produce_type: str, location: str) -> dict[str, Any]:
    """Provider errors are optional-data failures and never fail scan analysis."""
    try:
        raw = provider.get_market_data(produce_type, location)
    except Exception:
        raw = None
    return normalize_market_data(produce_type, location, raw, getattr(provider, "name", None)).to_dict()

