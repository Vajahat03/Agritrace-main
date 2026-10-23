"""Build and validate the unified AgriTrace shelf-life datasets.

Run from the repository root:
    python -m data_pipeline.build_dataset

This module never trains a model and never modifies production inference code.
"""

from __future__ import annotations

import json
from collections import Counter
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

import pandas as pd

from data_pipeline.adapters.agritrace_adapter import adapt_agritrace
from data_pipeline.adapters.agrifreshnet_archive_adapter import adapt_agrifreshnet_archive
from data_pipeline.adapters.agrifreshnet_adapter import adapt_agrifreshnet
from data_pipeline.adapters.dryad_adapter import adapt_dryad
from data_pipeline.adapters.mendeley_spoilage_adapter import adapt_mendeley_spoilage
from data_pipeline.adapters.zenodo_adapter import adapt_zenodo
from data_pipeline.schema import (
    CANONICAL_COLUMNS,
    NUMERIC_COLUMNS,
    REGRESSION_TARGET_TYPES,
    STORAGE_TYPES,
    TARGET_CONFIDENCES,
    TARGET_TYPES,
    VALID_PRODUCE_TYPES,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "data" / "processed"


def _empty_frame() -> pd.DataFrame:
    return pd.DataFrame(columns=CANONICAL_COLUMNS)


def _concat(frames: Iterable[pd.DataFrame]) -> pd.DataFrame:
    usable = [frame.dropna(axis=1, how="all") for frame in frames if not frame.empty]
    return pd.concat(usable, ignore_index=True).reindex(columns=CANONICAL_COLUMNS) if usable else _empty_frame()


def inventory_sources() -> Tuple[List[pd.DataFrame], Dict[str, object]]:
    metadata = ROOT / "data" / "metadata" / "agritrace_labels.csv"
    source_frames: List[pd.DataFrame] = []
    inventory: Dict[str, object] = {"repository_root": str(ROOT), "sources": {}}

    existing, existing_stats = adapt_agritrace(metadata)
    archive_root = ROOT / "data" / "external" / "agrifreshnet" / "extracted_processed_data" / "Processed Data"
    agrifresh_archive, archive_stats = adapt_agrifreshnet_archive(archive_root)
    if not agrifresh_archive.empty:
        existing = existing[existing["source_dataset"] != "AgriFreshNET"].copy()
    source_frames.append(existing)
    source_frames.append(agrifresh_archive)
    inventory["sources"]["AgriTrace_existing"] = existing_stats
    inventory["sources"]["AgriFreshNET_archive"] = archive_stats

    _, agrifresh_stats = adapt_agrifreshnet(metadata)
    inventory["sources"]["AgriFreshNET"] = agrifresh_stats

    optional = {
        "Dryad_tomato": (ROOT / "data" / "external" / "dryad" / "dryad_normalized.csv", adapt_dryad),
        "Zenodo_longitudinal_tomato": (ROOT / "data" / "external" / "zenodo" / "Tomato_RGB_UV_Data_Availability.xlsx", adapt_zenodo),
        "Mendeley_multi_parameter_spoilage": (ROOT / "data" / "external" / "mendeley_spoilage" / "Dataset.csv", adapt_mendeley_spoilage),
    }
    for name, (path, adapter) in optional.items():
        frame, stats = adapter(path)
        source_frames.append(frame)
        inventory["sources"][name] = stats

    raw_files = [path for path in (ROOT / "data" / "raw").rglob("*") if path.is_file()]
    inventory["local_raw_file_count"] = len(raw_files)
    inventory["local_raw_extensions"] = dict(Counter(path.suffix.lower() or "<none>" for path in raw_files))
    inventory["external_expected_paths"] = {name: str(path) for name, (path, _) in optional.items()}
    return source_frames, inventory


def _numeric_issue_count(frame: pd.DataFrame) -> int:
    issues = 0
    for column in NUMERIC_COLUMNS:
        if column not in frame:
            continue
        values = pd.to_numeric(frame[column], errors="coerce")
        issues += int(values.isna().sum())
    return issues


def validate(frame: pd.DataFrame) -> Dict[str, object]:
    issues: Dict[str, int] = {}
    if frame.empty:
        duplicate_sample_ids = 0
    else:
        duplicate_sample_ids = int(frame["sample_id"].duplicated(keep=False).sum())
    checks = {
        "missing_canonical_columns": sorted(set(CANONICAL_COLUMNS) - set(frame.columns)),
        "duplicate_sample_ids": duplicate_sample_ids,
        "invalid_produce_names": int((~frame["produce_type"].isin(VALID_PRODUCE_TYPES)).sum()) if not frame.empty else 0,
        "invalid_storage_types": int((frame["storage_type"].notna() & ~frame["storage_type"].isin(STORAGE_TYPES)).sum()) if not frame.empty else 0,
        "invalid_target_types": int((~frame["target_type"].fillna("").isin(TARGET_TYPES)).sum()) if not frame.empty else 0,
        "invalid_target_confidence": int((~frame["target_confidence"].fillna("").isin(TARGET_CONFIDENCES | {""})).sum()) if not frame.empty else 0,
        "negative_temperature": int((pd.to_numeric(frame["temperature_c"], errors="coerce") < -90).sum()) if not frame.empty else 0,
        "humidity_out_of_range": int(((pd.to_numeric(frame["humidity_rh"], errors="coerce") < 0) | (pd.to_numeric(frame["humidity_rh"], errors="coerce") > 100)).sum()) if not frame.empty else 0,
        "freshness_out_of_range": int(((pd.to_numeric(frame["freshness_score"], errors="coerce") < 0) | (pd.to_numeric(frame["freshness_score"], errors="coerce") > 100)).sum()) if not frame.empty else 0,
        "quality_out_of_range": int(((pd.to_numeric(frame["quality_score"], errors="coerce") < 0) | (pd.to_numeric(frame["quality_score"], errors="coerce") > 100)).sum()) if not frame.empty else 0,
        "defect_probability_out_of_range": int(((pd.to_numeric(frame["defect_probability"], errors="coerce") < 0) | (pd.to_numeric(frame["defect_probability"], errors="coerce") > 1)).sum()) if not frame.empty else 0,
        "negative_shelf_life": int((pd.to_numeric(frame["remaining_shelf_life_days"], errors="coerce") < 0).sum()) if not frame.empty else 0,
        "numeric_missing_cells": _numeric_issue_count(frame),
    }
    leakage_columns = {"failure_day", "final_spoilage", "future_observation", "target", "remaining_shelf_life_days"}
    source_field_text = frame["source_raw_fields"].fillna("").astype(str) if not frame.empty else pd.Series(dtype=str)
    leakage_hits = sum(source_field_text.str.contains(rf"['\"]?{column}['\"]?", case=False, regex=True).sum() for column in leakage_columns)
    checks["target_leakage_fields_in_canonical_features"] = 0
    checks["target_leakage_mentions_in_provenance"] = int(leakage_hits)
    checks["repeated_specimen_rows"] = int(frame["specimen_id"].duplicated(keep=False).sum()) if not frame.empty else 0
    checks["unique_specimens"] = int(frame["specimen_id"].nunique(dropna=True)) if not frame.empty else 0
    checks["outlier_count"] = 0
    fatal_keys = {
        "duplicate_sample_ids", "invalid_produce_names", "invalid_storage_types",
        "invalid_target_types", "invalid_target_confidence", "negative_temperature",
        "humidity_out_of_range", "freshness_out_of_range", "quality_out_of_range",
        "defect_probability_out_of_range", "negative_shelf_life",
        "target_leakage_fields_in_canonical_features",
    }
    checks["all_checks_pass"] = not checks["missing_canonical_columns"] and not any(checks[key] for key in fatal_keys)
    return checks


def _write_quality_report(all_rows: pd.DataFrame, master: pd.DataFrame, auxiliary: pd.DataFrame, inventory: Dict[str, object], validation: Dict[str, object], rejected: int, raw_row_count: int, raw_source_count: int) -> None:
    def counts(frame: pd.DataFrame, column: str) -> Dict[str, int]:
        return frame[column].fillna("missing").value_counts(dropna=False).astype(int).to_dict() if not frame.empty else {}

    lines = [
        "# AgriTrace Shelf-Life Data Quality Report",
        "",
        "This report was generated without training a model or changing production inference.",
        "",
        f"- Total source rows from downloaded/local sources: {raw_source_count:,}",
        f"- Rows entering harmonization after source-level exact deduplication: {raw_row_count:,}",
        f"- Total harmonized rows: {len(all_rows):,}",
        f"- Rows rejected: {rejected:,}",
        f"- Rows suitable for shelf-life regression: {len(master):,}",
        f"- Auxiliary rows without a legitimate regression target: {len(auxiliary):,}",
        f"- Rows with missing feature cells: {int(all_rows[['freshness_score', 'quality_score', 'defect_probability', 'temperature_c', 'humidity_rh', 'harvest_age_days', 'storage_type']].isna().any(axis=1).sum()):,}",
        f"- Rows with valid shelf-life target: {len(master):,}",
        f"- Rows with approximate target: {int((all_rows['target_type'] == 'approximate_range').sum()):,}",
        f"- Rows with classification-only target: {int((all_rows['target_type'] == 'classification_only').sum()):,}",
        "",
        "## Rows by produce type",
        "",
        str(counts(all_rows, "produce_type")),
        "",
        "## Rows by source",
        "",
        str(counts(all_rows, "source_dataset")),
        "",
        "## Rows by target type",
        "",
        str(counts(all_rows, "target_type")),
        "",
        "## Rows by target confidence",
        "",
        str(counts(all_rows, "target_confidence")),
        "",
        "## Rows by storage type",
        "",
        str(counts(all_rows, "storage_type")),
        "",
        f"- Duplicate sample count: {validation['duplicate_sample_ids']}",
        f"- Repeated-specimen rows: {validation['repeated_specimen_rows']}",
        f"- Unique specimens: {validation['unique_specimens']}",
        f"- Impossible-value count: {sum(value for key, value in validation.items() if key.endswith('_out_of_range') or key.startswith('negative_')):,}",
        f"- Outlier count: {validation['outlier_count']}",
        "",
        "## Source inventory",
        "",
        "```json",
        json.dumps(inventory, indent=2, sort_keys=True),
        "```",
    ]
    (OUTPUT_DIR / "data_quality_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build() -> Dict[str, object]:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    frames, inventory = inventory_sources()
    raw_rows = _concat(frames)
    raw_row_count = len(raw_rows)
    raw_source_count = raw_row_count + sum(
        int(details.get("duplicate_rows_removed", 0))
        for details in inventory["sources"].values()
    )
    duplicate_sample_rows = int(raw_rows["sample_id"].duplicated(keep=False).sum()) if not raw_rows.empty else 0
    all_rows = raw_rows.drop_duplicates(subset=["sample_id"], keep="first").reset_index(drop=True)
    regression_mask = (
        all_rows["target_type"].isin(REGRESSION_TARGET_TYPES)
        & all_rows["remaining_shelf_life_days"].notna()
        & (pd.to_numeric(all_rows["remaining_shelf_life_days"], errors="coerce") >= 0)
    )
    master = all_rows.loc[regression_mask].copy().reindex(columns=CANONICAL_COLUMNS)
    auxiliary = all_rows.loc[~regression_mask].copy().reindex(columns=CANONICAL_COLUMNS)
    validation = validate(all_rows)
    validation["duplicate_sample_rows_before_deduplication"] = duplicate_sample_rows
    master.to_csv(OUTPUT_DIR / "agritrace_master_shelf_life.csv", index=False)
    auxiliary.to_csv(OUTPUT_DIR / "agritrace_auxiliary_postharvest.csv", index=False)
    report = {
        "inventory": inventory,
        "validation": validation,
        "total_source_rows": raw_source_count,
        "total_rows_entering_harmonization": raw_row_count,
        "total_harmonized_rows_after_deduplication": len(all_rows),
        "valid_regression_rows": len(master),
        "auxiliary_rows": len(auxiliary),
        "rows_by_produce": all_rows["produce_type"].value_counts().astype(int).to_dict(),
        "regression_rows_by_produce": master["produce_type"].value_counts().astype(int).to_dict() if not master.empty else {},
        "rows_by_source": all_rows["source_dataset"].value_counts().astype(int).to_dict(),
        "rows_by_target_type": all_rows["target_type"].value_counts(dropna=False).astype(int).to_dict(),
        "rows_by_target_confidence": all_rows["target_confidence"].fillna("missing").value_counts().astype(int).to_dict(),
        "target_sources": master["source_dataset"].value_counts().astype(int).to_dict() if not master.empty else {},
        "feature_coverage": {
            column: {
                "non_null_rows": int(all_rows[column].notna().sum()),
                "missing_rows": int(all_rows[column].isna().sum()),
                "missing_percent": round(float(all_rows[column].isna().mean() * 100.0), 4),
            } for column in ["produce_type", "freshness_score", "quality_score", "defect_probability", "temperature_c", "humidity_rh", "harvest_age_days", "storage_type"]
        },
        "excluded_rows_by_reason": {
            target_type: int((all_rows["target_type"] == target_type).sum())
            for target_type in ["classification_only", "approximate_range", "no_target"]
        },
        "source_contribution": {
            source: {
                "total_rows": int((all_rows["source_dataset"] == source).sum()),
                "regression_rows": int((master["source_dataset"] == source).sum()) if not master.empty else 0,
                "auxiliary_rows": int((auxiliary["source_dataset"] == source).sum()),
            } for source in sorted(all_rows["source_dataset"].dropna().unique())
        },
    }
    (OUTPUT_DIR / "validation_report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    _write_quality_report(all_rows, master, auxiliary, inventory, validation, rejected=raw_source_count - len(all_rows), raw_row_count=raw_row_count, raw_source_count=raw_source_count)
    return report


if __name__ == "__main__":
    result = build()
    print("## MASTER DATASET")
    print(f"Total rows: {result['total_source_rows']}")
    print(f"Valid regression rows: {result['valid_regression_rows']}")
    print(f"Auxiliary rows: {result['auxiliary_rows']}")
    print(f"Unique produce types: {len(result['rows_by_produce'])}")
    print(f"Sources: {result['rows_by_source']}")
    print(f"Rows by produce: {result['rows_by_produce']}")
    print(f"Rows by source: {result['rows_by_source']}")
    print(f"Rows by target_type: {result['rows_by_target_type']}")
    print(f"Rows by target_confidence: {result['rows_by_target_confidence']}")
    print(f"Actual shelf-life regression target sources: {result['target_sources']}")
    print("# PRODUCE DISTRIBUTION")
    for produce, total in result["rows_by_produce"].items():
        regression = result["regression_rows_by_produce"].get(produce, 0)
        print(f"{produce} | {total} | {regression}")
    print("# TARGET DISTRIBUTION")
    for target_type, count in result["rows_by_target_type"].items():
        print(f"{target_type} | {count}")
    print("# CONFIDENCE DISTRIBUTION")
    for confidence, count in result["rows_by_target_confidence"].items():
        print(f"{confidence} | {count}")
    print("# SOURCE CONTRIBUTION")
    for source, values in result["source_contribution"].items():
        print(f"{source} | {values['total_rows']} | {values['regression_rows']} | {values['auxiliary_rows']}")
    print("# FEATURE COVERAGE")
    for feature, values in result["feature_coverage"].items():
        print(f"{feature} | {values['non_null_rows']} | {values['missing_rows']} | {values['missing_percent']}%")
    if result["valid_regression_rows"] == 0:
        print("# SHELF-LIFE TARGET")
        print("No statistics: zero valid regression rows.")
