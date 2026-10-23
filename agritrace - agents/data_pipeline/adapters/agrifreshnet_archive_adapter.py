"""Adapter for the verified AgriFreshNET processed-image archive."""

from __future__ import annotations

import re
from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

from data_pipeline.adapters.base import record
from data_pipeline.harmonization import freshness_to_score, normalize_produce

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
RANGE_PATTERN = re.compile(r"(\d+)\s*-\s*(\d+)")
STAGE_PATTERN = re.compile(r"^(fresh|semi[_ ]?fresh|rotten)\s+(.+)$", re.IGNORECASE)


def _folder_metadata(folder_name: str) -> Tuple[str, str, float, float]:
    range_match = RANGE_PATTERN.search(folder_name)
    if range_match is None:
        raise ValueError(f"AgriFreshNET folder has no documented range: {folder_name}")
    label = folder_name[:range_match.start()].strip(" _()")
    stage_match = STAGE_PATTERN.match(label)
    if stage_match is None:
        raise ValueError(f"AgriFreshNET folder has no recognized freshness label: {folder_name}")
    stage = stage_match.group(1).replace("_", " ").lower()
    produce = normalize_produce(stage_match.group(2).strip(" _()"))
    return produce, stage, float(range_match.group(1)), float(range_match.group(2))


def adapt_agrifreshnet_archive(root: Path) -> Tuple[pd.DataFrame, Dict[str, object]]:
    if not root.exists():
        return pd.DataFrame(), {"available": False, "path": str(root), "rows": 0, "reason": "verified archive not extracted"}
    rows = []
    folder_stats: Dict[str, int] = {}
    rejected = []
    for image_path in sorted(path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS):
        folder_name = image_path.parent.name
        try:
            produce, stage, minimum, maximum = _folder_metadata(folder_name)
        except ValueError as error:
            rejected.append(str(error))
            continue
        relative = image_path.relative_to(root).as_posix()
        folder_stats[folder_name] = folder_stats.get(folder_name, 0) + 1
        rows.append(record(
            sample_id=f"agrifreshnet-archive-{relative}",
            produce_type=produce,
            freshness_score=freshness_to_score(stage),
            quality_score=None,
            defect_probability=None,
            temperature_c=None,
            humidity_rh=None,
            harvest_age_days=None,
            storage_type="unknown",
            remaining_shelf_life_days=None,
            source_dataset="AgriFreshNET",
            source_record_id=relative,
            target_type="approximate_range",
            target_confidence="low",
            observation_day=None,
            specimen_id=None,
            shelf_life_min_days=minimum,
            shelf_life_max_days=maximum,
            source_raw_label=folder_name,
            source_raw_fields={"folder": folder_name, "relative_path": relative},
        ))
    return pd.DataFrame(rows), {
        "available": True, "path": str(root), "rows": len(rows),
        "image_count": len(rows), "folder_count": len(folder_stats),
        "folder_counts": folder_stats, "rejected_images": rejected,
        "metadata_files": [str(path) for path in root.rglob("*") if path.is_file() and path.suffix.lower() in {".csv", ".xlsx", ".json", ".txt", ".md", ".docx"}],
    }
