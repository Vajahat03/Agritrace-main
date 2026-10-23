"""Generate the canonical master data dictionary."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "data" / "processed" / "master_data_dictionary.md"

TEXT = """# AgriTrace Master Data Dictionary

| Column | Datatype | Unit / allowed values | Source mapping and transformation | Missing-value policy | Target leakage risk |
|---|---|---|---|---|---|
| `sample_id` | string | unique row identifier | Adapter-generated from source ID | Required; invalid rows rejected | None |
| `produce_type` | string | canonical produce name or `unknown` | Explicit produce harmonization dictionary | `unknown` when source cannot identify it | None |
| `freshness_score` | float | 0-100 | Only documented freshness labels are mapped | Missing when unavailable | Low; must reflect observation-time information |
| `quality_score` | float | 0-100 | Source quality/marketability only where semantically documented | Missing when unavailable | Low; exclude future quality measurements |
| `defect_probability` | float | 0-1 | Only actual defect probability is accepted; decay percent is not silently converted | Missing when unavailable | High if calculated from future/post-failure data |
| `temperature_c` | float | degrees Celsius | Celsius/Fahrenheit/Kelvin conversion | Missing when unavailable | None |
| `humidity_rh` | float | percent relative humidity, 0-100 | Unit conversion only | Missing when unavailable | None |
| `harvest_age_days` | float | days since harvest, only when documented | Source age field; storage day is not automatically harvest age | Missing when unavailable | High if it includes future observation information |
| `storage_type` | string | `ambient`, `cold`, `refrigerated`, `controlled`, `unknown` | Explicit storage mapping; no guessing | `unknown` | None |
| `remaining_shelf_life_days` | float | days, >= 0 | Measured target or documented `failure_day - observation_day` | Missing for non-regression rows | **Target; never a feature** |
| `source_dataset` | string | source identifier | Adapter constant | Required | None |
| `source_record_id` | string | source row/file ID | Preserved source identifier | Required where source provides one | None |
| `target_type` | string | `measured`, `derived_longitudinal`, `approximate_range`, `classification_only`, `no_target` | Explicit source target policy | Required for every row | Controls target eligibility |
| `target_confidence` | string | `high`, `medium`, `low` | Source evidence strength | Missing for `no_target` | Controls evaluation strata |
| `observation_day` | float | days after documented baseline | Source observation time only | Missing when unavailable | High if future rows are used during feature creation |
| `specimen_id` | string | biological specimen/group ID | Preserved or source-specific stable group ID | Adapter fallback only when justified | Required for group-aware splits |
| `shelf_life_min_days` | float | days | Approximate source range lower bound | Missing unless source supplies range | Target-derived; never a feature |
| `shelf_life_max_days` | float | days | Approximate source range upper bound | Missing unless source supplies range | Target-derived; never a feature |
| `source_raw_label` | string | original label | Preserved without harmonization | Missing when unavailable | Potential leakage if used as a feature |
| `source_raw_fields` | JSON string | original source fields | Full provenance snapshot | `{}` when unavailable | Must not be passed to the model |

## Regression eligibility

Only rows with `target_type` equal to `measured` or `derived_longitudinal`, a non-negative `remaining_shelf_life_days`, and passing validation belong in the master regression CSV. Approximate ranges and classification-only observations remain auxiliary.

## Feature leakage rule

The future endpoint, target fields, raw provenance, and post-observation measurements must not be supplied to a future model as predictors. Specimen IDs are for group-aware splitting only.
"""

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(TEXT, encoding="utf-8")
print(OUTPUT)
