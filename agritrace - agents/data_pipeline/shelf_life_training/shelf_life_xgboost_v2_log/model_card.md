# Model Card — Shelf-Life XGBoost V2-Log

## Model

`shelf_life_xgboost_v2_log`

## Status

Experimental development model

## Purpose and intended use

Development experiment to compare direct-target XGBoost with log1p-target XGBoost. Not approved for real-world shelf-life decisions.

## Inputs

produce_type, freshness_score, quality_score, defect_probability, temperature_c, humidity_rh, harvest_age_days, storage_type

## Target

Original target: `remaining_shelf_life_days`. Training target: `log1p(remaining_shelf_life_days)`. Inference transformation: `expm1(prediction)`.

## Dataset

`shelf life prediction dataset.xlsx.csv` (50,000 rows). Original target values are preserved. Exact 0.5-day labels: 8,634; below 0.5: 0. Provenance is undocumented and target values have not been independently verified as measured real-world shelf life.

## Model and preprocessing

XGBoost 3.4.1; one-hot encoding for produce and storage; numerical features pass through unchanged. Fitted preprocessor uses training rows only. Split is the same row assignment as V1: 34,999/7,501/7,500, seed 42.

## Evaluation

Same V1 test rows, original days: MAE 1.5909; RMSE 2.7956; R² 0.9442. Raw `expm1` prediction range 0.4274 to 96.7384; negative predictions 0.

## Limitations

- Dataset provenance is undocumented; targets are not independently verified measurements.
- There are 8,634 exact 0.5-day targets; why this floor occurs is unknown.
- All 50,000 feature vectors are unique; repeated-vector target consistency cannot be evaluated.
- Synthetic or formula-generated structure is possible but unproven.
- A random split may overestimate performance when hidden groups or generation rules are shared.
- Correlation and feature importance are descriptive, not causal.
- Log-space loss emphasizes relative error; inverse transformation can produce biased day-scale averages.
- Raw test predictions were all nonnegative (minimum 0.4274 days), so no nonnegative clamp was needed for this test set. The wrapper preserves raw `expm1` outputs without clipping.
- This model has not been scientifically validated for real-world deployment.

## Production integration

NO. V2-Log remains isolated from production.
