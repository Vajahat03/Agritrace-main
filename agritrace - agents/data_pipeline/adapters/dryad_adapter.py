"""Conservative adapter for the Dryad tomato workbooks.

Dryad files are optional inputs. Because workbook headers must be verified
against the README, this adapter only activates when a pre-normalized CSV is
provided or when explicit column mappings are supplied by the caller.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

from data_pipeline.adapters.base import record
from data_pipeline.harmonization import as_float, celsius, normalize_storage


def adapt_dryad(path: Path) -> Tuple[pd.DataFrame, Dict[str, object]]:
    if not path.exists():
        return pd.DataFrame(), {"available": False, "path": str(path), "rows": 0, "reason": "source not present"}
    if path.suffix.lower() != ".csv":
        return pd.DataFrame(), {"available": True, "path": str(path), "rows": 0, "reason": "workbook schema requires explicit verification"}

    frame = pd.read_csv(path)
    required = {"sample_id", "observation_day", "failure_day", "temperature_c", "humidity_rh"}
    missing = sorted(required - set(frame.columns))
    if missing:
        return pd.DataFrame(), {"available": True, "path": str(path), "rows": 0, "reason": f"missing explicit columns: {missing}"}

    rows = []
    for index, source_row in frame.iterrows():
        raw = source_row.to_dict()
        observation_day = as_float(raw["observation_day"])
        failure_day = as_float(raw["failure_day"])
        remaining = None if observation_day is None or failure_day is None else failure_day - observation_day
        rows.append(record(
            sample_id=str(raw["sample_id"]), produce_type="tomato",
            temperature_c=celsius(raw["temperature_c"]), humidity_rh=as_float(raw["humidity_rh"]),
            harvest_age_days=observation_day, storage_type=normalize_storage(raw.get("storage_type", "ambient")),
            remaining_shelf_life_days=remaining, source_dataset="Dryad_tomato",
            source_record_id=str(raw.get("source_record_id", index)), target_type="derived_longitudinal",
            target_confidence="medium", observation_day=observation_day,
            specimen_id=str(raw.get("specimen_id", raw["sample_id"])), source_raw_fields=raw,
        ))
    return pd.DataFrame(rows), {"available": True, "path": str(path), "rows": len(rows), "columns": list(frame.columns)}
