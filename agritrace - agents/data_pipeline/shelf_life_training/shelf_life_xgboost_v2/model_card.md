# Shelf-Life XGBoost V2 Development Model Card

## Status

Development / Experimental; not production-ready.

## Dataset and target

Derived dataset: `shelf_life_dataset_floor1.csv` (50,000 rows). Rule: values below 0.5 map to 0.0 and values at or above 0.5 map to 1.0. The original dataset had no values below 0.5, so all 50,000 derived targets equal 1.0. This collapses the continuous shelf-life target to a constant and removes useful regression signal.

## Inputs

produce_type, freshness_score, quality_score, defect_probability, temperature_c, humidity_rh, harvest_age_days, storage_type

## Model

XGBoost regression 3.4.1; same seed 42 and exact two-stage row split method as V1. Split counts: 34,999/7,501/7,500.

## Evaluation

Test MAE 0.00000000; RMSE 0.00000000; R² is undefined because the target has zero variance. These figures measure reproduction of a constant recoded label, not shelf-life prediction quality.

## Limitations

Dataset provenance remains undocumented. The clarified recoding changed 49,952 target values and made every label 1.0. The model therefore carries no demonstrated shelf-life regression value and must not be represented as a usable shelf-life predictor.

## Production status

This V2 artifact is isolated and has not replaced or modified the production predictor or V1.
