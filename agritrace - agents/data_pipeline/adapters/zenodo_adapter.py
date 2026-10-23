"""Adapter for the Zenodo longitudinal tomato spreadsheet."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

from data_pipeline.adapters.base import record
from data_pipeline.harmonization import as_float, celsius
from data_pipeline.xlsx_utils import sheets_to_records


def adapt_zenodo(path: Path) -> Tuple[pd.DataFrame, Dict[str, object]]:
    if not path.exists():
        return pd.DataFrame(), {"available": False, "path": str(path), "rows": 0, "reason": "source not present"}
    try:
        sheets = pd.read_excel(path, sheet_name=None)
        if "Environment_Context" in sheets:
            records = sheets["Environment_Context"].to_dict("records")
        else:
            records = next((value.to_dict("records") for value in sheets.values() if len(value) > 0), [])
    except ImportError:
        sheets = sheets_to_records(path)
        records = sheets.get("Environment_Context") or next((value for value in sheets.values() if value), [])
    rows = []
    for index, raw in enumerate(records):
        observation_day = as_float(raw.get("storage_day", raw.get("Day", raw.get("day", raw.get("observation_day")))))
        rows.append(record(
            sample_id=f"zenodo-tomato-{index:04d}", produce_type="tomato",
            temperature_c=celsius(raw.get("temperature_c", raw.get("Temperature_C", raw.get("temperature")))),
            humidity_rh=as_float(raw.get("humidity_rh", raw.get("RelativeHumidity_pct", raw.get("relative_humidity")))),
            harvest_age_days=None, storage_type="ambient",
            source_dataset="Zenodo_longitudinal_tomato", source_record_id=str(index),
            target_type="no_target", target_confidence=None, observation_day=observation_day,
            specimen_id="zenodo-tomato-single-specimen", source_raw_fields=raw,
        ))
    return pd.DataFrame(rows), {"available": True, "path": str(path), "rows": len(rows), "columns": list(records[0]) if records else [], "sheet_names": list(sheets)}
