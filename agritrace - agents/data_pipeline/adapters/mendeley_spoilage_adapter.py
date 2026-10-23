"""Adapter for the Mendeley multi-parameter spoilage dataset.

Good/Bad is retained as source provenance only. It is never converted into a
numeric shelf-life value.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

from data_pipeline.adapters.base import record
from data_pipeline.harmonization import as_float, celsius, normalize_produce


def adapt_mendeley_spoilage(path: Path) -> Tuple[pd.DataFrame, Dict[str, object]]:
    if not path.exists():
        return pd.DataFrame(), {"available": False, "path": str(path), "rows": 0, "reason": "source not present"}
    frame = pd.read_csv(path)
    raw_rows = len(frame)
    duplicate_rows = int(frame.duplicated().sum())
    frame = frame.drop_duplicates().reset_index(drop=True)
    rows = []
    for index, source_row in frame.iterrows():
        raw = source_row.to_dict()
        rows.append(record(
            sample_id=f"mendeley-spoilage-{index:06d}",
            produce_type=normalize_produce(raw.get("Fruit", raw.get("fruit", raw.get("produce_type")))),
            temperature_c=celsius(raw.get("Temp", raw.get("temperature"))),
            humidity_rh=as_float(raw.get("Humid", raw.get("Humid (%)", raw.get("humidity")))),
            source_dataset="Mendeley_multi_parameter_spoilage",
            source_record_id=str(index), target_type="classification_only", target_confidence="low",
            specimen_id=str(raw.get("specimen_id", index)), source_raw_label=raw.get("Class", raw.get("class")),
            source_raw_fields=raw,
        ))
    return pd.DataFrame(rows), {
        "available": True, "path": str(path), "rows": len(rows), "raw_rows": raw_rows,
        "duplicate_rows_removed": duplicate_rows, "columns": list(frame.columns),
    }
