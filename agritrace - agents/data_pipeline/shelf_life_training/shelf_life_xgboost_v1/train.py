"""Train an isolated development shelf-life XGBoost model.

This script reads the repository's 50k CSV and writes only beside this file.
It does not import or alter the production predictor.
"""
from __future__ import annotations

import hashlib
import json
import platform
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.compose import ColumnTransformer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = ROOT / "shelf life prediction dataset.xlsx.csv"
ARTIFACTS = HERE / "artifacts"
METRICS = HERE / "metrics"
VERSION = "shelf_life_xgboost_v1"
TARGET = "remaining_shelf_life_days"
CATEGORICAL = ["produce_type", "storage_type"]
NUMERIC = [
    "freshness_score", "quality_score", "defect_probability",
    "temperature_c", "humidity_rh", "harvest_age_days",
]
FEATURES = ["produce_type", *NUMERIC, "storage_type"]
EXPECTED = [*FEATURES, TARGET]
SEED = 42


def jsonable(value):
    if isinstance(value, dict):
        return {str(k): jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return float(value) if np.isfinite(value) else None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def regression_metrics(y, pred):
    return {
        "mae": float(mean_absolute_error(y, pred)),
        "rmse": float(np.sqrt(mean_squared_error(y, pred))),
        "r2": float(r2_score(y, pred)),
    }


def main():
    if ARTIFACTS.exists() or METRICS.exists():
        raise FileExistsError(f"Refusing to overwrite existing experiment output: {HERE}")
    if not DATA.is_file():
        raise FileNotFoundError(DATA)
    df = pd.read_csv(DATA)
    if list(df.columns) != EXPECTED:
        raise ValueError(f"Column mismatch; expected {EXPECTED}, got {list(df.columns)}")
    if df[EXPECTED].isna().any().any():
        raise ValueError("Missing values detected in required data; refusing to train")
    for col in NUMERIC + [TARGET]:
        df[col] = pd.to_numeric(df[col], errors="raise")
    if not np.isfinite(df[NUMERIC + [TARGET]].to_numpy(dtype=float)).all():
        raise ValueError("Non-finite numeric values detected")

    # Two seeded splits yield 70%/15%/15%, without using test rows for selection.
    train_valid_idx, test_idx = train_test_split(
        np.arange(len(df)), test_size=0.15, random_state=SEED, shuffle=True
    )
    train_idx, valid_idx = train_test_split(
        train_valid_idx, test_size=(0.15 / 0.85), random_state=SEED, shuffle=True
    )
    train = df.iloc[train_idx]
    valid = df.iloc[valid_idx]
    test = df.iloc[test_idx]
    x_train, y_train = train[FEATURES], train[TARGET]
    x_valid, y_valid = valid[FEATURES], valid[TARGET]
    x_test, y_test = test[FEATURES], test[TARGET]

    preprocessor = ColumnTransformer(
        transformers=[
            ("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=True), CATEGORICAL),
            ("numeric", "passthrough", NUMERIC),
        ],
        remainder="drop",
        verbose_feature_names_out=True,
    )
    x_train_t = preprocessor.fit_transform(x_train)
    x_valid_t = preprocessor.transform(x_valid)
    x_test_t = preprocessor.transform(x_test)

    # Small, predeclared parameter comparison; validation MAE selects the final model.
    candidates = [
        {"n_estimators": 700, "max_depth": 5, "learning_rate": 0.04, "subsample": 0.9, "colsample_bytree": 0.9, "min_child_weight": 3, "reg_lambda": 1.0},
        {"n_estimators": 900, "max_depth": 7, "learning_rate": 0.035, "subsample": 0.9, "colsample_bytree": 0.9, "min_child_weight": 3, "reg_lambda": 1.0},
        {"n_estimators": 600, "max_depth": 4, "learning_rate": 0.05, "subsample": 0.85, "colsample_bytree": 0.85, "min_child_weight": 5, "reg_lambda": 2.0},
    ]
    validation_results = []
    fitted = []
    for params in candidates:
        model = XGBRegressor(
            **params, objective="reg:squarederror", eval_metric="rmse",
            random_state=SEED, n_jobs=4, tree_method="hist",
        )
        model.fit(x_train_t, y_train, verbose=False)
        pred_valid = model.predict(x_valid_t)
        scores = regression_metrics(y_valid, pred_valid)
        validation_results.append({"hyperparameters": params, **scores})
        fitted.append(model)
    selected_index = min(range(len(fitted)), key=lambda i: validation_results[i]["mae"])
    model = fitted[selected_index]

    # The untouched test set is evaluated once, after validation-based selection.
    predictions = model.predict(x_test_t)
    overall = regression_metrics(y_test, predictions)
    nonfloor = y_test.to_numpy() != 0.5
    floor = ~nonfloor
    floor_y, floor_pred = y_test.to_numpy()[floor], predictions[floor]
    abs_error = np.abs(y_test.to_numpy() - predictions)
    error_summary = {
        "median_absolute_error": float(np.median(abs_error)),
        "maximum_absolute_error": float(abs_error.max()),
        "within_abs_error_days": {
            str(t): float((abs_error <= t).mean() * 100) for t in (0.5, 1, 2, 3)
        },
    }
    worst_order = np.argsort(abs_error)[-10:][::-1]
    worst = []
    for pos in worst_order:
        row = x_test.iloc[pos]
        worst.append({
            "actual": float(y_test.iloc[pos]), "predicted": float(predictions[pos]),
            "absolute_error": float(abs_error[pos]),
            "produce_type": row["produce_type"], "storage_type": row["storage_type"],
        })
    test_examples = []
    for pos in range(min(10, len(test))):
        row = x_test.iloc[pos]
        test_examples.append({
            **{c: jsonable(row[c]) for c in FEATURES},
            "actual": float(y_test.iloc[pos]),
            "predicted": float(predictions[pos]),
            "absolute_error": float(abs_error[pos]),
        })

    transformed_names = list(preprocessor.get_feature_names_out())
    gain_map = model.get_booster().get_score(importance_type="gain")
    transformed_importance = []
    logical = {name: 0.0 for name in FEATURES}
    for i, name in enumerate(transformed_names):
        gain = float(gain_map.get(f"f{i}", 0.0))
        transformed_importance.append({"feature": name, "gain": gain})
        if name.startswith("categorical__produce_type_"):
            logical["produce_type"] += gain
        elif name.startswith("categorical__storage_type_"):
            logical["storage_type"] += gain
        elif name.startswith("numeric__"):
            logical[name.split("__", 1)[1]] += gain
    total_gain = sum(logical.values()) or 1.0
    logical_rows = sorted(
        [{"feature": k, "gain": v, "gain_share": v / total_gain} for k, v in logical.items()],
        key=lambda item: item["gain"], reverse=True,
    )
    transformed_importance.sort(key=lambda item: item["gain"], reverse=True)

    ARTIFACTS.mkdir(parents=True)
    METRICS.mkdir(parents=True)
    model_path = ARTIFACTS / f"{VERSION}.json"
    model.save_model(model_path)
    joblib.dump(preprocessor, ARTIFACTS / "preprocessor.joblib")
    manifest = {
        "model_version": VERSION,
        "target": TARGET,
        "numeric_features": NUMERIC,
        "categorical_features": CATEGORICAL,
        "input_features": FEATURES,
        "input_order": FEATURES,
        "transformed_feature_names": transformed_names,
        "model_file": model_path.name,
        "preprocessor_file": "preprocessor.joblib",
    }
    (ARTIFACTS / "feature_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    sha = hashlib.sha256(DATA.read_bytes()).hexdigest()
    dataset_validation = {
        "filename": DATA.name, "sha256": sha, "rows": len(df), "columns": list(df.columns),
        "missing_values_per_column": {c: int(v) for c, v in df.isna().sum().items()},
        "exact_duplicate_rows": int(df.duplicated().sum()),
        "duplicate_percentage": float(df.duplicated().mean() * 100),
        "target": {
            "min": float(df[TARGET].min()), "max": float(df[TARGET].max()),
            "mean": float(df[TARGET].mean()), "median": float(df[TARGET].median()),
            "std": float(df[TARGET].std()),
            "quartiles": {"q1": float(df[TARGET].quantile(.25)), "q2": float(df[TARGET].quantile(.5)), "q3": float(df[TARGET].quantile(.75))},
            "equal_0_5_count": int(df[TARGET].eq(.5).sum()),
            "equal_0_5_percent": float(df[TARGET].eq(.5).mean() * 100),
            "most_common_values": [{"value": float(k), "count": int(v)} for k, v in df[TARGET].value_counts().head(10).items()],
        },
    }
    metrics = {
        "overall": overall,
        "excluding_0_5_day": regression_metrics(y_test.to_numpy()[nonfloor], predictions[nonfloor]),
        "0_5_day_group": {
            "count": int(floor.sum()),
            "mae": float(mean_absolute_error(floor_y, floor_pred)),
            "rmse": float(np.sqrt(mean_squared_error(floor_y, floor_pred))),
            "mean_prediction": float(floor_pred.mean()),
            "median_prediction": float(np.median(floor_pred)),
            "min_prediction": float(floor_pred.min()), "max_prediction": float(floor_pred.max()),
        },
        "error_analysis": error_summary,
        "validation_candidates": validation_results,
        "selected_validation_candidate_index": selected_index,
        "worst_10_test_predictions": worst,
        "10_test_examples": test_examples,
        "feature_importance": {
            "top_transformed_features": transformed_importance[:25],
            "aggregated_logical_features": logical_rows,
            "importance_type": "gain; interpretive only, not causal",
        },
        "dataset_validation": dataset_validation,
        "split_counts": {"train": len(train), "validation": len(valid), "test": len(test)},
    }
    (METRICS / "metrics.json").write_text(json.dumps(jsonable(metrics), indent=2), encoding="utf-8")
    (METRICS / "test_examples.json").write_text(json.dumps(jsonable(test_examples), indent=2), encoding="utf-8")

    selected_params = candidates[selected_index]
    config = {
        "dataset_filename": DATA.name, "dataset_sha256": sha, "dataset_row_count": len(df),
        "feature_list": FEATURES, "target": TARGET,
        "split_percentages": {"train": 70, "validation": 15, "test": 15},
        "split_counts": {"train": len(train), "validation": len(valid), "test": len(test)},
        "split_method": "two-stage shuffled train_test_split; fixed seed",
        "random_seed": SEED, "python_version": platform.python_version(),
        "xgboost_version": xgboost.__version__, "pandas_version": pd.__version__,
        "scikit_learn_version": sklearn.__version__,
        "hyperparameters": {
            **selected_params, "objective": "reg:squarederror", "eval_metric": "rmse",
            "random_state": SEED, "n_jobs": 4, "tree_method": "hist",
        },
        "candidate_validation_results": validation_results,
        "preprocessing": {
            "categorical": "OneHotEncoder(handle_unknown='ignore', sparse_output=True)",
            "numeric": "passthrough; no scaling", "column_order": FEATURES,
        },
        "training_timestamp_utc": datetime.now(timezone.utc).isoformat(),
        "model_version": VERSION,
    }
    (ARTIFACTS / "training_config.json").write_text(json.dumps(jsonable(config), indent=2), encoding="utf-8")

    model_card = f"""## Model Card — Shelf-Life XGBoost Development Model

### Version

`{VERSION}`

### Status

Development / Experimental

### Purpose

Predict remaining shelf life in days using the existing AgriTrace shelf-life input interface. This isolated experiment is not connected to production.

### Inputs

{', '.join(f'`{f}`' for f in FEATURES)}

### Target

`{TARGET}`

### Dataset

`{DATA.name}` — {len(df):,} rows; SHA-256 `{sha}`. The CSV contains all eight inputs and the target. Provenance is undocumented/unknown; prior structural investigation found formula-like patterns but could not establish how target values were produced. Labels have not been independently verified against measured real-world shelf life.

### Model

XGBoost regression (`{xgboost.__version__}`). Train/validation/test split: {len(train):,}/{len(valid):,}/{len(test):,} (70/15/15), seed {SEED}. Candidate parameters were selected by validation MAE; test data was held out.

### Preprocessing

One-hot encoding for `produce_type` and `storage_type`; numeric features passed through. The fitted ColumnTransformer is saved and reused by the prediction wrapper.

### Evaluation

Test MAE: {overall['mae']:.4f} days; RMSE: {overall['rmse']:.4f} days; R²: {overall['r2']:.4f}. Excluding exact 0.5-day targets: MAE {metrics['excluding_0_5_day']['mae']:.4f}, RMSE {metrics['excluding_0_5_day']['rmse']:.4f}, R² {metrics['excluding_0_5_day']['r2']:.4f}.

### 0.5-Day Analysis

Test count {int(floor.sum())}; MAE {metrics['0_5_day_group']['mae']:.4f}; RMSE {metrics['0_5_day_group']['rmse']:.4f}; mean prediction {metrics['0_5_day_group']['mean_prediction']:.4f}; median {metrics['0_5_day_group']['median_prediction']:.4f}; min/max {metrics['0_5_day_group']['min_prediction']:.4f}/{metrics['0_5_day_group']['max_prediction']:.4f}. The full dataset contains {dataset_validation['target']['equal_0_5_count']:,} such rows ({dataset_validation['target']['equal_0_5_percent']:.3f}%). This floor may influence aggregate metrics.

### Limitations

- Dataset provenance is undocumented/unknown.
- Target labels have not been independently verified against measured real-world shelf life.
- This model is not scientifically validated for real-world deployment.
- Random train/test performance does not establish real-world generalization.
- The 0.5-day floor may influence aggregate metrics.
- The unconstrained regressor can emit values below the dataset's 0.5-day minimum (test floor-group minimum observed: {metrics['0_5_day_group']['min_prediction']:.4f}); this output-range issue needs resolution and validation before any integration.
- Structural associations in the dataset may permit the model to learn dataset-specific label patterns.

### Production Status

This model has NOT replaced the existing production shelf-life model.

### Intended Next Step

Independent validation and controlled integration testing before production use, after provenance, leakage, and real-world target validity are established.
"""
    (HERE / "model_card.md").write_text(model_card, encoding="utf-8")
    print(json.dumps({"overall": overall, "excluding_0_5_day": metrics["excluding_0_5_day"], "0_5_day_group": metrics["0_5_day_group"], "splits": config["split_counts"], "selected_params": config["hyperparameters"], "out": str(HERE)}, indent=2))


if __name__ == "__main__":
    main()
