"""Explicit, conservative source-label harmonization."""

from __future__ import annotations

import math
import re
from typing import Any, Optional

PRODUCE_MAP = {
    "apple": "apple", "apples": "apple",
    "banana": "banana", "bananas": "banana", "banana fruit": "banana",
    "bittermelon": "bittermelon", "bitter melon": "bittermelon",
    "bell pepper": "bell_pepper", "bell_pepper": "bell_pepper", "capsicum": "bell_pepper",
    "carrot": "carrot", "cucumber": "cucumber", "eggplant": "eggplant", "guava": "guava",
    "mango": "mango", "onion": "onion", "orange": "orange", "oranges": "orange",
    "papaya": "papaya", "pineapple": "pineapple", "potato": "potato", "potatoes": "potato",
    "strawberry": "strawberry", "strawberries": "strawberry", "tomato": "tomato",
    "tomatoes": "tomato", "solanum lycopersicum": "tomato",
}
FRESHNESS_MAP = {
    "fresh": 90.0,
    "semi-fresh": 60.0,
    "semi fresh": 60.0,
    "moderately fresh": 60.0,
    "overripe": 30.0,
    "rotten": 5.0,
    "spoiled": 5.0,
}
STORAGE_MAP = {
    "ambient": "ambient", "room temperature": "ambient", "room": "ambient",
    "cold": "cold", "cold storage": "cold", "coldroom": "cold",
    "refrigerated": "refrigerated", "refrigeration": "refrigerated",
    "controlled": "controlled", "controlled atmosphere": "controlled",
}


def _clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower().replace("_", " "))


def normalize_produce(value: Any) -> str:
    return PRODUCE_MAP.get(_clean(value), "unknown")


def freshness_to_score(value: Any) -> Optional[float]:
    return FRESHNESS_MAP.get(_clean(value))


def normalize_storage(value: Any) -> str:
    return STORAGE_MAP.get(_clean(value), "unknown")


def as_float(value: Any) -> Optional[float]:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    try:
        result = float(str(value).strip().replace(",", ""))
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def celsius(value: Any, unit: str = "c") -> Optional[float]:
    number = as_float(value)
    if number is None:
        return None
    unit = _clean(unit)
    if unit in {"f", "fahrenheit", "°f"}:
        return (number - 32.0) * 5.0 / 9.0
    if unit in {"k", "kelvin"}:
        return number - 273.15
    return number


def bounded_score(value: Any) -> Optional[float]:
    number = as_float(value)
    return number if number is not None and 0.0 <= number <= 100.0 else None


def bounded_probability(value: Any) -> Optional[float]:
    number = as_float(value)
    return number if number is not None and 0.0 <= number <= 1.0 else None
