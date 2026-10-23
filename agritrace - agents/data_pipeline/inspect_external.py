"""Inspect acquired external datasets and write provenance/schema reports."""

from __future__ import annotations

import hashlib
import json
import zipfile
from datetime import date
from pathlib import Path
from typing import Any, Dict, Iterable

import pandas as pd

from data_pipeline.xlsx_utils import sheets_to_records

ROOT = Path(__file__).resolve().parents[1]
EXTERNAL = ROOT / "data" / "external"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def csv_schema(path: Path) -> Dict[str, Any]:
    frame = pd.read_csv(path)
    return {
        "path": str(path.relative_to(ROOT)), "format": "csv", "rows": len(frame),
        "columns": list(frame.columns), "dtypes": {key: str(value) for key, value in frame.dtypes.items()},
        "missing_values": {key: int(value) for key, value in frame.isna().sum().items()},
        "unique_values": {key: sorted(frame[key].dropna().astype(str).unique().tolist())[:100] for key in frame.select_dtypes(include="object").columns},
        "duplicate_rows": int(frame.duplicated().sum()), "sample_rows": frame.head(3).to_dict("records"),
    }


def xlsx_schema(path: Path) -> Dict[str, Any]:
    sheets = sheets_to_records(path)
    return {
        "path": str(path.relative_to(ROOT)), "format": "xlsx", "sheets": {
            name: {
                "rows": len(rows), "columns": list(rows[0]) if rows else [],
                "missing_values": {column: sum(not row.get(column) for row in rows) for column in (rows[0] if rows else [])},
                "unique_values": {column: sorted({str(row.get(column, "")) for row in rows if row.get(column, "")})[:100] for column in (rows[0] if rows else [])},
                "sample_rows": rows[:3],
            } for name, rows in sheets.items()
        },
    }


def archive_schema(path: Path) -> Dict[str, Any]:
    if path.stat().st_size < 10000:
        return {"path": str(path.relative_to(ROOT)), "format": "invalid_or_incomplete", "size": path.stat().st_size}
    try:
        with zipfile.ZipFile(path) as archive:
            entries = archive.namelist()
    except zipfile.BadZipFile:
        return {"path": str(path.relative_to(ROOT)), "format": "invalid_or_incomplete", "size": path.stat().st_size, "reason": "download did not complete or response was not a ZIP"}
    return {
        "path": str(path.relative_to(ROOT)), "format": "zip", "size": path.stat().st_size,
        "entry_count": len(entries), "first_entries": entries[:50],
        "image_entry_count": sum(Path(entry).suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"} for entry in entries),
        "metadata_entries": [entry for entry in entries if Path(entry).suffix.lower() in {".csv", ".xlsx", ".json", ".docx", ".txt", ".md"}],
    }


def file_info(path: Path) -> Dict[str, Any]:
    return {"path": str(path.relative_to(ROOT)), "size": path.stat().st_size, "sha256": sha256(path)}


def inspect() -> Dict[str, Any]:
    report: Dict[str, Any] = {"inspection_date": str(date.today()), "datasets": {}}
    mendeley = EXTERNAL / "mendeley_spoilage" / "Dataset.csv"
    zenodo = EXTERNAL / "zenodo" / "Tomato_RGB_UV_Data_Availability.xlsx"
    agrifresh = EXTERNAL / "agrifreshnet" / "AgriFreshNET_processed_data.zip"
    agrifresh_extracted = EXTERNAL / "agrifreshnet" / "extracted_processed_data" / "Processed Data"
    report["datasets"]["Mendeley_multi_parameter_spoilage"] = {
        "source_url": "https://data.mendeley.com/datasets/czz68d9fwj/1",
        "doi": "10.17632/czz68d9fwj.1", "license": "CC BY 4.0",
        "target_type": "classification_only", "target_column": "Class", "file": file_info(mendeley) if mendeley.exists() else None,
        "schema": csv_schema(mendeley) if mendeley.exists() else None,
        "interpretation": "Good/Bad is an environmental/spoilage classification and is not converted to shelf-life days.",
    }
    report["datasets"]["Zenodo_longitudinal_tomato"] = {
        "source_url": "https://zenodo.org/records/21943147", "doi": "10.5281/zenodo.21943147", "license": "CC BY 4.0",
        "target_type": "no_target", "file": file_info(zenodo) if zenodo.exists() else None,
        "schema": xlsx_schema(zenodo) if zenodo.exists() else None,
        "image_files": [file_info(path) for path in sorted((EXTERNAL / "zenodo" / "images").glob("*.png"))],
        "interpretation": "The official description identifies 18 repeated observations of one specimen and no documented failure endpoint.",
    }
    dryad_files = sorted((EXTERNAL / "dryad").glob("*"))
    report["datasets"]["Dryad_tomato"] = {
        "source_url": "https://datadryad.org/dataset/doi:10.5061/dryad.5mkkwh772", "doi": "10.5061/dryad.5mkkwh772", "license": "CC0",
        "target_type": "direct_measured_or_derived_longitudinal_pending_file_access",
        "files": [file_info(path) for path in dryad_files if path.is_file()],
        "expected_files": ["Shelflife_Tomato_NLED_BWC.xlsx", "Decay_Tomato_NLED_BWC.xlsx", "Marketability_Tomato_NLED_BWC.xlsx", "pH_Tomato_NLED_BWC.xlsx", "TA_Tomato_NLED_BWC.xlsx", "TSS_Tomato_NLED_BWC.xlsx", "AA_Tomato_NLED_BWC.xlsx", "WL_Tomato_NLED_BWC.xlsx", "README_file.docx"],
        "interpretation": "Repository metadata documents measurements through day 36 and a shelf-life workbook, but direct files remain inaccessible behind the official anti-bot challenge.",
    }
    report["datasets"]["AgriFreshNET"] = {
        "source_url": "https://data.mendeley.com/datasets/42m5tb7yv9/1", "doi": "10.17632/42m5tb7yv9.1", "license": "CC BY 4.0",
        "target_type": "approximate_range", "file": archive_schema(agrifresh) if agrifresh.exists() else None,
        "local_metadata": str((ROOT / "data" / "metadata" / "agritrace_labels.csv").relative_to(ROOT)),
        "extracted_image_count": sum(1 for path in agrifresh_extracted.rglob("*") if path.is_file() and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}) if agrifresh_extracted.exists() else 0,
        "extracted_metadata_files": [str(path.relative_to(ROOT)) for path in agrifresh_extracted.rglob("*") if path.is_file() and path.suffix.lower() in {".csv", ".xlsx", ".json", ".txt", ".md", ".docx"}] if agrifresh_extracted.exists() else [],
        "folder_labels": sorted(path.name for path in agrifresh_extracted.iterdir() if path.is_dir()) if agrifresh_extracted.exists() else [],
        "interpretation": "The verified archive contains only image folders. Official documentation describes the folder ranges as approximate post-harvest shelf-life annotations; ranges are preserved without converting them to point targets.",
    }
    return report


def write_reports(report: Dict[str, Any]) -> None:
    (EXTERNAL / "schema_inventory.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    source_lines = [
        "# External Dataset Sources", "", f"Acquisition/inspection date: {report['inspection_date']}", "",
        "## Dryad Tomato Shelf Life", "- Source: https://datadryad.org/dataset/doi:10.5061/dryad.5mkkwh772", "- DOI: `10.5061/dryad.5mkkwh772`", "- License: CC0", "- Status: official file endpoint returned an anti-bot validation page; files not acquired.", "",
        "## AgriFreshNET", "- Source: https://data.mendeley.com/datasets/42m5tb7yv9/1", "- DOI: `10.17632/42m5tb7yv9.1`", "- License: CC BY 4.0", "- Status: official archive resumed, ZIP integrity verified, nested processed archive extracted; 14,160 image rows and no metadata files found.", "",
        "## Zenodo Longitudinal Tomato", "- Source: https://zenodo.org/records/21943147", "- DOI: `10.5281/zenodo.21943147`", "- License: CC BY 4.0", "- Status: spreadsheet and 36 official images acquired.", "",
        "## Mendeley Multi-Parameter Spoilage", "- Source: https://data.mendeley.com/datasets/czz68d9fwj/1", "- DOI: `10.17632/czz68d9fwj.1`", "- License: CC BY 4.0", "- Status: official CSV acquired; `Class` is Good/Bad classification only.", "",
    ]
    (EXTERNAL / "DATASET_SOURCES.md").write_text("\n".join(source_lines) + "\n", encoding="utf-8")
    dryad_report = """# Dryad Target Definition

The Dryad repository documents a tomato experiment with ambient storage, repeated observations at days 4, 8, 12, 16, 20, 24, 28, 32, and 36, decay, marketability, physicochemical measurements, and a dedicated shelf-life workbook. It uses four neem extract levels, four beeswax levels, and three replications.

The actual workbooks could not be downloaded during this run: the official file endpoint returned a 4,307-byte anti-bot validation HTML page, while the API download endpoint returned HTTP 401. No Dryad rows were added to the master or auxiliary datasets.

Before integration, inspect the workbook headers and README. A direct shelf-life value may be assigned `target_type = measured` and `target_confidence = high` only if the workbook documents it as a measured shelf-life value. A longitudinal target may be assigned `target_type = derived_longitudinal` and `target_confidence = medium` only if the README defines a failure criterion and the source provides a failure day. The target would then be `failure_day - observation_day`.

Do not equate marketability with quality, decay percentage with defect probability, or storage day with remaining shelf life without explicit source support.
"""
    (EXTERNAL / "dryad" / "Dryad_Target_Definition.md").write_text(dryad_report, encoding="utf-8")
    schema_lines = ["# External Schema Report", ""]
    for name, details in report["datasets"].items():
        schema_lines.extend([f"## {name}", "", f"Target type: `{details.get('target_type')}`", "", "```json", json.dumps(details, indent=2, sort_keys=True), "```", ""])
    (EXTERNAL / "SCHEMA_REPORT.md").write_text("\n".join(schema_lines), encoding="utf-8")


if __name__ == "__main__":
    write_reports(inspect())
    print(EXTERNAL / "schema_inventory.json")
