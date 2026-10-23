# Shelf-Life Dataset and Training Investigation

**Status: training stopped before fitting.** This report records a read-only audit of the supplied file. No model artifact or performance result was generated. Target provenance is undocumented, and the repository virtual environment cannot start because its base Python installation is missing. I did not infer target provenance or fabricate benchmark values.

## 1. Dataset summary

- Absolute path: `C:\Users\Vajahat Shaikh\OneDrive\Desktop\agritrace - agents\shelf life prediction dataset.xlsx.csv`
- Format: comma-separated text (CSV); the `.xlsx.csv` suffix does not make it an Excel workbook.
- File size: 3,098,794 bytes.
- SHA-256: `D30663CA50D45C40025F61AA8FA925AE3D68E714A1C1A143543EF74C4B67F1AF`
- Shape: 50,000 rows × 9 columns.
- Exact columns: `produce_type`, `freshness_score`, `quality_score`, `defect_probability`, `temperature_c`, `humidity_rh`, `harvest_age_days`, `storage_type`, `remaining_shelf_life_days`.
- Inferred types: two categorical text fields (`produce_type`, `storage_type`); seven numeric decimal fields. CSV has no declared schema/types.
- Missing values: 0 in every column.
- Exact duplicate rows: 0.
- Duplicate predictor vectors (the eight inputs without target): 0; all 50,000 vectors are unique at the stored precision.
- Categorical counts: 25 produce types; 5 storage types. All 125 produce × storage combinations occur.

Categorical values:

- Produce: Peas, Apple, Pomegranate, Banana, Cabbage, Brinjal, Okra, Cauliflower, Grapes, Carrot, Onion, Lemon, Watermelon, Tomato, Potato, Orange, Cucumber, Mango, Garlic, Ginger, Papaya, Chilli, Spinach, Capsicum, Guava.
- Storage: Room Temperature, Refrigerated, Cold Storage, Open Market, Controlled Atmosphere.

Numeric descriptive statistics (sample standard deviation):

| Column | Min | Max | Mean | Median | Std. dev. |
|---|---:|---:|---:|---:|---:|
| freshness_score | 15 | 99 | 71.1875 | 73.16 | 15.1582 |
| quality_score | 15.27 | 100 | 72.1443 | 72.945 | 12.6910 |
| defect_probability | 0.1463 | 0.95 | 0.5617 | 0.5541 | 0.1530 |
| temperature_c | 0 | 37.69 | 14.6942 | 8.15 | 11.2580 |
| humidity_rh | 35 | 98 | 65.4584 | 68.845 | 22.5803 |
| harvest_age_days | 0.2 | 26.56 | 4.5706 | 3.8 | 3.1874 |
| remaining_shelf_life_days | 0.5 | 133.47 | 8.5154 | 4.28 | 11.4116 |

First 10 rows:

```csv
produce_type,freshness_score,quality_score,defect_probability,temperature_c,humidity_rh,harvest_age_days,storage_type,remaining_shelf_life_days
Peas,79.72,87.61,0.5608,22.13,56.07,1.02,Room Temperature,1.94
Apple,76.84,74.93,0.4728,24.79,48.22,2.34,Room Temperature,10.58
Pomegranate,76.36,72.34,0.3307,4.72,78.6,5.65,Refrigerated,28.6
Banana,75.69,85.49,0.6121,21.26,45.32,3.45,Room Temperature,1.94
Cabbage,79.15,79.55,0.444,5.79,92.16,4.62,Cold Storage,25.27
Brinjal,59.11,67.81,0.7261,32.91,42.87,4.46,Open Market,1.46
Okra,72.92,74.9,0.5606,22.48,45.42,3.4,Room Temperature,1.94
Cauliflower,74.4,74.98,0.4609,6.39,98.0,3.7,Controlled Atmosphere,24.8
Grapes,94.65,96.1,0.419,7.09,87.11,0.5,Cold Storage,42.27
Okra,68.6,67.34,0.647,26.41,54.13,3.05,Room Temperature,1.94
```

Last 10 rows:

```csv
Carrot,84.86,78.48,0.4097,8.62,84.15,1.42,Refrigerated,17.24
Banana,59.1,69.42,0.8732,33.85,35.0,4.33,Open Market,0.5
Garlic,61.5,69.3,0.6765,26.85,47.0,5.53,Room Temperature,0.96
Potato,80.55,81.27,0.298,3.36,82.72,2.14,Refrigerated,24.34
Grapes,73.85,61.16,0.6123,22.34,35.0,3.01,Room Temperature,0.5
Tomato,85.37,83.11,0.4251,1.15,71.09,2.09,Refrigerated,5.32
Cucumber,92.06,96.31,0.3296,4.34,98.0,1.29,Controlled Atmosphere,15.99
Chilli,83.48,82.82,0.4773,2.79,98.0,4.51,Controlled Atmosphere,11.78
Potato,34.03,53.5,0.857,23.8,38.96,12.74,Room Temperature,0.57
Apple,61.02,49.92,0.6777,29.96,36.7,3.15,Open Market,2.5
```

## 2. Dataset provenance findings

**Target provenance is undocumented.** A repository search found no dataset README, source citation, collection protocol, or target-generation description for this file. No claim that the target is experimentally measured or real-world validated is supported.

The target field is named `remaining_shelf_life_days`; thus the file labels it as remaining shelf life in days. There is no documentation that says whether it is measured, derived from longitudinal failure observations, simulated, or formula-generated.

## 3. Target and feature analysis

- Target: `remaining_shelf_life_days` (numeric, range 0.5–133.47 days, mean 8.5154, median 4.28, 4,774 distinct stored values).
- Every one of the eight inputs in the existing prediction interface is present with the same name and compatible numeric/categorical representation. Categorical encoding would be needed inside a model preprocessing pipeline.
- The target is stored with one or two decimal digits: 12,633 values have one decimal digit and 37,367 have two.
- The value `0.5` occurs 8,634 times (17.268%). This resembles a possible floor/cap or minimum-label rule, but without target documentation it cannot be distinguished from censoring, rounding, or genuine repeated observations.
- Univariate correlations with the numeric target (descriptive only): freshness 0.366, quality 0.290, defect probability −0.623, temperature −0.526, humidity 0.528, harvest age −0.138. These associations do not establish causality or a target-generation formula.
- Mean target varies considerably by produce (e.g. Garlic 22.779 days, Spinach 1.738 days) and storage (Open Market 1.539, Room Temperature 2.143, Refrigerated 11.550, Cold Storage 15.039, Controlled Atmosphere 18.376). Those patterns may be plausible, simulated, or formula-derived; no source validates them.
- Temperature values are aligned with broad storage group ranges in this file: Cold Storage 0–12.29 °C; Controlled Atmosphere 0–10.44 °C; Refrigerated 0–14.53 °C; Room Temperature 16.69–34.70 °C; Open Market 20.54–37.69 °C. These observed ranges alone do not verify experimental conditions.

## 4. Formula / synthetic investigation

Evidence observed:

- All 50,000 predictor vectors are unique and all 50,000 complete rows are unique; no specimen, fruit, sample, batch, or experiment identifier is present.
- The target has only 4,774 distinct values and has a large point mass at exactly 0.5 days.
- Features and target are decimal-valued and bounded. Freshness and quality are in 0–100; defect probability is in 0–1; humidity is in 0–100; temperature is 0–37.69; harvest age is positive.
- Produce and storage group means and feature-target correlations show structured associations.

These findings are compatible with generated or rule-based data, but they are not proof. In particular, the repeated 0.5 value could represent a target floor or a real observation/censoring convention. **Whether the data is experimentally measured, derived, synthetic, or generated by a deterministic formula remains impossible to determine from the file alone.**

Required mean baseline, linear regression, decision tree, random forest, and XGBoost comparisons were **not run**. No MAE, RMSE, or R² is available. The repository `.venv` is broken: `.venv/pyvenv.cfg` points to `C:\Users\Vajahat Shaikh\AppData\Local\Programs\Python\Python312\python.exe`, which is absent. `py -0p` reports no installed Python runtimes. Therefore model-fitting tools and metrics cannot be truthfully reported in this environment. Nonlinear/deterministic reconstruction remains untested.

## 5. Data quality

Observed range checks found:

- 0 temperatures below 0 °C or above 40 °C (whether values are physically suitable for each produce/storage remains context-dependent).
- 0 humidity values outside 0–100% RH.
- 0 freshness or quality scores outside 0–100.
- 0 defect probabilities outside 0–1.
- 0 negative harvest ages or target values.
- 3,037 target values exceed 30 days. This is not automatically invalid across 25 produce types, but long-lived types and units should be verified against the source.
- All 125 produce/storage combinations occur. No source rules were supplied to determine which combinations are experimentally inconsistent.
- No rows were removed or changed.

No IDs exist to identify repeated fruits. No split/partition column exists, so prior train/test leakage cannot be assessed. A random row split would be the only available split without additional grouping metadata, and could not guarantee specimen-level independence.

## 6. Training readiness and methodology

No train/validation/test split was created and no model was trained. Accordingly, training, validation, and test row counts are all **not applicable**; no final-test metrics or feature importance exist.

If the provenance and runtime blockers are resolved, a future development-only experiment can use an 80/10/10 split with fixed seed, OneHotEncoder for `produce_type` and `storage_type`, and numerical columns passed through to XGBRegressor. Since there are no specimen IDs, the limitation of row-wise split must be documented. Keep the final test partition untouched during tuning. First compare the target baseline with linear/tree/forest/XGBoost models and investigate the repeated 0.5-day mass and any exceptionally high validation/test scores for deterministic formula leakage.

No model artifact, preprocessing pipeline, model configuration, feature-importance output, or compatibility predictor was created. Ten-example wrapper checks and test-set comparisons were not run because there is no trained artifact.

## 7. Existing AgriTrace protection and integration notes

Inspected existing paths (read-only):

- Model-serving code: `ai/shelf_life/xgboost_model.py`. It currently implements a deterministic formula, despite the filename and class description. Its class method accepts the eight inputs and returns a richer response object. The module-level function is `predict_shelf_life(**kwargs)`.
- Agent caller: `agents/shelf_life_agent.py` calls `predict_shelf_life` with the current eight values.
- API: `backend/app.py`, `POST /api/shelf-life/predict`, passes the same eight inputs.
- Frontend: `frontend/app.js` displays `predicted_shelf_life_days`; the inspected matching code is display/mock data, not a live call to the API endpoint.
- Existing model file: `ai/shelf_life/xgboost_model.py` (formula implementation, not a trained XGBoost artifact).

None of these production files were modified. Existing auxiliary datasets were not merged into this file.

Weather API plan (not implemented): once a backend obtains current conditions using a server-side `WEATHER_API_KEY`, pass the resulting `temperature_c` and `humidity_rh` through the already existing predictor inputs. The key must remain in environment configuration and must not be exposed to frontend code. Weather values are model inputs, not shelf-life ground-truth labels.

## 8. Decision and exact next step

Dataset classification: **unknown provenance; not approved as a real-world model training dataset**. It may be useful for a development-only model if the owner confirms it is synthetic/constructed or supplies its generation/source documentation. However, formula reconstruction and the requested model comparison cannot be completed until a working Python environment with XGBoost, pandas, and scikit-learn is available.

Next step: confirm the dataset source or generation process and restore/provide the project Python environment. Then complete formula-detection benchmarks before deciding whether to train a development artifact. Do not integrate this dataset or a model trained from it into production based on the current evidence.
