# Model Card: Shelf-Life XGBoost Development Model

**Version:** Not created (planned label: `shelf_life_xgboost_v1`)

**Status:** No model trained. This card records the intended use and current blockers; it does not describe a fitted artifact.

## Purpose

Potential development model to predict remaining shelf life in days from the existing AgriTrace predictor inputs. It is not approved for deployment or real-world decision making.

## Inputs and output

Planned inputs, matching the current predictor interface:

- `produce_type`
- `freshness_score`
- `quality_score`
- `defect_probability`
- `temperature_c`
- `humidity_rh`
- `harvest_age_days`
- `storage_type`

Planned target/output: `remaining_shelf_life_days`.

## Training data and provenance

Candidate: `shelf life prediction dataset.xlsx.csv`, 50,000 rows × 9 columns. SHA-256: `D30663CA50D45C40025F61AA8FA925AE3D68E714A1C1A143543EF74C4B67F1AF`.

**Target provenance is undocumented.** The data file contains no source/method metadata or specimen IDs. A repeated exact 0.5-day target appears in 8,634 rows. This may reflect a clipping rule, censoring, or another process; the file alone cannot resolve which. Experimental measurement, derivation, synthetic generation, and deterministic formula generation have not been confirmed or ruled out.

## Metrics and feature importance

Not available. No baseline or model training/evaluation was run. No feature-importance or SHAP values exist.

## Limitations

- Dataset provenance and target-generation process are unknown.
- No specimen/fruit identifiers are available for group-safe splitting.
- The 0.5-day target concentration may indicate a floor or censoring convention and needs explanation.
- No validation supports real-world accuracy or produce-specific reliability.
- The environment's `.venv` points to a missing Python 3.12.4 installation; no system Python runtime is installed.

## Intended use

If provenance is confirmed and training/evaluation completed, the model may be used for isolated engineering development and interface compatibility checks with these same eight inputs.

## Non-intended use

- Production integration or replacement of the existing predictor.
- Food safety, quality, or commercial decisions.
- Claims of scientifically validated or real-world predictive accuracy.

## Training date

Not applicable; no training occurred.

## Production status

The existing AgriTrace model-serving implementation remains unchanged and available as the current rollback. No trained artifact exists at this time.
