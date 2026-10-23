"""Canonical schema and validation rules for shelf-life records."""

from __future__ import annotations

from typing import Dict, List

CANONICAL_COLUMNS: List[str] = [
    "sample_id",
    "produce_type",
    "freshness_score",
    "quality_score",
    "defect_probability",
    "temperature_c",
    "humidity_rh",
    "harvest_age_days",
    "storage_type",
    "remaining_shelf_life_days",
    "source_dataset",
    "source_record_id",
    "target_type",
    "target_confidence",
    "observation_day",
    "specimen_id",
    "shelf_life_min_days",
    "shelf_life_max_days",
    "source_raw_label",
    "source_raw_fields",
]

REGRESSION_TARGET_TYPES = {"measured", "derived_longitudinal"}
TARGET_TYPES = REGRESSION_TARGET_TYPES | {"approximate_range", "classification_only", "no_target"}
TARGET_CONFIDENCES = {"high", "medium", "low"}
STORAGE_TYPES = {"ambient", "cold", "refrigerated", "controlled", "unknown"}
VALID_PRODUCE_TYPES = {
    "apple", "banana", "bell_pepper", "bittermelon", "carrot", "cucumber",
    "eggplant", "guava", "mango", "onion", "orange", "papaya", "pineapple",
    "potato", "strawberry", "tomato", "unknown",
}

NUMERIC_COLUMNS = [
    "freshness_score", "quality_score", "defect_probability", "temperature_c",
    "humidity_rh", "harvest_age_days", "remaining_shelf_life_days",
    "observation_day", "shelf_life_min_days", "shelf_life_max_days",
]


def empty_record() -> Dict[str, object]:
    """Return a record with every canonical field present and unset."""
    return {column: None for column in CANONICAL_COLUMNS}
