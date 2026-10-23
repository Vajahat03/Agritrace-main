"""Recompute an audit from saved v1 artifacts without fitting or changing them."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn
import xgboost
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from xgboost import XGBRegressor


HERE = Path(__file__).resolve().parent
EXP = HERE.parent
ROOT = EXP.parents[2]
DATA = ROOT / "shelf life prediction dataset.xlsx.csv"
ART = EXP / "artifacts"
METRICS_PATH = EXP / "metrics" / "metrics.json"
TARGET = "remaining_shelf_life_days"
CATS = ["produce_type", "storage_type"]
NUMS = ["freshness_score", "quality_score", "defect_probability", "temperature_c", "humidity_rh", "harvest_age_days"]
FEATURES = ["produce_type", *NUMS, "storage_type"]
SEED = 42


def py(x):
    if isinstance(x, dict):
        return {str(k): py(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)):
        return [py(v) for v in x]
    if isinstance(x, (np.integer,)):
        return int(x)
    if isinstance(x, (np.floating, float)):
        return float(x) if np.isfinite(x) else None
    if isinstance(x, (np.bool_,)):
        return bool(x)
    if pd.isna(x):
        return None
    return x


def reg_metrics(y, p):
    y, p = np.asarray(y, dtype=float), np.asarray(p, dtype=float)
    out = {"count": int(len(y)), "mae": float(mean_absolute_error(y, p)), "rmse": float(np.sqrt(mean_squared_error(y, p)))}
    out["r2"] = float(r2_score(y, p)) if len(y) > 1 and np.var(y) > 0 else None
    out["mean_actual"] = float(y.mean()) if len(y) else None
    out["mean_predicted"] = float(p.mean()) if len(p) else None
    out["mean_signed_error_pred_minus_actual"] = float((p - y).mean()) if len(y) else None
    return out


def descriptive(series):
    s = pd.to_numeric(series, errors="coerce").dropna()
    return {
        "count": int(s.size), "min": float(s.min()), "max": float(s.max()),
        "mean": float(s.mean()), "median": float(s.median()),
        "std_sample": float(s.std(ddof=1)), "q1": float(s.quantile(.25)),
        "q3": float(s.quantile(.75)),
    }


def category_table(frame, col):
    out = []
    for category, g in frame.groupby(col, observed=True, sort=True):
        out.append({
            "category": category, "count": len(g), "share_percent": len(g) / len(frame) * 100,
            "target": descriptive(g[TARGET]),
        })
    return out


def performance_table(frame, actual, predicted, col):
    tmp = frame[[col]].copy()
    tmp["_actual"] = np.asarray(actual)
    tmp["_pred"] = np.asarray(predicted)
    out = []
    for category, g in tmp.groupby(col, observed=True, sort=True):
        met = reg_metrics(g._actual, g._pred)
        met.update({"category": category, "mean_absolute_error": met["mae"]})
        out.append(met)
    return out


def main():
    df = pd.read_csv(DATA)
    cfg = json.loads((ART / "training_config.json").read_text(encoding="utf-8"))
    manifest = json.loads((ART / "feature_manifest.json").read_text(encoding="utf-8"))
    saved_metrics = json.loads(METRICS_PATH.read_text(encoding="utf-8"))
    saved_pre = joblib.load(ART / manifest["preprocessor_file"])
    model = XGBRegressor()
    model.load_model(ART / manifest["model_file"])
    booster_rounds = int(model.get_booster().num_boosted_rounds())
    booster_features = int(model.get_booster().num_features())

    expected_cols = ["produce_type", *NUMS, "storage_type", TARGET]
    if df.columns.tolist() != expected_cols:
        raise ValueError(f"Dataset columns changed: {df.columns.tolist()}")
    if cfg["dataset_row_count"] != len(df) or cfg["dataset_sha256"] != hashlib.sha256(DATA.read_bytes()).hexdigest():
        raise ValueError("Dataset does not match the training configuration fingerprint")
    if manifest["input_features"] != FEATURES or manifest["target"] != TARGET:
        raise ValueError("Feature manifest mismatch")
    if booster_rounds != cfg["hyperparameters"]["n_estimators"]:
        raise ValueError("Saved model boosting rounds do not match training_config.json")
    if booster_features != len(manifest["transformed_feature_names"]):
        raise ValueError("Saved model feature count does not match the feature manifest")

    train_valid_idx, test_idx = train_test_split(np.arange(len(df)), test_size=.15, random_state=SEED, shuffle=True)
    train_idx, valid_idx = train_test_split(train_valid_idx, test_size=(.15 / .85), random_state=SEED, shuffle=True)
    test = df.iloc[test_idx].copy()
    x_test_t = saved_pre.transform(test[FEATURES])
    pred = np.asarray(model.predict(x_test_t), dtype=float)
    actual = test[TARGET].to_numpy(dtype=float)
    if len(pred) != len(test) or not np.isfinite(pred).all():
        raise ValueError("Loaded model produced invalid test predictions")
    calculated_overall = reg_metrics(actual, pred)
    for k in ("mae", "rmse", "r2"):
        if not np.isclose(calculated_overall[k], saved_metrics["overall"][k], rtol=1e-5, atol=1e-6):
            raise ValueError(f"Saved {k} does not match recomputation: {saved_metrics['overall'][k]} vs {calculated_overall[k]}")

    bins = [
        ("exactly_0_5", df[TARGET].eq(.5)),
        ("gt_0_5_to_1", (df[TARGET] > .5) & (df[TARGET] <= 1)),
        ("gt_1_to_2", (df[TARGET] > 1) & (df[TARGET] <= 2)),
        ("gt_2_to_3", (df[TARGET] > 2) & (df[TARGET] <= 3)),
        ("gt_3_to_5", (df[TARGET] > 3) & (df[TARGET] <= 5)),
        ("gt_5_to_7", (df[TARGET] > 5) & (df[TARGET] <= 7)),
        ("gt_7_to_14", (df[TARGET] > 7) & (df[TARGET] <= 14)),
        ("gt_14_to_30", (df[TARGET] > 14) & (df[TARGET] <= 30)),
        ("gt_30", df[TARGET] > 30),
    ]
    target_bins = {name: {"count": int(mask.sum()), "percent": float(mask.mean() * 100)} for name, mask in bins}

    floor = df[df[TARGET].eq(.5)]
    above = df[df[TARGET].gt(.5)]
    floor_comparison = {
        "floor_count": len(floor), "above_floor_count": len(above),
        "floor_percent": len(floor) / len(df) * 100,
        "numerical_distributions": {
            c: {"equal_0_5": descriptive(floor[c]), "greater_than_0_5": descriptive(above[c])}
            for c in NUMS
        },
        "categorical_distributions": {
            c: {
                "floor_counts_and_within_floor_percent": [
                    {"category": k, "count": int(v), "percent": float(v / len(floor) * 100)}
                    for k, v in floor[c].value_counts().sort_index().items()
                ],
                "above_floor_counts_and_within_above_floor_percent": [
                    {"category": k, "count": int(v), "percent": float(v / len(above) * 100)}
                    for k, v in above[c].value_counts().sort_index().items()
                ],
            }
            for c in CATS
        },
    }

    error = pred - actual
    prediction_range = {
        "min": float(pred.min()), "max": float(pred.max()),
        "below_0": int((pred < 0).sum()),
        "below_0_5": int((pred < .5).sum()),
        "between_0_and_0_5_inclusive_zero_exclusive_half": int(((pred >= 0) & (pred < .5)).sum()),
        "at_least_0_5": int((pred >= .5).sum()),
    }
    prediction_range["percentages"] = {
        "below_0": prediction_range["below_0"] / len(pred) * 100,
        "below_0_5": prediction_range["below_0_5"] / len(pred) * 100,
        "between_0_and_0_5_inclusive_zero_exclusive_half": prediction_range["between_0_and_0_5_inclusive_zero_exclusive_half"] / len(pred) * 100,
        "at_least_0_5": prediction_range["at_least_0_5"] / len(pred) * 100,
    }

    test_perf = test.copy()
    test_perf["_actual"] = actual
    test_perf["_pred"] = pred
    perf_ranges = [
        ("target_le_0_5", test_perf._actual <= .5),
        ("gt_0_5_to_2", (test_perf._actual > .5) & (test_perf._actual <= 2)),
        ("gt_2_to_5", (test_perf._actual > 2) & (test_perf._actual <= 5)),
        ("gt_5_to_10", (test_perf._actual > 5) & (test_perf._actual <= 10)),
        ("gt_10_to_20", (test_perf._actual > 10) & (test_perf._actual <= 20)),
        ("gt_20_to_40", (test_perf._actual > 20) & (test_perf._actual <= 40)),
        ("gt_40", test_perf._actual > 40),
    ]
    performance_by_range = []
    for name, mask in perf_ranges:
        subset = test_perf.loc[mask]
        group_metrics = reg_metrics(subset._actual, subset._pred) if len(subset) else {"count": 0, "mae": None, "rmse": None, "r2": None, "mean_actual": None, "mean_predicted": None, "mean_signed_error_pred_minus_actual": None}
        performance_by_range.append({"target_range": name, **group_metrics})

    performance_by_produce = performance_table(test, actual, pred, "produce_type")
    performance_by_storage = performance_table(test, actual, pred, "storage_type")

    correlations = {}
    for c in NUMS:
        correlations[c] = {
            "pearson": float(df[c].corr(df[TARGET], method="pearson")),
            "spearman": float(df[c].corr(df[TARGET], method="spearman")),
        }
    categorical_targets = {c: category_table(df, c) for c in CATS}

    duplicate_groups = df.groupby(FEATURES, dropna=False, sort=False)[TARGET].agg(["size", "nunique", "min", "max"])
    dup_groups = duplicate_groups[duplicate_groups["size"] > 1]
    dup_input_rows = int(df.duplicated(FEATURES, keep="first").sum())
    same_target_dup_groups = int((dup_groups["nunique"] == 1).sum())
    different_target_dup_groups = int((dup_groups["nunique"] > 1).sum())
    duplicate_analysis = {
        "total_rows": len(df), "unique_predictor_combinations": int(len(duplicate_groups)),
        "duplicated_predictor_combinations": int(len(dup_groups)),
        "rows_beyond_first_in_duplicated_combinations": dup_input_rows,
        "identical_input_groups_always_same_target": same_target_dup_groups,
        "identical_input_groups_with_different_targets": different_target_dup_groups,
        "max_repetitions_for_one_input_combination": int(duplicate_groups["size"].max()),
        "exact_duplicate_full_rows": int(df.duplicated().sum()),
        "largest_repeated_input_groups": [
            {"input_group_size": int(row["size"]), "target_unique_values": int(row["nunique"]), "target_min": float(row["min"]), "target_max": float(row["max"])}
            for _, row in dup_groups.sort_values("size", ascending=False).head(10).iterrows()
        ],
    }
    target_precision = {
        "unique_target_count": int(df[TARGET].nunique()),
        "decimal_digit_count_frequency": {str(k): int(v) for k, v in df[TARGET].astype(str).str.split(".").str[-1].str.len().value_counts().sort_index().items()},
        "most_common_targets": [{"target": float(k), "count": int(v)} for k, v in df[TARGET].value_counts().head(15).items()],
    }
    numerical_ranges = {c: {"min": float(df[c].min()), "max": float(df[c].max()), "mean": float(df[c].mean()), "unique": int(df[c].nunique())} for c in NUMS}
    audit = {
        "dataset": {"path_relative": DATA.name, "rows": len(df), "columns": df.columns.tolist(), "sha256": cfg["dataset_sha256"], "target_summary": descriptive(df[TARGET]), "target_bins": target_bins, "numerical_feature_ranges": numerical_ranges, "target_precision_and_frequency": target_precision},
        "artifact_verification": {"dataset_hash_matches_config": True, "saved_test_metrics_recomputed": calculated_overall, "saved_test_metrics": saved_metrics["overall"], "test_rows": len(test), "model_boosting_rounds": booster_rounds, "config_n_estimators": cfg["hyperparameters"]["n_estimators"], "model_transformed_feature_count": booster_features, "manifest_transformed_feature_count": len(manifest["transformed_feature_names"]), "xgboost_version": xgboost.__version__, "scikit_learn_version": sklearn.__version__, "saved_config_versions": {"python": cfg["python_version"], "xgboost": cfg["xgboost_version"]}, "validation_selected_parameters": cfg["hyperparameters"]},
        "floor_analysis": floor_comparison,
        "test_prediction_range": prediction_range,
        "test_overall": calculated_overall,
        "performance_by_target_range": performance_by_range,
        "performance_by_produce_type": performance_by_produce,
        "performance_by_storage_type": performance_by_storage,
        "numeric_feature_target_correlations": correlations,
        "categorical_target_distributions": categorical_targets,
        "duplicate_input_analysis": duplicate_analysis,
        "synthetic_pattern_checks": {
            "target_decimal_precision": target_precision,
            "predictor_combination_uniqueness": duplicate_analysis,
            "produce_storage_combination_count": int(df.groupby(CATS, observed=True).ngroups),
            "produce_storage_groups": int(df["produce_type"].nunique() * df["storage_type"].nunique()),
            "floor_share_percent": float(df[TARGET].eq(.5).mean() * 100),
            "provenance_status": "Undocumented; this file alone cannot establish whether labels were measured or algorithmically generated.",
        },
    }
    (HERE / "audit_metrics.json").write_text(json.dumps(py(audit), indent=2), encoding="utf-8")
    write_report(audit)


def write_report(a):
    ds = a["dataset"]
    f = a["floor_analysis"]
    pa = a["test_prediction_range"]
    dup = a["duplicate_input_analysis"]
    def lines_table(rows, headers):
        return "\n".join(["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"] + ["| " + " | ".join(str(r.get(h, "")) for h in headers) + " |" for r in rows])

    bin_labels = {"exactly_0_5": "0.5 day", "gt_0_5_to_1": ">0.5 to 1 day", "gt_1_to_2": ">1 to 2 days", "gt_2_to_3": ">2 to 3 days", "gt_3_to_5": ">3 to 5 days", "gt_5_to_7": ">5 to 7 days", "gt_7_to_14": ">7 to 14 days", "gt_14_to_30": ">14 to 30 days", "gt_30": ">30 days"}
    bintable = [{"Range": bin_labels[k], "Count": v["count"], "Percent": f"{v['percent']:.3f}%"} for k, v in ds["target_bins"].items()]
    rangetable = []
    for r in a["performance_by_target_range"]:
        rangetable.append({"Target range": r["target_range"], "n": r["count"], "MAE": "—" if r["mae"] is None else f"{r['mae']:.3f}", "RMSE": "—" if r["rmse"] is None else f"{r['rmse']:.3f}", "R²": "—" if r["r2"] is None else f"{r['r2']:.3f}", "Mean actual": "—" if r["mean_actual"] is None else f"{r['mean_actual']:.3f}", "Mean predicted": "—" if r["mean_predicted"] is None else f"{r['mean_predicted']:.3f}", "Mean signed error": "—" if r["mean_signed_error_pred_minus_actual"] is None else f"{r['mean_signed_error_pred_minus_actual']:.3f}"})
    prows = [{"Produce": r["category"], "n": r["count"], "MAE": f"{r['mae']:.3f}", "RMSE": f"{r['rmse']:.3f}", "R²": "—" if r["r2"] is None else f"{r['r2']:.3f}", "Mean actual": f"{r['mean_actual']:.3f}", "Mean predicted": f"{r['mean_predicted']:.3f}"} for r in a["performance_by_produce_type"]]
    srows = [{"Storage": r["category"], "n": r["count"], "MAE": f"{r['mae']:.3f}", "RMSE": f"{r['rmse']:.3f}", "R²": "—" if r["r2"] is None else f"{r['r2']:.3f}", "Mean actual": f"{r['mean_actual']:.3f}", "Mean predicted": f"{r['mean_predicted']:.3f}"} for r in a["performance_by_storage_type"]]
    corrows = [{"Feature": k, "Pearson": f"{v['pearson']:.4f}", "Spearman": f"{v['spearman']:.4f}"} for k, v in a["numeric_feature_target_correlations"].items()]
    category_lines = []
    for col, cats in a["categorical_target_distributions"].items():
        category_lines.append(f"### `{col}`\n\n" + lines_table([{"Category": x["category"], "n": x["count"], "Mean target": f"{x['target']['mean']:.3f}", "Median": f"{x['target']['median']:.3f}", "Min": f"{x['target']['min']:.3f}", "Max": f"{x['target']['max']:.3f}"} for x in cats], ["Category", "n", "Mean target", "Median", "Min", "Max"]))
    floor_cats = []
    for col, block in f["categorical_distributions"].items():
        floor_cats.append(f"### `{col}`\n\nFloor rows:\n\n" + lines_table([{"Category": x["category"], "Count": x["count"], "Share within floor": f"{x['percent']:.2f}%"} for x in block["floor_counts_and_within_floor_percent"]], ["Category", "Count", "Share within floor"]) + "\n\nAbove-floor rows:\n\n" + lines_table([{"Category": x["category"], "Count": x["count"], "Share above floor": f"{x['percent']:.2f}%"} for x in block["above_floor_counts_and_within_above_floor_percent"]], ["Category", "Count", "Share above floor"]))
    numfloorrows = [{"Feature": c, "Floor distribution": f"{v['equal_0_5']['count']}; {v['equal_0_5']['mean']:.3f}; {v['equal_0_5']['std_sample']:.3f}; {v['equal_0_5']['q1']:.3f}; {v['equal_0_5']['median']:.3f}; {v['equal_0_5']['q3']:.3f}; {v['equal_0_5']['min']:.3f}–{v['equal_0_5']['max']:.3f}", "Above-floor distribution": f"{v['greater_than_0_5']['count']}; {v['greater_than_0_5']['mean']:.3f}; {v['greater_than_0_5']['std_sample']:.3f}; {v['greater_than_0_5']['q1']:.3f}; {v['greater_than_0_5']['median']:.3f}; {v['greater_than_0_5']['q3']:.3f}; {v['greater_than_0_5']['min']:.3f}–{v['greater_than_0_5']['max']:.3f}"} for c, v in f["numerical_distributions"].items()]
    overall = a["test_overall"]
    report = f"""# Shelf-Life XGBoost v1 Model Audit

## Executive Summary

The saved model and preprocessor load and reproduce the recorded held-out test metrics when the training split is reconstructed. The model has {a['artifact_verification']['model_boosting_rounds']} boosting rounds and {a['artifact_verification']['model_transformed_feature_count']} transformed inputs, matching the training config and feature manifest. It is technically functional as a development artifact, but is not production-ready. Dataset provenance and label validity remain undocumented. The 0.5-day group is distinguishable from the rest by input distributions, but the available table does not establish why those labels equal 0.5; the reason is **Undetermined from available data.**

## Dataset Findings

The audited CSV has {ds['rows']:,} rows, {len(ds['columns'])} columns and SHA-256 `{ds['sha256']}`. Target summary: count {ds['target_summary']['count']:,}, min {ds['target_summary']['min']:.2f}, max {ds['target_summary']['max']:.2f}, mean {ds['target_summary']['mean']:.4f}, median {ds['target_summary']['median']:.2f}, sample standard deviation {ds['target_summary']['std_sample']:.4f}, Q1 {ds['target_summary']['q1']:.2f}, Q3 {ds['target_summary']['q3']:.2f}.

The bins below are descriptive error-analysis bands, not scientific categories.

{lines_table(bintable, ['Range', 'Count', 'Percent'])}

## 0.5-Day Floor Analysis

There are {f['floor_count']:,} floor rows ({f['floor_percent']:.3f}%) and {f['above_floor_count']:,} rows above the floor. Input distributions differ; for example, floor rows have mean temperature {f['numerical_distributions']['temperature_c']['equal_0_5']['mean']:.3f}°C versus {f['numerical_distributions']['temperature_c']['greater_than_0_5']['mean']:.3f}°C above the floor, and mean defect probability {f['numerical_distributions']['defect_probability']['equal_0_5']['mean']:.4f} versus {f['numerical_distributions']['defect_probability']['greater_than_0_5']['mean']:.4f}. These associations do not establish a labeling mechanism.

Classification: **Undetermined from available data.** The exact repeated value is compatible with a floor, category, or generated rule, but the dataset contains no documentation or independent observations that identify which explanation is correct.

### Numerical input distributions

Each numeric group cell lists count; mean; sample SD; Q1; median; Q3; min–max.

{lines_table(numfloorrows, ['Feature', 'Floor distribution', 'Above-floor distribution'])}

{chr(10).join(floor_cats)}

## Prediction Range Analysis

The untouched test prediction range was {pa['min']:.4f} to {pa['max']:.4f} days. Below zero: {pa['below_0']:,} ({pa['percentages']['below_0']:.3f}%); below 0.5: {pa['below_0_5']:,} ({pa['percentages']['below_0_5']:.3f}%); from 0 inclusive to below 0.5: {pa['between_0_and_0_5_inclusive_zero_exclusive_half']:,} ({pa['percentages']['between_0_and_0_5_inclusive_zero_exclusive_half']:.3f}%); at least 0.5: {pa['at_least_0_5']:,} ({pa['percentages']['at_least_0_5']:.3f}%). Categories overlap as stated: the below-zero count is included in below-0.5.

## Performance by Shelf-Life Range

{lines_table(rangetable, ['Target range', 'n', 'MAE', 'RMSE', 'R²', 'Mean actual', 'Mean predicted', 'Mean signed error'])}

R² is omitted when a group has insufficient observations or no target variation.

## Performance by Produce Type

{lines_table(prows, ['Produce', 'n', 'MAE', 'RMSE', 'R²', 'Mean actual', 'Mean predicted'])}

## Performance by Storage Type

{lines_table(srows, ['Storage', 'n', 'MAE', 'RMSE', 'R²', 'Mean actual', 'Mean predicted'])}

## Feature/Target Analysis

Numerical-feature correlations on the full dataset:

{lines_table(corrows, ['Feature', 'Pearson', 'Spearman'])}

These are associations only; they do not show causality. Categorical target summaries follow.

{chr(10).join(category_lines)}

## Potential Leakage

No column beyond the specified eight inputs was used for modeling. Repeated-input analysis found {dup['unique_predictor_combinations']:,} unique eight-input combinations from {dup['total_rows']:,} rows; {dup['duplicated_predictor_combinations']:,} combinations repeat (additional repeated rows: {dup['rows_beyond_first_in_duplicated_combinations']:,}). Repeated groups with one target value: {dup['identical_input_groups_always_same_target']:,}; groups with different targets: {dup['identical_input_groups_with_different_targets']:,}. Exact full-row duplicates: {dup['exact_duplicate_full_rows']:,}. Since every input vector occurs only once, this dataset cannot directly test whether repeated identical vectors map to repeated or differing targets. No direct target column was among the predictors. Strong associations and prior formula-like findings raise a potential generation/leakage concern, but do not prove leakage.

## Potential Synthetic-Data Indicators

    The source provenance is undocumented. The target has {a['synthetic_pattern_checks']['target_decimal_precision']['unique_target_count']:,} unique values; decimal-digit counts are `{json.dumps(a['synthetic_pattern_checks']['target_decimal_precision']['decimal_digit_count_frequency'])}`. There are {a['synthetic_pattern_checks']['produce_storage_combination_count']} observed produce/storage pairs out of {a['synthetic_pattern_checks']['produce_storage_groups']} possible pairs, and exactly 8,634 labels equal 0.5. Prior exploratory work in this project found strong model fit and formula-like structure, while the current audit confirms labels are highly repeated at the floor and rounded to limited decimal precision. Those patterns are consistent with algorithmic generation but are not proof. **No definitive conclusion can be made from the available dataset.**

## Generalization Limitations

The 70/15/15 shuffled row split may overestimate generalization if records share an unobserved specimen, batch, source, or common generation rule. This dataset has no specimen/group identifier available to enforce group isolation. Random test performance therefore describes interpolation within this file, not performance on new harvests, studies, suppliers, or real-world storage conditions. No retraining or official metric change was made during this audit.

## Negative Prediction Issue

The model is an unconstrained regressor and predicts negative days for {pa['below_0']:,} test rows. Negative remaining shelf life is outside the plausible nonnegative target domain and should be addressed in a future model-development step. This audit did not clamp predictions or change any model artifact.

## Overall Technical Assessment

Artifact integrity check: recomputed test MAE {overall['mae']:.4f}, RMSE {overall['rmse']:.4f}, R² {overall['r2']:.4f}; the values match the saved metrics within numeric tolerance. The development model loads and runs. However, the unknown target provenance, prominent exact 0.5-day mass, limited label precision, and random row split prevent treating these metrics as evidence of real-world validity. The floor mechanism is **Undetermined from available data**; synthetic generation is plausible but unproven; direct target leakage is not demonstrated, while dataset-generation structure remains a potential concern.
"""
    (HERE / "model_audit.md").write_text(report, encoding="utf-8")


if __name__ == "__main__":
    main()
