"""Shared adapter helpers."""

from __future__ import annotations

import json
from typing import Any, Dict

from data_pipeline.schema import empty_record


def record(**values: Any) -> Dict[str, Any]:
    result = empty_record()
    result.update(values)
    result["source_raw_fields"] = json.dumps(
        values.get("source_raw_fields", {}), sort_keys=True, default=str
    )
    return result
