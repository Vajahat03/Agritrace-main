"""Train an isolated XGBoost model with log1p target and original-day evaluation."""
from __future__ import annotations

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
from sklearn.metrics import mean_absolute_error, mean_squared_error, median_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBRegressor


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
DATA = ROOT / "shelf life prediction dataset.xlsx.csv"
V1 = ROOT / "data_pipeline/shelf_life_training/shelf_life_xgboost_v1"
V2 = ROOT / "data_pipeline/shelf_life_training/shelf_life_xgboost_v2"
ART = HERE / "artifacts"
METRICS_DIR = HERE / "metrics"
REPORTS = HERE / "reports"
TARGET = "remaining_shelf_life_days"
CATS = ["produce_type", "storage_type"]
NUMS = ["freshness_score", "quality_score", "defect_probability", "temperature_c", "humidity_rh", "harvest_age_days"]
FEATURES = ["produce_type", *NUMS, "storage_type"]
EXPECTED = [*FEATURES, TARGET]
SEED = 42
VERSION = "shelf_life_xgboost_v2_log"


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


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def safety_snapshot():
    files = [DATA, ROOT / "ai/shelf_life/xgboost_model.py", ROOT / "agents/shelf_life_agent.py", ROOT / "backend/app.py"]
    for folder in (V1, V2, ROOT / "frontend"):
        if folder.is_dir():
            files.extend(p for p in folder.rglob("*") if p.is_file())
    snapshot = {}
    for path in sorted(set(files)):
        snapshot[str(path.relative_to(ROOT))] = sha256(path)
    return snapshot


def metrics(y, pred):
    y, pred = np.asarray(y, dtype=float), np.asarray(pred, dtype=float)
    err = pred - y
    return {
        "count": int(len(y)),
        "mae": float(mean_absolute_error(y, pred)),
        "rmse": float(np.sqrt(mean_squared_error(y, pred))),
        "r2": float(r2_score(y, pred)) if len(y) > 1 and np.var(y) > 0 else None,
        "median_absolute_error": float(median_absolute_error(y, pred)),
        "maximum_absolute_error": float(np.abs(err).max()),
        "mean_actual": float(y.mean()),
        "mean_predicted": float(pred.mean()),
        "mean_signed_error": float(err.mean()),
        "within_percent": {str(t): float((np.abs(err) <= t).mean() * 100) for t in (.5, 1, 2, 3)},
    }


def grouped_residual(frame, actual, pred, key):
    temp = frame[[key]].copy()
    temp["actual"] = np.asarray(actual)
    temp["predicted"] = np.asarray(pred)
    output = []
    for category, group in temp.groupby(key, sort=True, observed=True):
        e = group["predicted"].to_numpy() - group["actual"].to_numpy()
        output.append({
            "category": category, "count": len(group),
            "mae": float(np.mean(np.abs(e))), "mean_signed_error": float(np.mean(e)),
            "bias": "overprediction" if e.mean() > 1e-12 else "underprediction" if e.mean() < -1e-12 else "near-zero mean bias",
        })
    return output


def main():
    if ART.exists() or METRICS_DIR.exists() or REPORTS.exists():
        raise FileExistsError(f"Refusing to overwrite existing V2-Log outputs: {HERE}")
    if not DATA.is_file():
        raise FileNotFoundError(DATA)
    before = safety_snapshot()
    df = pd.read_csv(DATA)
    if df.columns.tolist() != EXPECTED:
        raise ValueError(f"Expected columns {EXPECTED}; got {df.columns.tolist()}")
    if df.isna().any().any():
        raise ValueError("Missing values found; stopping before training")
    for col in NUMS + [TARGET]:
        df[col] = pd.to_numeric(df[col], errors="raise")
    if not np.isfinite(df[NUMS + [TARGET]].to_numpy(dtype=float)).all():
        raise ValueError("Non-finite numeric values found")
    y = df[TARGET].to_numpy(dtype=float)
    if len(df) != 50_000 or not np.isclose(y.min(), .5) or int((y == .5).sum()) != 8_634 or int((y < .5).sum()) != 0:
        raise ValueError("Original target validation differs from previously verified values; inspect before training")

    # Reproduce V1's exact two-stage split procedure and ordered memberships.
    train_valid_idx, test_idx = train_test_split(np.arange(len(df)), test_size=.15, random_state=SEED, shuffle=True)
    train_idx, valid_idx = train_test_split(train_valid_idx, test_size=(.15 / .85), random_state=SEED, shuffle=True)
    train, valid, test = df.iloc[train_idx], df.iloc[valid_idx], df.iloc[test_idx]
    if (len(train), len(valid), len(test)) != (34_999, 7_501, 7_500):
        raise AssertionError("Unexpected split sizes")

    # V1 comparison artifacts and splitter are read-only.
    v1_cfg = json.loads((V1 / "artifacts/training_config.json").read_text(encoding="utf-8"))
    if v1_cfg["split_counts"] != {"train": len(train), "validation": len(valid), "test": len(test)}:
        raise AssertionError("V1 and V2-Log split sizes differ")
    if v1_cfg["random_seed"] != SEED or "two-stage" not in v1_cfg["split_method"]:
        raise AssertionError("V1 split procedure differs from this experiment's reproduction")

    preprocessor = ColumnTransformer(
        [("categorical", OneHotEncoder(handle_unknown="ignore", sparse_output=True), CATS), ("numeric", "passthrough", NUMS)],
        remainder="drop", verbose_feature_names_out=True,
    )
    x_train = preprocessor.fit_transform(train[FEATURES])
    x_valid = preprocessor.transform(valid[FEATURES])  # retained solely to confirm reusable transformation
    x_test = preprocessor.transform(test[FEATURES])
    params = {k: v for k, v in v1_cfg["hyperparameters"].items() if k not in {"objective", "eval_metric", "random_state", "n_jobs", "tree_method"}}
    model = XGBRegressor(**params, objective="reg:squarederror", eval_metric="rmse", random_state=SEED, n_jobs=4, tree_method="hist")
    y_train_log = np.log1p(train[TARGET].to_numpy(dtype=float))
    model.fit(x_train, y_train_log, verbose=False)
    pred_log = np.asarray(model.predict(x_test), dtype=float)
    pred_days = np.expm1(pred_log)
    y_test = test[TARGET].to_numpy(dtype=float)
    if not np.isfinite(pred_days).all():
        raise AssertionError("Model produced non-finite day predictions")

    # V1: same test indexes and original-target model, both evaluated in days.
    v1_pre = joblib.load(V1 / "artifacts/preprocessor.joblib")
    v1_model = XGBRegressor()
    v1_model.load_model(V1 / "artifacts/shelf_life_xgboost_v1.json")
    v1_pred = np.asarray(v1_model.predict(v1_pre.transform(test[FEATURES])), dtype=float)
    v1_metrics = metrics(y_test, v1_pred)
    v1_saved_metrics = json.loads((V1 / "metrics/metrics.json").read_text(encoding="utf-8"))
    for name in ("mae", "rmse", "r2"):
        if not np.isclose(v1_metrics[name], v1_saved_metrics["overall"][name], rtol=1e-5, atol=1e-6):
            raise AssertionError(f"V1 test predictions do not reproduce saved {name}: split/model mismatch")
    v2_metrics = metrics(y_test, pred_days)
    split_hashes = {
        name: hashlib.sha256(np.asarray(indices, dtype=np.int64).tobytes()).hexdigest()
        for name, indices in (("train", train_idx), ("validation", valid_idx), ("test", test_idx))
    }

    # Target-range and 0.5-day subgroup metrics, all in original days.
    ranges = [
        ("exactly_0_5", y_test == .5),
        ("gt_0_5_to_1", (y_test > .5) & (y_test <= 1)),
        ("gt_1_to_2", (y_test > 1) & (y_test <= 2)),
        ("gt_2_to_5", (y_test > 2) & (y_test <= 5)),
        ("gt_5_to_10", (y_test > 5) & (y_test <= 10)),
        ("gt_10_to_20", (y_test > 10) & (y_test <= 20)),
        ("gt_20_to_40", (y_test > 20) & (y_test <= 40)),
        ("gt_40", y_test > 40),
    ]
    range_metrics = []
    for label, mask in ranges:
        if mask.any():
            m = metrics(y_test[mask], pred_days[mask])
            range_metrics.append({"range": label, **m})
        else:
            range_metrics.append({"range": label, "count": 0, "mae": None, "rmse": None, "r2": None, "mean_actual": None, "mean_predicted": None, "mean_signed_error": None})
    floor_mask = y_test == .5
    other_mask = ~floor_mask
    floor_metrics = metrics(y_test[floor_mask], pred_days[floor_mask])
    nonfloor_metrics = metrics(y_test[other_mask], pred_days[other_mask])
    error = pred_days - y_test
    residual_summary = {
        "count": len(error), "mean_residual_prediction_minus_actual": float(error.mean()),
        "median_residual": float(np.median(error)), "mae": float(np.mean(np.abs(error))),
        "rmse": float(np.sqrt(np.mean(error ** 2))),
    }
    prediction_summary = {
        "minimum": float(pred_days.min()), "maximum": float(pred_days.max()),
        "mean": float(pred_days.mean()), "median": float(np.median(pred_days)),
        "count_below_0": int((pred_days < 0).sum()),
        "count_below_0_5": int((pred_days < .5).sum()),
        "count_below_1": int((pred_days < 1).sum()),
    }
    v1_compare = {
        "V1": v1_metrics,
        "V2-Log": v2_metrics,
        "delta_V2_Log_minus_V1": {
            key: (v2_metrics[key] - v1_metrics[key]) if v2_metrics[key] is not None and v1_metrics[key] is not None else None
            for key in ("mae", "rmse", "r2", "median_absolute_error", "maximum_absolute_error")
        },
        "within_threshold_percentage": {
            str(t): {"V1": v1_metrics["within_percent"][str(t)], "V2-Log": v2_metrics["within_percent"][str(t)]}
            for t in (.5, 1, 2, 3)
        },
        "same_test_row_indices": True,
        "same_test_rows": len(test),
    }

    # Save only inside the new V2-Log directory.
    ART.mkdir(parents=True)
    METRICS_DIR.mkdir()
    REPORTS.mkdir()
    model_path = ART / f"{VERSION}.json"
    model.save_model(model_path)
    joblib.dump(preprocessor, ART / "preprocessor.joblib")
    transformed_names = list(preprocessor.get_feature_names_out())
    manifest = {
        "model_version": VERSION, "target": TARGET, "target_transformation": "log1p",
        "inverse_transformation": "expm1", "numeric_features": NUMS,
        "categorical_features": CATS, "input_features": FEATURES, "input_order": FEATURES,
        "transformed_feature_names": transformed_names,
        "model_file": model_path.name, "preprocessor_file": "preprocessor.joblib",
    }
    (ART / "feature_manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    v2_training_config = {
        "model_version": VERSION,
        "dataset_filename": DATA.name,
        "dataset_sha256": sha256(DATA),
        "dataset_row_count": len(df),
        "feature_list": FEATURES,
        "target": TARGET,
        "original_target_column": TARGET,
        "target_transformation": "log1p",
        "inverse_transformation": "expm1",
        "split_percentages": {"train": 70, "validation": 15, "test": 15},
        "split_counts": {"train": len(train), "validation": len(valid), "test": len(test)},
        "split_random_seed": SEED,
        "split_procedure": "Same two-stage shuffled train_test_split row assignments as V1",
        "split_index_sha256": split_hashes,
        "python_version": platform.python_version(),
        "xgboost_version": xgboost.__version__,
        "scikit_learn_version": sklearn.__version__,
        "hyperparameters": {**params, "objective": "reg:squarederror", "eval_metric": "rmse", "random_state": SEED, "n_jobs": 4, "tree_method": "hist"},
        "preprocessing": {
            "categorical_features": CATS,
            "categorical_encoder": "OneHotEncoder(handle_unknown='ignore', sparse_output=True)",
            "numeric_features": NUMS,
            "numeric_transform": "passthrough; no scaling",
            "preprocessor_fit_scope": "training rows only",
            "transformed_feature_names": transformed_names,
        },
        "training_artifact_saved_timestamp_utc": datetime.fromtimestamp(model_path.stat().st_mtime, timezone.utc).isoformat(),
    }
    (ART / "training_config.json").write_text(json.dumps(v2_training_config, indent=2), encoding="utf-8")
    split_report = {
        "procedure": "V1 two-stage shuffled train_test_split; seed 42",
        "counts": {"train": len(train), "validation": len(valid), "test": len(test)},
        "same_v1_test_rows": True, "same_v1_train_membership": True,
        "same_v1_validation_membership": True,
        "ordered_index_sha256": split_hashes,
        "v1_method": v1_cfg["split_method"],
    }
    (REPORTS / "split_verification.json").write_text(json.dumps(split_report, indent=2), encoding="utf-8")

    dataset_report = {
        "filename": DATA.name, "sha256": sha256(DATA), "rows": len(df), "columns": df.columns.tolist(),
        "dtypes": {c: str(t) for c, t in df.dtypes.items()},
        "missing_values": {c: int(n) for c, n in df.isna().sum().items()},
        "exact_duplicate_rows": int(df.duplicated().sum()),
        "predictor_combinations_unique": int(df[FEATURES].drop_duplicates().shape[0]),
        "target": {
            "count": int(df[TARGET].count()), "minimum": float(df[TARGET].min()), "maximum": float(df[TARGET].max()),
            "mean": float(df[TARGET].mean()), "median": float(df[TARGET].median()), "std_sample": float(df[TARGET].std()),
            "q1": float(df[TARGET].quantile(.25)), "q3": float(df[TARGET].quantile(.75)),
            "equal_0_5": int((df[TARGET] == .5).sum()), "less_0_5": int((df[TARGET] < .5).sum()),
            "equal_1_0": int((df[TARGET] == 1).sum()),
        },
    }
    (REPORTS / "dataset_report.json").write_text(json.dumps(jsonable(dataset_report), indent=2), encoding="utf-8")
    (REPORTS / "dataset_report.md").write_text(
        f"# Dataset Report\n\n- File: `{DATA.name}`\n- Rows: {len(df):,}\n- Columns: {len(df.columns)}\n- Missing values: {int(df.isna().sum().sum())}\n- Exact duplicate rows: {int(df.duplicated().sum())}\n- Unique predictor vectors: {dataset_report['predictor_combinations_unique']:,}\n- SHA-256: `{dataset_report['sha256']}`\n\n"
        f"Original target: min {y.min():.2f}, max {y.max():.2f}, mean {y.mean():.6f}, median {np.median(y):.2f}, SD {df[TARGET].std():.6f}, Q1 {df[TARGET].quantile(.25):.2f}, Q3 {df[TARGET].quantile(.75):.2f}.\n\n"
        f"Exact 0.5 count: {int((y == .5).sum()):,}; below 0.5: {int((y < .5).sum()):,}; exact 1.0: {int((y == 1).sum()):,}. Target values were not altered in the source or for day-unit evaluation; training used `log1p(y)`.\n",
        encoding="utf-8",
    )

    numeric_corr = {
        c: {"pearson": float(df[c].corr(df[TARGET])), "spearman": float(df[c].corr(df[TARGET], method="spearman"))}
        for c in NUMS
    }
    importance_gain = model.get_booster().get_score(importance_type="gain")
    transformed_importance = []
    logical_importance = {k: 0.0 for k in FEATURES}
    for i, name in enumerate(transformed_names):
        gain = float(importance_gain.get(f"f{i}", 0.0))
        transformed_importance.append({"feature": name, "gain": gain})
        if name.startswith("categorical__produce_type_"):
            logical_importance["produce_type"] += gain
        elif name.startswith("categorical__storage_type_"):
            logical_importance["storage_type"] += gain
        elif name.startswith("numeric__"):
            logical_importance[name.split("__", 1)[1]] += gain
    transformed_importance.sort(key=lambda x: x["gain"], reverse=True)
    total_gain = sum(logical_importance.values()) or 1.0
    logical_importance = [{"feature": k, "gain": v, "gain_share": v / total_gain} for k, v in logical_importance.items()]
    logical_importance.sort(key=lambda x: x["gain"], reverse=True)
    importance = {"importance_type": "gain; descriptive, not causal", "top_transformed_features": transformed_importance[:25], "aggregated_logical_features": logical_importance}

    test_examples = []
    for i in range(10):
        row = test.iloc[i]
        test_examples.append({**{c: jsonable(row[c]) for c in FEATURES}, "actual_days": float(y_test[i]), "predicted_days": float(pred_days[i]), "absolute_error_days": float(abs(error[i]))})
    metrics_output = {
        "model": VERSION, "target_transformation": "log1p", "inverse_transformation": "expm1",
        "test_rows": len(test), "mae": v2_metrics["mae"], "rmse": v2_metrics["rmse"], "r2": v2_metrics["r2"],
        "median_absolute_error": v2_metrics["median_absolute_error"], "max_absolute_error": v2_metrics["maximum_absolute_error"],
        "within_0_5_days": v2_metrics["within_percent"]["0.5"], "within_1_day": v2_metrics["within_percent"]["1"],
        "within_2_days": v2_metrics["within_percent"]["2"], "within_3_days": v2_metrics["within_percent"]["3"],
        "overall": v2_metrics, "excluding_0_5_day": metrics(y_test[other_mask], pred_days[other_mask]),
        "0_5_day_group": {
            "count": int(floor_mask.sum()), "percentage_of_test": float(floor_mask.mean() * 100),
            "percentage_of_full_dataset": float((y == .5).mean() * 100),
            "mae": floor_metrics["mae"], "rmse": floor_metrics["rmse"], "mean_actual": floor_metrics["mean_actual"],
            "mean_predicted": floor_metrics["mean_predicted"], "median_predicted": float(np.median(pred_days[floor_mask])),
            "minimum_predicted": float(pred_days[floor_mask].min()), "maximum_predicted": float(pred_days[floor_mask].max()),
            "mean_signed_error": floor_metrics["mean_signed_error"],
        },
        "prediction_sanity": prediction_summary,
        "residual_summary": residual_summary,
        "performance_by_target_range": range_metrics,
        "residual_bias_by_produce_type": grouped_residual(test, y_test, pred_days, "produce_type"),
        "residual_bias_by_storage_type": grouped_residual(test, y_test, pred_days, "storage_type"),
        "residual_bias_by_target_range": [
            {"range": r["range"], "count": r["count"], "mae": r["mae"], "mean_signed_error": r["mean_signed_error"],
             "bias": "overprediction" if r.get("mean_signed_error") is not None and r["mean_signed_error"] > 1e-12 else "underprediction" if r.get("mean_signed_error") is not None and r["mean_signed_error"] < -1e-12 else "near-zero mean bias"}
            for r in range_metrics
        ],
        "numeric_feature_target_correlations_full_dataset": numeric_corr,
        "feature_importance": importance,
        "v1_comparison": v1_compare,
        "test_examples": test_examples,
        "limitations": [
            "Dataset provenance is undocumented; labels have not been independently validated against measured real-world shelf life.",
            "The 8,634-row exact 0.5-day mass and its unknown origin remain limitations.",
            "All 50,000 predictor vectors are unique; repeated-vector target consistency cannot be assessed.",
            "Synthetic/formula-generated structure is possible but unproven.",
            "A random row split may overestimate generalization when hidden groups or generation rules are shared.",
            "Feature correlations are associations and do not establish causality.",
        ],
    }
    (METRICS_DIR / "metrics.json").write_text(json.dumps(jsonable(metrics_output), indent=2), encoding="utf-8")
    (METRICS_DIR / "v1_vs_v2_log_comparison.json").write_text(json.dumps(jsonable(v1_compare), indent=2), encoding="utf-8")
    (METRICS_DIR / "test_examples.json").write_text(json.dumps(jsonable(test_examples), indent=2), encoding="utf-8")

    v1_metric_values = {"MAE": v1_metrics["mae"], "RMSE": v1_metrics["rmse"], "R²": v1_metrics["r2"], "Median Absolute Error": v1_metrics["median_absolute_error"], "Maximum Absolute Error": v1_metrics["maximum_absolute_error"], "±0.5 day": v1_metrics["within_percent"]["0.5"], "±1 day": v1_metrics["within_percent"]["1"], "±2 days": v1_metrics["within_percent"]["2"], "±3 days": v1_metrics["within_percent"]["3"]}
    v2_metric_values = {"MAE": v2_metrics["mae"], "RMSE": v2_metrics["rmse"], "R²": v2_metrics["r2"], "Median Absolute Error": v2_metrics["median_absolute_error"], "Maximum Absolute Error": v2_metrics["maximum_absolute_error"], "±0.5 day": v2_metrics["within_percent"]["0.5"], "±1 day": v2_metrics["within_percent"]["1"], "±2 days": v2_metrics["within_percent"]["2"], "±3 days": v2_metrics["within_percent"]["3"]}
    compare_table = "| Metric | V1 | V2-Log |\n|---|---:|---:|\n" + "\n".join(f"| {k} | {v1_metric_values[k]:.4f} | {v2_metric_values[k]:.4f} |" for k in v1_metric_values)
    range_compare = []
    for label, mask in ranges:
        if mask.any():
            m1, m2 = metrics(y_test[mask], v1_pred[mask]), metrics(y_test[mask], pred_days[mask])
            range_compare.append({"range": label, "count": int(mask.sum()), "v1_mae": m1["mae"], "v2_log_mae": m2["mae"], "v1_rmse": m1["rmse"], "v2_log_rmse": m2["rmse"], "v1_mean_bias": m1["mean_signed_error"], "v2_log_mean_bias": m2["mean_signed_error"]})
    (REPORTS / "v1_vs_v2_log_comparison.md").write_text(
        "# V1 vs V2-Log Comparison\n\n"
        "Both models were evaluated against the same original target values on the same 7,500 test rows. V1 predicts the original target directly; V2-Log predicts `log1p(y)` and applies `expm1` for day-unit evaluation. Differences are descriptive and do not declare a winner.\n\n"
        f"{compare_table}\n\n"
        "The ± threshold rows are percentages of test predictions within that absolute error in days.\n\n"
        f"- V1 0.5-day group: n={floor_metrics['count']}, MAE={metrics(y_test[floor_mask],v1_pred[floor_mask])['mae']:.4f}, RMSE={metrics(y_test[floor_mask],v1_pred[floor_mask])['rmse']:.4f}; V2-Log: MAE={floor_metrics['mae']:.4f}, RMSE={floor_metrics['rmse']:.4f}.\n"
        f"- V1 excluding 0.5: MAE={metrics(y_test[other_mask],v1_pred[other_mask])['mae']:.4f}, RMSE={metrics(y_test[other_mask],v1_pred[other_mask])['rmse']:.4f}, R²={metrics(y_test[other_mask],v1_pred[other_mask])['r2']:.4f}; V2-Log: MAE={nonfloor_metrics['mae']:.4f}, RMSE={nonfloor_metrics['rmse']:.4f}, R²={nonfloor_metrics['r2']:.4f}.\n"
        f"- Prediction range: V1 {v1_pred.min():.4f}–{v1_pred.max():.4f}; V2-Log {pred_days.min():.4f}–{pred_days.max():.4f}.\n"
        f"- Negative predictions: V1 {int((v1_pred<0).sum())}; V2-Log {prediction_summary['count_below_0']}. Below 0.5: V1 {int((v1_pred<.5).sum())}; V2-Log {prediction_summary['count_below_0_5']}. Below 1: V1 {int((v1_pred<1).sum())}; V2-Log {prediction_summary['count_below_1']}.\n\n"
        "## Shelf-Life Range Comparison\n\n"
        "| Range | n | V1 MAE | V2-Log MAE | V1 RMSE | V2-Log RMSE | V1 signed bias | V2-Log signed bias |\n|---|---:|---:|---:|---:|---:|---:|---:|\n"
        + "\n".join(f"| {r['range']} | {r['count']} | {r['v1_mae']:.3f} | {r['v2_log_mae']:.3f} | {r['v1_rmse']:.3f} | {r['v2_log_rmse']:.3f} | {r['v1_mean_bias']:.3f} | {r['v2_log_mean_bias']:.3f} |" for r in range_compare)
        + "\n\nV1 was reproduced against its saved metrics on these test rows. A smaller error in one subgroup does not establish overall or real-world superiority.\n",
        encoding="utf-8",
    )

    residual_rows = [{"Group": "Overall", "n": residual_summary["count"], "MAE": residual_summary["mae"], "Mean signed error": residual_summary["mean_residual_prediction_minus_actual"], "Bias": "overprediction" if error.mean() > 1e-12 else "underprediction" if error.mean() < -1e-12 else "near-zero mean bias"}]
    (REPORTS / "residual_analysis.md").write_text(
        "# V2-Log Residual Analysis\n\nResidual is `prediction − actual` in days; positive values indicate overprediction and negative values underprediction. No causal interpretation is intended.\n\n"
        f"Overall: n={residual_summary['count']}; mean residual {residual_summary['mean_residual_prediction_minus_actual']:.4f}; median residual {residual_summary['median_residual']:.4f}; MAE {residual_summary['mae']:.4f}; RMSE {residual_summary['rmse']:.4f}.\n\n"
        "## By Produce Type\n\n| Produce | n | MAE | Mean signed error | Pattern |\n|---|---:|---:|---:|---|\n"
        + "\n".join(f"| {r['category']} | {r['count']} | {r['mae']:.3f} | {r['mean_signed_error']:.3f} | {r['bias']} |" for r in metrics_output["residual_bias_by_produce_type"])
        + "\n\n## By Storage Type\n\n| Storage | n | MAE | Mean signed error | Pattern |\n|---|---:|---:|---:|---|\n"
        + "\n".join(f"| {r['category']} | {r['count']} | {r['mae']:.3f} | {r['mean_signed_error']:.3f} | {r['bias']} |" for r in metrics_output["residual_bias_by_storage_type"])
        + "\n\n## By Target Range\n\n| Range | n | MAE | Mean signed error | Pattern |\n|---|---:|---:|---:|---|\n"
        + "\n".join(f"| {r['range']} | {r['count']} | {r['mae']:.3f} | {r['mean_signed_error']:.3f} | {r['bias']} |" for r in metrics_output["residual_bias_by_target_range"])
        + "\n",
        encoding="utf-8",
    )

    model_card = f"""# Model Card — Shelf-Life XGBoost V2-Log

## Model

`{VERSION}`

## Status

Experimental development model

## Purpose and intended use

Development experiment to compare direct-target XGBoost with log1p-target XGBoost. Not approved for real-world shelf-life decisions.

## Inputs

{', '.join(FEATURES)}

## Target

Original target: `{TARGET}`. Training target: `log1p(remaining_shelf_life_days)`. Inference transformation: `expm1(prediction)`.

## Dataset

`{DATA.name}` ({len(df):,} rows). Original target values are preserved. Exact 0.5-day labels: {int((y == .5).sum()):,}; below 0.5: {int((y < .5).sum()):,}. Provenance is undocumented and target values have not been independently verified as measured real-world shelf life.

## Model and preprocessing

XGBoost {xgboost.__version__}; one-hot encoding for produce and storage; numerical features pass through unchanged. Fitted preprocessor uses training rows only. Split is the same row assignment as V1: {len(train):,}/{len(valid):,}/{len(test):,}, seed 42.

## Evaluation

Same V1 test rows, original days: MAE {v2_metrics['mae']:.4f}; RMSE {v2_metrics['rmse']:.4f}; R² {v2_metrics['r2']:.4f}. Raw `expm1` prediction range {prediction_summary['minimum']:.4f} to {prediction_summary['maximum']:.4f}; negative predictions {prediction_summary['count_below_0']}.

## Limitations

- Dataset provenance is undocumented; targets are not independently verified measurements.
- There are 8,634 exact 0.5-day targets; why this floor occurs is unknown.
- All 50,000 feature vectors are unique; repeated-vector target consistency cannot be evaluated.
- Synthetic or formula-generated structure is possible but unproven.
- A random split may overestimate performance when hidden groups or generation rules are shared.
- Correlation and feature importance are descriptive, not causal.
- Log-space loss emphasizes relative error; inverse transformation can produce biased day-scale averages.
- Raw test predictions were all nonnegative (minimum {prediction_summary['minimum']:.4f} days), so no nonnegative clamp was needed for this test set. The wrapper preserves raw `expm1` outputs without clipping.
- This model has not been scientifically validated for real-world deployment.

## Production integration

NO. V2-Log remains isolated from production.
"""
    (HERE / "model_card.md").write_text(model_card, encoding="utf-8")
    (HERE / "README.md").write_text(
        "# Shelf-Life XGBoost V2-Log\n\n"
        "Isolated experimental model using `log1p` target training and `expm1` inverse transformation. Original data and prior model directories are read-only. Run `python train.py` using the project shelf-life virtual environment in the repository root. The script refuses to overwrite this directory.\n\n"
        "See `reports/` and `metrics/` for the same-row V1 comparison and limitations. No production integration is performed.\n",
        encoding="utf-8",
    )

    after = safety_snapshot()
    if before != after:
        changed = sorted(set(before) | set(after))
        bad = [p for p in changed if before.get(p) != after.get(p)]
        raise AssertionError(f"Protected files changed: {bad}")
    safety = {
        "unchanged": True, "original_dataset_sha256": before[str(DATA.relative_to(ROOT))],
        "v1_directory_unchanged": True,
        "previous_v2_directory_unchanged": True,
        "production_entrypoints_unchanged": True,
        "production_integration": False,
    }
    (REPORTS / "safety_verification.json").write_text(json.dumps(safety, indent=2), encoding="utf-8")
    print(json.dumps({"dataset": dataset_report["target"], "split": split_report, "v2_log": {"overall": v2_metrics, "floor": metrics_output["0_5_day_group"], "prediction_sanity": prediction_summary}, "v1_comparison": {"v1": v1_metrics, "v2_log": v2_metrics}, "safety": safety}, indent=2))


if __name__ == "__main__":
    main()
