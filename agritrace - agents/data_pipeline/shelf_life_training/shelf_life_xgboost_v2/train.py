"""Create the explicitly requested V2 target recode and isolated experiment."""
from __future__ import annotations

import csv
import hashlib
import json
import platform
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
ORIGINAL = ROOT / "shelf life prediction dataset.xlsx.csv"
DERIVED_DIR = HERE / "data"
DERIVED = DERIVED_DIR / "shelf_life_dataset_floor1.csv"
ART = HERE / "artifacts"
METRICS_DIR = HERE / "metrics"
TARGET = "remaining_shelf_life_days"
CATS = ["produce_type", "storage_type"]
NUMS = ["freshness_score", "quality_score", "defect_probability", "temperature_c", "humidity_rh", "harvest_age_days"]
FEATURES = ["produce_type", *NUMS, "storage_type"]
EXPECTED = [*FEATURES, TARGET]
SEED = 42
VERSION = "shelf_life_xgboost_v2"


def jsonable(x):
    if isinstance(x, dict):
        return {str(k): jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [jsonable(v) for v in x]
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        return float(x) if np.isfinite(x) else None
    if isinstance(x, (np.bool_,)):
        return bool(x)
    return x


def main():
    if not ORIGINAL.is_file():
        raise FileNotFoundError(ORIGINAL)
    if DERIVED_DIR.exists() or ART.exists() or METRICS_DIR.exists():
        raise FileExistsError(f"Refusing to overwrite existing V2 output: {HERE}")
    original_hash = hashlib.sha256(ORIGINAL.read_bytes()).hexdigest()
    with ORIGINAL.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)
    header = rows[0]
    if header != EXPECTED:
        raise ValueError(f"Unexpected dataset columns: {header}")
    y_col = header.index(TARGET)
    original_target = np.array([float(row[y_col]) for row in rows[1:]], dtype=float)
    converted_rows = 0
    exact_half_rows = int((original_target == 0.5).sum())
    above_half_rows = int((original_target > 0.5).sum())
    below_half_rows = int((original_target < 0.5).sum())
    original_one_rows = int((original_target == 1.0).sum())

    for row in rows[1:]:
        old = float(row[y_col])
        new = 0.0 if old < 0.5 else 1.0
        if old != new:
            converted_rows += 1
        row[y_col] = format(new, ".1f")

    DERIVED_DIR.mkdir(parents=True)
    with DERIVED.open("w", encoding="utf-8", newline="") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerows(rows)

    original = pd.read_csv(ORIGINAL)
    derived = pd.read_csv(DERIVED)
    if len(derived) != len(original) or list(derived.columns) != list(original.columns):
        raise AssertionError("Row/column shape changed")
    predictor_changed = int((original[FEATURES].to_numpy() != derived[FEATURES].to_numpy()).sum())
    target_changed = int((original[TARGET].to_numpy() != derived[TARGET].to_numpy()).sum())
    if predictor_changed != 0 or target_changed != converted_rows:
        raise AssertionError("Transformation verification mismatch")
    if int((derived[TARGET] == 0.5).sum()) != 0:
        raise AssertionError("Derived data still contains exact 0.5 targets")
    if float(derived[TARGET].min()) != 1.0 or int((derived[TARGET] < 1.0).sum()) != 0:
        raise AssertionError("Derived target does not meet the requested >=1 check")
    if derived[TARGET].nunique() != 1 or not derived[TARGET].eq(1.0).all():
        raise AssertionError("Expected the clarified target rule to yield a constant 1.0 target")
    if hashlib.sha256(ORIGINAL.read_bytes()).hexdigest() != original_hash:
        raise AssertionError("Original dataset changed during transformation")

    exact_half_changed = int(((original[TARGET] == 0.5) & (derived[TARGET] != original[TARGET])).sum())
    other_changed = int(((original[TARGET] != 0.5) & (derived[TARGET] != original[TARGET])).sum())
    transformation = {
        "rule": "targets < 0.5 -> 0.0; targets >= 0.5 -> 1.0 (exact 0.5 follows the original instruction to convert it to 1.0)",
        "original_rows": len(original), "derived_rows": len(derived),
        "original_columns": len(original.columns), "derived_columns": len(derived.columns),
        "original_exact_0_5_rows": exact_half_rows,
        "original_greater_than_0_5_rows": above_half_rows,
        "original_less_than_0_5_rows": below_half_rows,
        "original_1_0_rows": original_one_rows,
        "derived_exact_0_5_rows": int(derived[TARGET].eq(.5).sum()),
        "derived_1_0_rows": int(derived[TARGET].eq(1.0).sum()),
        "derived_min_target": float(derived[TARGET].min()),
        "derived_rows_below_1_0": int(derived[TARGET].lt(1.0).sum()),
        "predictor_values_changed": predictor_changed,
        "target_values_changed": target_changed,
        "exact_0_5_rows_changed_to_1_0": exact_half_changed,
        "non_0_5_rows_also_changed_under_clarified_rule": other_changed,
        "original_sha256_before_and_after": original_hash,
        "derived_sha256": hashlib.sha256(DERIVED.read_bytes()).hexdigest(),
    }
    (HERE / "transformation_report.json").write_text(json.dumps(transformation, indent=2), encoding="utf-8")
    (HERE / "transformation_report.md").write_text(
        "# V2 Derived Dataset Transformation Report\n\n"
        "The clarified target rule was applied to the development copy only: values below 0.5 become 0.0; values at or above 0.5 become 1.0. The original dataset has no values below 0.5, so all derived targets equal 1.0. This differs from the initial instruction to change only exact 0.5 rows; the user's later clarification explicitly selected the broader recoding.\n\n"
        f"- Original rows: {len(original):,}\n- Derived rows: {len(derived):,}\n"
        f"- Original columns: {len(original.columns)}\n- Derived columns: {len(derived.columns)}\n"
        f"- Original 0.5-day rows: {exact_half_rows:,}\n- Converted exact 0.5 rows to 1.0: {exact_half_changed:,}\n"
        f"- Original 1.0-day rows: {original_one_rows:,}\n- Derived 1.0-day rows: {int(derived[TARGET].eq(1.0).sum()):,}\n"
        f"- Original targets above 0.5: {above_half_rows:,}\n- Original targets below 0.5: {below_half_rows:,}\n"
        f"- Additional non-0.5 targets changed by the clarified rule: {other_changed:,}\n"
        f"- Predictor values changed: {predictor_changed}\n- Target values changed: {target_changed:,}\n"
        f"- Derived minimum target: {derived[TARGET].min():.1f}\n- Derived rows below 1.0: {int(derived[TARGET].lt(1.0).sum())}\n"
        f"- Original SHA-256 (unchanged): `{original_hash}`\n- Derived SHA-256: `{transformation['derived_sha256']}`\n",
        encoding="utf-8",
    )

    # Reproduce the exact two-stage V1 row split and use V1's selected hyperparameters.
    train_valid_idx, test_idx = train_test_split(np.arange(len(derived)), test_size=.15, random_state=SEED, shuffle=True)
    train_idx, valid_idx = train_test_split(train_valid_idx, test_size=(.15 / .85), random_state=SEED, shuffle=True)
    train, valid, test = derived.iloc[train_idx], derived.iloc[valid_idx], derived.iloc[test_idx]
    v1_config = json.loads((ROOT / "data_pipeline/shelf_life_training/shelf_life_xgboost_v1/artifacts/training_config.json").read_text(encoding="utf-8"))
    params = {k: v for k, v in v1_config["hyperparameters"].items() if k not in {"objective", "eval_metric", "random_state", "n_jobs", "tree_method"}}
    preprocessor = ColumnTransformer(
        [("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=True), CATS), ("numeric", "passthrough", NUMS)],
        remainder="drop", verbose_feature_names_out=True,
    )
    x_train = preprocessor.fit_transform(train[FEATURES])
    x_valid = preprocessor.transform(valid[FEATURES])
    x_test = preprocessor.transform(test[FEATURES])
    model = XGBRegressor(
        **params, objective="reg:squarederror", eval_metric="rmse", random_state=SEED, n_jobs=4, tree_method="hist",
    )
    model.fit(x_train, train[TARGET], verbose=False)
    pred = np.asarray(model.predict(x_test), dtype=float)
    actual = test[TARGET].to_numpy(dtype=float)

    ART.mkdir()
    METRICS_DIR.mkdir()
    model_path = ART / f"{VERSION}.json"
    model.save_model(model_path)
    joblib.dump(preprocessor, ART / "preprocessor.joblib")
    transformed_names = list(preprocessor.get_feature_names_out())
    manifest = {
        "model_version": VERSION, "target": TARGET, "numeric_features": NUMS,
        "categorical_features": CATS, "input_features": FEATURES,
        "input_order": FEATURES, "transformed_feature_names": transformed_names,
        "model_file": model_path.name, "preprocessor_file": "preprocessor.joblib",
        "target_recode": "target < 0.5 -> 0.0; target >= 0.5 -> 1.0",
    }
    (ART / "feature_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    v2_config = {
        "dataset_filename": DERIVED.name, "dataset_relative_path": str(DERIVED.relative_to(ROOT)),
        "dataset_sha256": transformation["derived_sha256"], "dataset_row_count": len(derived),
        "source_dataset_filename": ORIGINAL.name, "source_dataset_sha256": original_hash,
        "feature_list": FEATURES, "target": TARGET,
        "split_percentages": {"train": 70, "validation": 15, "test": 15},
        "split_counts": {"train": len(train), "validation": len(valid), "test": len(test)},
        "split_procedure": "Same two-stage shuffled train_test_split row selection as V1; seed 42",
        "random_seed": SEED, "python_version": platform.python_version(),
        "xgboost_version": xgboost.__version__, "scikit_learn_version": sklearn.__version__,
        "hyperparameters": {**params, "objective": "reg:squarederror", "eval_metric": "rmse", "random_state": SEED, "n_jobs": 4, "tree_method": "hist"},
        "preprocessing": {"categorical": "OneHotEncoder(handle_unknown='ignore', sparse_output=True)", "numeric": "passthrough", "input_order": FEATURES},
        "training_timestamp_utc": datetime.now(timezone.utc).isoformat(), "model_version": VERSION,
        "target_recode_rule": manifest["target_recode"],
    }
    (ART / "training_config.json").write_text(json.dumps(v2_config, indent=2), encoding="utf-8")

    variance = float(np.var(actual))
    metric_values = {
        "mae": float(mean_absolute_error(actual, pred)),
        "rmse": float(np.sqrt(mean_squared_error(actual, pred))),
        "r2": float(r2_score(actual, pred)) if variance > 0 else None,
    }
    metrics = {
        "overall": metric_values,
        "target_variance_test": variance,
        "test_prediction_range": {"min": float(pred.min()), "max": float(pred.max()), "mean": float(pred.mean()), "unique_predictions": int(np.unique(pred).size)},
        "split_counts": v2_config["split_counts"],
        "target_distribution": {"minimum": float(derived[TARGET].min()), "maximum": float(derived[TARGET].max()), "unique_values": int(derived[TARGET].nunique()), "rows_below_1": int(derived[TARGET].lt(1).sum())},
        "transformation": transformation,
        "interpretation": "The selected user recode collapses this dataset to one constant target value. The resulting XGBoost artifact is a technically trained constant-target regressor and has no meaningful shelf-life regression signal; test R2 is undefined because test-target variance is zero.",
    }
    metrics["10_test_examples"] = [
        {
            "actual": float(actual[i]),
            "predicted": float(pred[i]),
            "absolute_error": float(abs(actual[i] - pred[i])),
        }
        for i in range(10)
    ]
    (METRICS_DIR / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    card = f"""# Shelf-Life XGBoost V2 Development Model Card

## Status

Development / Experimental; not production-ready.

## Dataset and target

Derived dataset: `{DERIVED.name}` ({len(derived):,} rows). Rule: values below 0.5 map to 0.0 and values at or above 0.5 map to 1.0. The original dataset had no values below 0.5, so all {len(derived):,} derived targets equal 1.0. This collapses the continuous shelf-life target to a constant and removes useful regression signal.

## Inputs

{', '.join(FEATURES)}

## Model

XGBoost regression {xgboost.__version__}; same seed 42 and exact two-stage row split method as V1. Split counts: {len(train):,}/{len(valid):,}/{len(test):,}.

## Evaluation

Test MAE {metric_values['mae']:.8f}; RMSE {metric_values['rmse']:.8f}; R² is undefined because the target has zero variance. These figures measure reproduction of a constant recoded label, not shelf-life prediction quality.

## Limitations

Dataset provenance remains undocumented. The clarified recoding changed {target_changed:,} target values and made every label 1.0. The model therefore carries no demonstrated shelf-life regression value and must not be represented as a usable shelf-life predictor.

## Production status

This V2 artifact is isolated and has not replaced or modified the production predictor or V1.
"""
    (HERE / "model_card.md").write_text(card, encoding="utf-8")
    print(json.dumps({"transformation": transformation, "splits": v2_config["split_counts"], "metrics": metric_values, "target_variance_test": variance, "model": str(model_path)}, indent=2))


if __name__ == "__main__":
    main()
