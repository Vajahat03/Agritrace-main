"""Adapter for AgriFreshNET metadata when shelf-life annotations are present.

The repository's current AgriFreshNET export contains image labels only. This
adapter intentionally does not turn freshness classes or folder ranges into a
numeric shelf-life target. A future verified annotation table can be supplied
through ``annotation_path`` with explicit min/max columns.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

import pandas as pd

from data_pipeline.adapters.agritrace_adapter import adapt_agritrace


def adapt_agrifreshnet(metadata_path: Path, annotation_path: Path | None = None) -> Tuple[pd.DataFrame, Dict[str, object]]:
    frame, stats = adapt_agritrace(metadata_path)
    stats["source_dataset"] = "AgriFreshNET"
    stats["annotation_path"] = str(annotation_path) if annotation_path else None
    stats["shelf_life_annotations_loaded"] = False
    if annotation_path is not None and annotation_path.exists():
        raise ValueError(
            "AgriFreshNET annotation files require an explicit, verified schema before labels can be used. "
            "No implicit range-to-point conversion is allowed."
        )
    if not frame.empty:
        frame["source_dataset"] = "AgriFreshNET"
    return frame, stats
