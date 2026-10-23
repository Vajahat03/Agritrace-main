## Model Card — Shelf-Life XGBoost Development Model

### Version

`shelf_life_xgboost_v1`

### Status

Development / Experimental

### Purpose

Predict remaining shelf life in days using the existing AgriTrace shelf-life input interface. This isolated experiment is not connected to production.

### Inputs

`produce_type`, `freshness_score`, `quality_score`, `defect_probability`, `temperature_c`, `humidity_rh`, `harvest_age_days`, `storage_type`

### Target

`remaining_shelf_life_days`

### Dataset

`shelf life prediction dataset.xlsx.csv` — 50,000 rows; SHA-256 `d30663ca50d45c40025f61aa8fa925ae3d68e714a1c1a143543ef74c4b67f1af`. The CSV contains all eight inputs and the target. Provenance is undocumented/unknown; prior structural investigation found formula-like patterns but could not establish how target values were produced. Labels have not been independently verified against measured real-world shelf life.

### Model

XGBoost regression (`3.4.1`). Train/validation/test split: 34,999/7,501/7,500 (70/15/15), seed 42. Candidate parameters were selected by validation MAE; test data was held out.

### Preprocessing

One-hot encoding for `produce_type` and `storage_type`; numeric features passed through. The fitted ColumnTransformer is saved and reused by the prediction wrapper.

### Evaluation

Test MAE: 1.5703 days; RMSE: 2.6313 days; R²: 0.9506. Excluding exact 0.5-day targets: MAE 1.6720, RMSE 2.7725, R² 0.9495.

### 0.5-Day Analysis

Test count 1313; MAE 1.0912; RMSE 1.8240; mean prediction 1.5886; median 1.0267; min/max -0.0928/18.8317. The full dataset contains 8,634 such rows (17.268%). This floor may influence aggregate metrics.

### Limitations

- Dataset provenance is undocumented/unknown.
- Target labels have not been independently verified against measured real-world shelf life.
- This model is not scientifically validated for real-world deployment.
- Random train/test performance does not establish real-world generalization.
- The 0.5-day floor may influence aggregate metrics.
- The unconstrained regressor can emit values below the dataset's 0.5-day minimum (test floor-group minimum observed: -0.0928 days); this output-range issue needs resolution and validation before any integration.
- Structural associations in the dataset may permit the model to learn dataset-specific label patterns.

### Production Status

This model has NOT replaced the existing production shelf-life model.

### Intended Next Step

Independent validation and controlled integration testing before production use, after provenance, leakage, and real-world target validity are established.
