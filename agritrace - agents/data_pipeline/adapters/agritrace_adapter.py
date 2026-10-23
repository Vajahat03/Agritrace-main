"""Adapter for AgriTrace's existing image metadata and splits."""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd

from data_pipeline.adapters.base import record
from data_pipeline.harmonization import bounded_score, freshness_to_score, normalize_produce


def adapt_agritrace(metadata_path: Path) -> Tuple[pd.DataFrame, Dict[str, object]]:
    if not metadata_path.exists():
        return pd.DataFrame(), {"available": False, "path": str(metadata_path), "rows": 0}

    frame = pd.read_csv(metadata_path)
    rows: List[Dict[str, object]] = []
    for index, source_row in frame.iterrows():
        raw = source_row.to_dict()
        source_record_id = str(raw.get("file_hash") or raw.get("image_path") or index)
        source_name = {
            "AgriFreshNET": "AgriFreshNET",
            "FruitNet": "FruitNet",
            "Banana and Guava Quality Dataset": "Banana_Guava_Quality",
            "Banana_Guava_Quality": "Banana_Guava_Quality",
        }.get(str(raw.get("dataset_source")), "AgriTrace_existing")
        produce_type = normalize_produce(raw.get("produce_class"))
        freshness_score = freshness_to_score(raw.get("freshness_grade"))
        quality_score = bounded_score(raw.get("quality_score"))
        target_type = "classification_only" if freshness_score is not None or quality_score is not None else "no_target"
        rows.append(record(
            sample_id=f"agritrace-{source_record_id}",
            produce_type=produce_type,
            freshness_score=freshness_score,
            quality_score=quality_score,
            source_dataset=source_name,
            source_record_id=source_record_id,
            target_type=target_type,
            target_confidence="low" if target_type == "classification_only" else None,
            specimen_id=str(raw.get("specimen_id") or source_record_id),
            source_raw_label=raw.get("raw_label"),
            source_raw_fields=raw,
        ))
    result = pd.DataFrame(rows)
    return result, {
        "available": True,
        "path": str(metadata_path),
        "rows": len(result),
        "columns": list(frame.columns),
        "unique_specimens": int(result["specimen_id"].nunique()),
        "rows_by_source": result["source_dataset"].value_counts().astype(int).to_dict(),
    }
