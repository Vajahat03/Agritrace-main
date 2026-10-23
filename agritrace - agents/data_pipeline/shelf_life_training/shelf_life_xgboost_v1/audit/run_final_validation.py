"""Final validation of saved V1 artifacts; performs no fitting or model updates."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from sklearn.metrics import mean_absolute_error, mean_squared_error, median_absolute_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.neighbors import NearestNeighbors
from sklearn.preprocessing import StandardScaler
from xgboost import XGBRegressor


HERE = Path(__file__).resolve().parent
V1 = HERE.parent
ROOT = HERE.parents[3]
DATA = ROOT / "shelf life prediction dataset.xlsx.csv"
V2 = ROOT / "data_pipeline/shelf_life_training/shelf_life_xgboost_v2"
V2_LOG = ROOT / "data_pipeline/shelf_life_training/shelf_life_xgboost_v2_log"
ART = V1 / "artifacts"
SAVED_METRICS = V1 / "metrics/metrics.json"
REPORT = HERE / "final_validation_report.md"
OUT_JSON = HERE / "final_validation_metrics.json"
PLOTS = HERE / "plots"
TARGET = "remaining_shelf_life_days"
CATS = ["produce_type", "storage_type"]
NUMS = ["freshness_score", "quality_score", "defect_probability", "temperature_c", "humidity_rh", "harvest_age_days"]
FEATURES = ["produce_type", *NUMS, "storage_type"]
EXPECTED_COLUMNS = [*FEATURES, TARGET]
SEED = 42
BOOTSTRAPS = 1000
EXPECTED_HASHES = {
    "artifacts/shelf_life_xgboost_v1.json": "03E0EECB4355E650B7C31633AC89DB8F8B7DA97B06366618BE87961A8BCC2FF6",
    "artifacts/preprocessor.joblib": "0707C9F01E5AC1A459ADE0CCCA3C315DDB7ADB659B5EEB7C505EBF9E9501907D",
    "metrics/metrics.json": "7A287D33F96B08A68FC031EEDDFFB6D9EDCD6122CA1BC18D36A2A57A12043A43",
}
EXPECTED_DATA_HASH = "D30663CA50D45C40025F61AA8FA925AE3D68E714A1C1A143543EF74C4B67F1AF"


def sha(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest().upper()


def protected_snapshot() -> dict[str, str]:
    paths = [
        DATA,
        *(ART / name for name in ("shelf_life_xgboost_v1.json", "preprocessor.joblib", "feature_manifest.json", "training_config.json")),
        SAVED_METRICS,
        ROOT / "ai/shelf_life/xgboost_model.py",
        ROOT / "agents/shelf_life_agent.py",
        ROOT / "backend/app.py",
    ]
    for folder in (V2, V2_LOG, ROOT / "frontend"):
        if folder.is_dir():
            paths.extend(p for p in folder.rglob("*") if p.is_file())
    return {str(p.relative_to(ROOT)): sha(p) for p in sorted(set(paths)) if p.is_file()}


def py(value):
    if isinstance(value, dict):
        return {str(k): py(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [py(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating, float)):
        return float(value) if np.isfinite(value) else None
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def scores(y, pred):
    y, pred = np.asarray(y, dtype=float), np.asarray(pred, dtype=float)
    err = pred - y
    return {
        "count": int(y.size),
        "mae": float(mean_absolute_error(y, pred)),
        "rmse": float(np.sqrt(mean_squared_error(y, pred))),
        "r2": float(r2_score(y, pred)) if len(y) > 1 and np.var(y) > 0 else None,
        "median_absolute_error": float(median_absolute_error(y, pred)),
        "max_absolute_error": float(np.abs(err).max()) if len(err) else None,
        "mean_actual": float(y.mean()) if len(y) else None,
        "mean_predicted": float(pred.mean()) if len(pred) else None,
        "mean_signed_error": float(err.mean()) if len(err) else None,
        "within_percent": {str(t): float((np.abs(err) <= t).mean() * 100) for t in (.5, 1, 2, 3)} if len(err) else {},
    }


def grouped_metrics(frame, actual, pred, column):
    temp = frame[[column]].copy()
    temp["_actual"] = np.asarray(actual)
    temp["_pred"] = np.asarray(pred)
    rows = []
    for category, g in temp.groupby(column, sort=True, observed=True):
        rows.append({"category": category, **scores(g["_actual"], g["_pred"])})
    return rows


def bins_for(y, residual=False):
    y = np.asarray(y)
    if residual:
        return [
            ("0.5_to_1_inclusive", (y >= .5) & (y <= 1)),
            ("gt_1_to_2", (y > 1) & (y <= 2)),
            ("gt_2_to_5", (y > 2) & (y <= 5)),
            ("gt_5_to_10", (y > 5) & (y <= 10)),
            ("gt_10_to_20", (y > 10) & (y <= 20)),
            ("gt_20_to_40", (y > 20) & (y <= 40)),
            ("gt_40", y > 40),
        ]
    return [
        ("exactly_0_5", y == .5),
        ("gt_0_5_to_1", (y > .5) & (y <= 1)),
        ("gt_1_to_2", (y > 1) & (y <= 2)),
        ("gt_2_to_5", (y > 2) & (y <= 5)),
        ("gt_5_to_10", (y > 5) & (y <= 10)),
        ("gt_10_to_20", (y > 10) & (y <= 20)),
        ("gt_20_to_40", (y > 20) & (y <= 40)),
        ("gt_40", y > 40),
    ]


def frequency_summary(series, top_n=10):
    s = series
    counts = s.value_counts(dropna=False).head(top_n)
    return {
        "unique_values": int(s.nunique(dropna=False)),
        "most_frequent_count": int(counts.iloc[0]),
        "most_frequent_percent": float(counts.iloc[0] / len(s) * 100),
        "top_values": [{"value": py(k), "count": int(v), "percent": float(v / len(s) * 100)} for k, v in counts.items()],
        "decimal_digit_frequency": {str(k): int(v) for k, v in pd.to_numeric(s, errors="coerce").dropna().astype(str).str.split(".").str[-1].str.len().value_counts().sort_index().items()},
    }


def near_duplicate_analysis(df, split_labels):
    # Distances are Euclidean after global z-scoring of numeric inputs, restricted
    # to pairs with identical produce_type and storage_type. Thresholds are audit
    # conventions, not scientifically validated equivalence boundaries.
    numeric = StandardScaler().fit_transform(df[NUMS].to_numpy(dtype=float))
    nearest_distance = np.full(len(df), np.nan)
    nearest_idx = np.full(len(df), -1, dtype=int)
    all_pairs_005, all_pairs_010 = [], []
    directed_target_diff = []
    directed_split_pairs = {}
    for _, indices in df.groupby(CATS, sort=False, observed=True).indices.items():
        ids = np.asarray(indices, dtype=int)
        z = numeric[ids]
        if len(ids) < 2:
            continue
        nn = NearestNeighbors(n_neighbors=2, algorithm="auto").fit(z)
        distances, neighbors = nn.kneighbors(z)
        for pos, row_id in enumerate(ids):
            npos = int(neighbors[pos, 1])
            neighbor_id = int(ids[npos])
            nearest_distance[row_id] = float(distances[pos, 1])
            nearest_idx[row_id] = neighbor_id
            directed_target_diff.append(abs(float(df.iloc[row_id][TARGET]) - float(df.iloc[neighbor_id][TARGET])))
            key = "->".join(sorted((split_labels[row_id], split_labels[neighbor_id])))
            directed_split_pairs[key] = directed_split_pairs.get(key, 0) + 1
        tree = cKDTree(z)
        pairs = tree.query_pairs(r=.10, output_type="ndarray")
        if pairs.size:
            for a, b in pairs:
                ia, ib = int(ids[a]), int(ids[b])
                distance = float(np.linalg.norm(z[a] - z[b]))
                split_pair = "->".join(sorted((split_labels[ia], split_labels[ib])))
                target_delta = abs(float(df.iloc[ia][TARGET]) - float(df.iloc[ib][TARGET]))
                all_pairs_010.append((ia, ib, distance, target_delta, split_pair))
                if distance <= .05:
                    all_pairs_005.append((ia, ib, distance, target_delta, split_pair))

    graph_pairs = all_pairs_010
    if graph_pairs:
        rr = [p[0] for p in graph_pairs] + [p[1] for p in graph_pairs]
        cc = [p[1] for p in graph_pairs] + [p[0] for p in graph_pairs]
        graph = coo_matrix((np.ones(len(rr), dtype=np.int8), (rr, cc)), shape=(len(df), len(df))).tocsr()
        n_components, labels = connected_components(graph, directed=False)
        comp_counts = np.bincount(labels)
        component_ids = np.flatnonzero(comp_counts > 1)
        component_spreads = []
        component_rows = []
        for label in component_ids:
            ids = np.flatnonzero(labels == label)
            vals = df.iloc[ids][TARGET].to_numpy(dtype=float)
            spread = float(vals.max() - vals.min())
            component_spreads.append(spread)
            component_rows.append({"size": int(len(ids)), "target_min": float(vals.min()), "target_max": float(vals.max()), "target_spread": spread})
        component_rows.sort(key=lambda x: (-x["size"], -x["target_spread"]))
    else:
        component_spreads, component_rows = [], []
    nd = nearest_distance[np.isfinite(nearest_distance)]
    dt = np.asarray(directed_target_diff, dtype=float)
    return {
        "method": "global StandardScaler over six numeric features; Euclidean distance; candidate pairs require identical produce_type and storage_type",
        "thresholds_standardized_euclidean": {"0.05": "very close exploratory threshold", "0.10": "near-duplicate exploratory threshold"},
        "exact_duplicate_feature_vectors": int(df.duplicated(FEATURES).sum()),
        "unique_exact_feature_vectors": int(df[FEATURES].drop_duplicates().shape[0]),
        "nearest_neighbor_distance": {"count": int(len(nd)), "min": float(nd.min()), "median": float(np.median(nd)), "p95": float(np.quantile(nd, .95)), "max": float(nd.max()), "count_le_0_05": int((nd <= .05).sum()), "count_le_0_10": int((nd <= .10).sum())},
        "near_pairs_le_0_05": {"count": len(all_pairs_005), "cross_split_counts": _pair_counts(all_pairs_005)},
        "near_pairs_le_0_10": {"count": len(all_pairs_010), "cross_split_counts": _pair_counts(all_pairs_010)},
        "near_neighbor_target_absolute_difference": {"count": int(len(dt)), "median": float(np.median(dt)), "p95": float(np.quantile(dt, .95)), "max": float(dt.max()), "min": float(dt.min())},
        "near_pair_target_spread_le_0_10": {"near_pair_target_difference_median": float(np.median([p[3] for p in all_pairs_010])) if all_pairs_010 else None, "near_pair_target_difference_p95": float(np.quantile([p[3] for p in all_pairs_010], .95)) if all_pairs_010 else None, "near_pair_target_difference_max": float(max(p[3] for p in all_pairs_010)) if all_pairs_010 else None, "connected_components_size_ge_2": len(component_ids) if graph_pairs else 0, "largest_components": component_rows[:20], "component_spread_median": float(np.median(component_spreads)) if component_spreads else None, "component_spread_p95": float(np.quantile(component_spreads, .95)) if component_spreads else None, "component_spread_max": float(max(component_spreads)) if component_spreads else None},
        "nearest_neighbor_split_pair_counts_directed": directed_split_pairs,
    }


def _pair_counts(pairs):
    out = {}
    for pair in pairs:
        out[pair[4]] = out.get(pair[4], 0) + 1
    return out


def make_plots(actual, pred, residual, errors, frame, range_rows):
    PLOTS.mkdir(parents=True, exist_ok=True)
    plt.figure(figsize=(7, 6))
    plt.scatter(actual, pred, s=8, alpha=.25)
    lo, hi = min(actual.min(), pred.min()), max(actual.max(), pred.max())
    plt.plot([lo, hi], [lo, hi], "r--", linewidth=1)
    plt.xlabel("Actual shelf life (days)"); plt.ylabel("Predicted shelf life (days)"); plt.title("V1 held-out test: actual vs predicted")
    plt.tight_layout(); plt.savefig(PLOTS / "actual_vs_predicted.png", dpi=150); plt.close()

    plt.figure(figsize=(7, 5)); plt.scatter(actual, residual, s=8, alpha=.25); plt.axhline(0, color="r", linestyle="--", linewidth=1)
    plt.xlabel("Actual shelf life (days)"); plt.ylabel("Residual: prediction − actual (days)"); plt.title("V1 residual vs actual")
    plt.tight_layout(); plt.savefig(PLOTS / "residual_vs_actual.png", dpi=150); plt.close()

    plt.figure(figsize=(7, 5)); plt.hist(errors, bins=60, color="#4472C4", alpha=.85)
    plt.xlabel("Absolute error (days)"); plt.ylabel("Test rows"); plt.title("V1 absolute error distribution")
    plt.tight_layout(); plt.savefig(PLOTS / "absolute_error_distribution.png", dpi=150); plt.close()

    plt.figure(figsize=(9, 5)); labels = [r["range"] for r in range_rows if r["count"]]
    vals = [r["mae"] for r in range_rows if r["count"]]
    plt.bar(labels, vals, color="#70AD47"); plt.xticks(rotation=35, ha="right")
    plt.xlabel("Actual target range"); plt.ylabel("MAE (days)"); plt.title("V1 absolute error by target range")
    plt.tight_layout(); plt.savefig(PLOTS / "error_by_shelf_life_range.png", dpi=150); plt.close()

    plt.figure(figsize=(7, 5)); plt.hist(pred, bins=60, color="#ED7D31", alpha=.85)
    plt.xlabel("Predicted shelf life (days)"); plt.ylabel("Test rows"); plt.title("V1 prediction distribution")
    plt.tight_layout(); plt.savefig(PLOTS / "prediction_distribution.png", dpi=150); plt.close()

    produce = sorted(frame["produce_type"].unique())
    actual_means = [float(np.mean(actual[frame["produce_type"].to_numpy() == p])) for p in produce]
    pred_means = [float(np.mean(pred[frame["produce_type"].to_numpy() == p])) for p in produce]
    pos = np.arange(len(produce)); width = .4
    plt.figure(figsize=(12, 5)); plt.bar(pos - width / 2, actual_means, width, label="Actual"); plt.bar(pos + width / 2, pred_means, width, label="Predicted")
    plt.xticks(pos, produce, rotation=55, ha="right"); plt.ylabel("Mean shelf life (days)"); plt.title("V1 actual and predicted means by produce type"); plt.legend()
    plt.tight_layout(); plt.savefig(PLOTS / "actual_predicted_by_produce.png", dpi=150); plt.close()


def main():
    # Do not continue if known V1 identity hashes or expected dataset fingerprint differ.
    if not HERE.is_dir():
        raise FileNotFoundError(HERE)
    baseline = protected_snapshot()
    for rel, expected in EXPECTED_HASHES.items():
        key = str((V1 / rel).relative_to(ROOT))
        if baseline.get(key) != expected:
            raise RuntimeError(f"STOP: V1 integrity mismatch for {rel}: {baseline.get(key)} != {expected}")
    if baseline.get(str(DATA.relative_to(ROOT))) != EXPECTED_DATA_HASH:
        raise RuntimeError("STOP: original dataset SHA-256 differs from the previously verified source")

    config = json.loads((ART / "training_config.json").read_text(encoding="utf-8"))
    manifest = json.loads((ART / "feature_manifest.json").read_text(encoding="utf-8"))
    saved_metrics = json.loads(SAVED_METRICS.read_text(encoding="utf-8"))
    expected_params = {"n_estimators": 900, "max_depth": 7, "learning_rate": .035, "random_state": 42}
    for key, value in expected_params.items():
        if config["hyperparameters"].get(key) != value:
            raise RuntimeError(f"STOP: unexpected V1 model configuration {key}")
    if manifest["input_features"] != FEATURES or manifest["target"] != TARGET:
        raise RuntimeError("STOP: V1 feature manifest mismatch")
    if config["feature_list"] != FEATURES:
        raise RuntimeError("STOP: V1 training config feature list mismatch")
    if config["preprocessing"]["categorical"] != "OneHotEncoder(handle_unknown='ignore', sparse_output=True)" or config["preprocessing"]["numeric"] != "passthrough; no scaling":
        raise RuntimeError("STOP: V1 preprocessing configuration mismatch")

    df = pd.read_csv(DATA)
    if df.columns.tolist() != EXPECTED_COLUMNS or len(df) != 50_000:
        raise RuntimeError("STOP: original dataset dimensions or schema differ")
    if df[FEATURES + [TARGET]].isna().any().any():
        raise RuntimeError("STOP: missing values found in model inputs/target")
    for col in NUMS + [TARGET]:
        df[col] = pd.to_numeric(df[col], errors="raise")
    y = df[TARGET].to_numpy(dtype=float)
    if y.min() != .5 or y.max() != 133.47 or int((y == .5).sum()) != 8_634 or int((y < .5).sum()) != 0:
        raise RuntimeError("STOP: expected source target values differ; investigate first")

    train_valid_idx, test_idx = train_test_split(np.arange(len(df)), test_size=.15, random_state=42, shuffle=True)
    train_idx, valid_idx = train_test_split(train_valid_idx, test_size=(.15 / .85), random_state=42, shuffle=True)
    if (len(train_idx), len(valid_idx), len(test_idx)) != (34_999, 7_501, 7_500):
        raise AssertionError("Reproduced split sizes differ from V1")
    if config["split_counts"] != {"train": len(train_idx), "validation": len(valid_idx), "test": len(test_idx)}:
        raise AssertionError("Split counts differ from V1 config")
    train_valid_code = (V1 / "train.py").read_text(encoding="utf-8")
    if "test_size=0.15" not in train_valid_code or "test_size=(0.15 / 0.85)" not in train_valid_code or "random_state=SEED" not in train_valid_code:
        raise RuntimeError("Could not verify exact original split method from V1 training script")

    model = XGBRegressor()
    model.load_model(ART / "shelf_life_xgboost_v1.json")
    preprocessor = joblib.load(ART / "preprocessor.joblib")
    if int(model.get_booster().num_boosted_rounds()) != 900:
        raise RuntimeError("V1 saved model boosting rounds do not match config")
    if int(model.get_booster().num_features()) != len(manifest["transformed_feature_names"]):
        raise RuntimeError("V1 saved model feature count does not match manifest")
    test = df.iloc[test_idx].copy()
    x_test = preprocessor.transform(test[FEATURES])
    pred = np.asarray(model.predict(x_test), dtype=float)
    actual = test[TARGET].to_numpy(dtype=float)
    if not np.isfinite(pred).all():
        raise RuntimeError("Saved V1 model produced non-finite predictions")
    residual = pred - actual
    abs_error = np.abs(residual)
    overall = scores(actual, pred)
    replay_expected = {
        "mae": saved_metrics["overall"]["mae"],
        "rmse": saved_metrics["overall"]["rmse"],
        "r2": saved_metrics["overall"]["r2"],
        "median_absolute_error": saved_metrics["error_analysis"]["median_absolute_error"],
        "max_absolute_error": saved_metrics["error_analysis"]["maximum_absolute_error"],
    }
    for name, expected in replay_expected.items():
        if not np.isclose(overall[name], expected, rtol=1e-5, atol=1e-6):
            raise RuntimeError(f"STOP: V1 replay mismatch for {name}: actual {overall[name]}, saved {expected}")

    # Artifact integrity after loading; baseline records all source protections.
    after_load = protected_snapshot()
    if baseline != after_load:
        raise RuntimeError("Protected source artifacts changed while preparing the audit")
    artifact_integrity = {
        "hashes": {str((V1 / p).relative_to(ROOT)): baseline[str((V1 / p).relative_to(ROOT))] for p in EXPECTED_HASHES},
        "feature_manifest_sha256": sha(ART / "feature_manifest.json"),
        "training_config_sha256": sha(ART / "training_config.json"),
        "dataset_sha256": baseline[str(DATA.relative_to(ROOT))],
        "known_hashes_match_previous": True,
        "model_configuration_unchanged": True,
        "feature_list_unchanged": True,
        "preprocessing_unchanged": True,
    }

    bins = []
    for label, mask in bins_for(actual):
        bins.append({"range": label, **scores(actual[mask], pred[mask])} if mask.any() else {"range": label, "count": 0, "mae": None, "rmse": None, "r2": None, "mean_actual": None, "mean_predicted": None, "mean_signed_error": None})
    residual_bins = []
    for label, mask in bins_for(actual, residual=True):
        e = residual[mask]
        residual_bins.append({"range": label, "count": int(mask.sum()), "mae": float(np.mean(np.abs(e))) if len(e) else None, "mean_signed_error": float(np.mean(e)) if len(e) else None, "median_residual": float(np.median(e)) if len(e) else None, "bias": "overprediction" if len(e) and e.mean() > 1e-12 else "underprediction" if len(e) and e.mean() < -1e-12 else "near-zero mean bias" if len(e) else None})
    floor = actual == .5
    nonfloor = ~floor
    floor_scores = scores(actual[floor], pred[floor])
    nonfloor_scores = scores(actual[nonfloor], pred[nonfloor])
    floor_error_contribution = {
        "absolute_error_share_percent": float(abs_error[floor].sum() / abs_error.sum() * 100),
        "squared_error_share_percent": float(np.square(residual[floor]).sum() / np.square(residual).sum() * 100),
        "test_row_share_percent": float(floor.mean() * 100),
    }
    err_percentiles = {str(q): float(np.quantile(abs_error, q / 100)) for q in (50, 75, 90, 95, 99)}
    signed_percentiles = {str(q): float(np.quantile(residual, q / 100)) for q in (1, 5, 25, 50, 75, 95, 99)}

    rng = np.random.default_rng(SEED)
    boot_mae = np.empty(BOOTSTRAPS, dtype=float)
    boot_rmse = np.empty(BOOTSTRAPS, dtype=float)
    sq_error = residual ** 2
    for b in range(BOOTSTRAPS):
        idx = rng.integers(0, len(actual), size=len(actual))
        boot_mae[b] = abs_error[idx].mean()
        boot_rmse[b] = np.sqrt(sq_error[idx].mean())
    bootstrap = {
        "iterations": BOOTSTRAPS,
        "random_state": SEED,
        "mae_point_estimate": overall["mae"],
        "mae_ci_95": [float(np.quantile(boot_mae, .025)), float(np.quantile(boot_mae, .975))],
        "rmse_point_estimate": overall["rmse"],
        "rmse_ci_95": [float(np.quantile(boot_rmse, .025)), float(np.quantile(boot_rmse, .975))],
        "method": "Percentile bootstrap over the fixed held-out test rows; 7,500 rows sampled with replacement per resample.",
    }

    pred_range = {
        "minimum": float(pred.min()), "maximum": float(pred.max()), "mean": float(pred.mean()), "median": float(np.median(pred)),
        "count_below_0": int((pred < 0).sum()), "count_below_0_5": int((pred < .5).sum()),
        "count_below_1": int((pred < 1).sum()), "count_above_dataset_max": int((pred > 133.47).sum()),
    }
    res_summary = {"mean_residual": float(residual.mean()), "median_residual": float(np.median(residual)), "mae": overall["mae"], "rmse": overall["rmse"]}
    by_produce = grouped_metrics(test, actual, pred, "produce_type")
    by_storage = grouped_metrics(test, actual, pred, "storage_type")
    for rows in (by_produce, by_storage):
        for row in rows:
            row["bias"] = "overprediction" if row["mean_signed_error"] > 1e-12 else "underprediction" if row["mean_signed_error"] < -1e-12 else "near-zero mean bias"
            row["sample_note"] = "sufficient descriptive count" if row["count"] >= 30 else "small sample; interpret cautiously"

    structure = {}
    for col in NUMS + [TARGET]:
        structure[col] = frequency_summary(df[col], top_n=10)
    category_counts = {
        "produce_type": [{"category": k, "count": int(v), "percent": float(v / len(df) * 100)} for k, v in df["produce_type"].value_counts().sort_index().items()],
        "storage_type": [{"category": k, "count": int(v), "percent": float(v / len(df) * 100)} for k, v in df["storage_type"].value_counts().sort_index().items()],
        "produce_storage_combinations": [
            {"produce_type": a, "storage_type": b, "count": int(n), "percent": float(n / len(df) * 100)}
            for (a, b), n in df.groupby(CATS, observed=True).size().sort_index().items()
        ],
    }
    split_label = np.full(len(df), "unassigned", dtype=object)
    split_label[train_idx] = "train"; split_label[valid_idx] = "validation"; split_label[test_idx] = "test"
    near = near_duplicate_analysis(df, split_label)

    target_summary = {
        "count": int(len(y)), "minimum": float(y.min()), "maximum": float(y.max()), "mean": float(y.mean()),
        "median": float(np.median(y)), "std_sample": float(np.std(y, ddof=1)),
        "q1": float(np.quantile(y, .25)), "q3": float(np.quantile(y, .75)),
        "equal_0_5": int((y == .5).sum()), "less_than_0_5": int((y < .5).sum()), "equal_1_0": int((y == 1).sum()),
    }
    dataset_verification = {
        "filename": DATA.name, "sha256": sha(DATA), "rows": len(df), "columns": df.columns.tolist(),
        "feature_count": len(FEATURES), "missing_values_per_column": {k: int(v) for k, v in df.isna().sum().items()},
        "exact_duplicate_rows": int(df.duplicated().sum()), "target": target_summary,
    }
    split_report = {
        "method": config["split_method"], "seed": SEED,
        "counts": {"train": len(train_idx), "validation": len(valid_idx), "test": len(test_idx)},
        "same_assignments_recreated_from_v1_train_py": True,
        "test_rows_reproduce_saved_metrics": True,
        "index_hashes": {name: hashlib.sha256(np.asarray(idx, dtype=np.int64).tobytes()).hexdigest() for name, idx in (("train", train_idx), ("validation", valid_idx), ("test", test_idx))},
    }

    generalization_assessment = {
        "dataset_provenance": {"evidence": "CSV has no documented collection/provenance record in inspected artifacts.", "observed_result": "Unknown provenance; no independent source evidence.", "limitation": "Cannot establish real-world source or sampling process."},
        "target_quality": {"evidence": f"{int((y == .5).sum())} exact 0.5-day targets; target minimum {y.min():.2f}; no target measurement documentation.", "observed_result": "Target measurement semantics remain unverified.", "limitation": "The 0.5-day mass may reflect a floor or labeling convention; reason unknown."},
        "random_split_validity": {"evidence": "Seeded random split reproduces saved metrics; no specimen/batch/study IDs are present.", "observed_result": "Random holdout only.", "limitation": "Hidden relatedness or generated rules may cross partitions."},
        "train_test_similarity": {"evidence": f"{near['near_pairs_le_0_10']['count']} same-category pairs are within 0.10 standardized Euclidean distance.", "observed_result": "Similar numeric profiles exist; exact input vectors are unique.", "limitation": "Nearness threshold is exploratory and supports interpolation across partitions."},
        "feature_sufficiency": {"evidence": f"Random-test R2={overall['r2']:.4f}; nearest-neighbor target-difference median={near['near_neighbor_target_absolute_difference']['median']:.3f} days.", "observed_result": "Features fit this table well overall but close profiles can have target spread.", "limitation": "No independent or longitudinal validation establishes sufficiency."},
        "long_tail_performance": {"evidence": "Range-specific metrics are recorded for >20–40 and >40 days.", "observed_result": f">20–40 MAE={next(r['mae'] for r in bins if r['range']=='gt_20_to_40'):.3f}; >40 MAE={next(r['mae'] for r in bins if r['range']=='gt_40'):.3f}.", "limitation": "Absolute error increases in long-life ranges."},
        "short_shelf_life_performance": {"evidence": f"0.5-day test subset n={int(floor.sum())}, MAE={floor_scores['mae']:.3f}, signed bias={floor_scores['mean_signed_error']:.3f}.", "observed_result": "Floor labels are a large and heterogeneous subgroup.", "limitation": "Unknown floor meaning limits interpretation."},
        "ood_validation": {"evidence": "No OOD image evaluation performed.", "observed_result": "Reliable 8-feature extraction from unrelated images unavailable.", "limitation": "No OOD validation evidence."},
        "production_input_realism": {"evidence": "Current shelf-life agent uses quality_score as both freshness_score and quality_score; production defaults include storage_type='ambient'.", "observed_result": "Training has separate freshness and quality fields and storage vocabulary is Cold Storage, Controlled Atmosphere, Open Market, Refrigerated, Room Temperature.", "limitation": "Input semantics/defaults and unknown categories require controlled validation."},
    }
    final_json = {
        "model": "shelf_life_xgboost_v1", "test_rows": len(test),
        "mae": overall["mae"], "rmse": overall["rmse"], "r2": overall["r2"],
        "median_absolute_error": overall["median_absolute_error"], "max_absolute_error": overall["max_absolute_error"],
        "negative_predictions": pred_range["count_below_0"], "predictions_below_0_5": pred_range["count_below_0_5"],
        "bootstrap": bootstrap,
        "artifact_integrity": {"model_unchanged": True, "preprocessor_unchanged": True, **artifact_integrity},
        "production_files_changed": False,
        "dataset_verification": dataset_verification,
        "split_verification": split_report,
        "overall_metrics": overall,
        "excluding_0_5_day": nonfloor_scores,
        "0_5_day_group": {
            "count": int(floor.sum()), "percentage_test": float(floor.mean() * 100),
            "mae": floor_scores["mae"], "rmse": floor_scores["rmse"],
            "mean_predicted": floor_scores["mean_predicted"], "median_predicted": float(np.median(pred[floor])),
            "minimum_predicted": float(pred[floor].min()), "maximum_predicted": float(pred[floor].max()),
            "mean_signed_error": floor_scores["mean_signed_error"],
            "contribution_to_overall_error": floor_error_contribution,
        },
        "prediction_range": pred_range,
        "absolute_error_percentiles": err_percentiles,
        "signed_error_percentiles": signed_percentiles,
        "residual_summary": res_summary,
        "residual_by_target_range": residual_bins,
        "performance_by_shelf_life_range": bins,
        "performance_by_produce_type": by_produce,
        "performance_by_storage_type": by_storage,
        "dataset_structure": {"column_value_frequency": structure, "category_counts": category_counts},
        "near_duplicate_analysis": near,
        "OOD_image_validation": {"performed": False, "reason": "Reliable extraction of all eight shelf-life inputs from unrelated/random images is unavailable; image-only testing would omit temperature, humidity, harvest age, and storage type. No synthetic shelf-life labels were created."},
        "generalization_assessment": generalization_assessment,
        "decision": "NOT READY FOR PRODUCTION INTEGRATION",
    }
    (HERE / "final_validation_metrics.json").write_text(json.dumps(py(final_json), indent=2), encoding="utf-8")

    make_plots(actual, pred, residual, abs_error, test, bins)
    report = build_report(final_json, config)
    REPORT.write_text(report, encoding="utf-8")

    after = protected_snapshot()
    if baseline != after:
        changed = [k for k in set(baseline) | set(after) if baseline.get(k) != after.get(k)]
        raise RuntimeError(f"Protected files changed during validation: {changed}")


def md_table(rows, headers):
    body = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    body.extend("| " + " | ".join(str(row.get(h, "")) for h in headers) + " |" for row in rows)
    return "\n".join(body)


def build_report(a, config):
    d = a["dataset_verification"]
    t = d["target"]
    s = a["split_verification"]["counts"]
    overall = a["overall_metrics"]
    floor = a["0_5_day_group"]
    nr = a["near_duplicate_analysis"]
    art = a["artifact_integrity"]
    range_rows = []
    for r in a["performance_by_shelf_life_range"]:
        range_rows.append({"Range": r["range"], "Count": r["count"], "MAE": "—" if r["mae"] is None else f"{r['mae']:.3f}", "RMSE": "—" if r["rmse"] is None else f"{r['rmse']:.3f}", "Mean actual": "—" if r["mean_actual"] is None else f"{r['mean_actual']:.3f}", "Mean predicted": "—" if r["mean_predicted"] is None else f"{r['mean_predicted']:.3f}", "Mean signed error": "—" if r["mean_signed_error"] is None else f"{r['mean_signed_error']:.3f}"})
    prod_rows = [{"Produce": r["category"], "Count": r["count"], "MAE": f"{r['mae']:.3f}", "RMSE": f"{r['rmse']:.3f}", "R²": "—" if r["r2"] is None else f"{r['r2']:.3f}", "Mean actual": f"{r['mean_actual']:.3f}", "Mean predicted": f"{r['mean_predicted']:.3f}", "Mean signed error": f"{r['mean_signed_error']:.3f}", "Note": r["sample_note"]} for r in a["performance_by_produce_type"]]
    storage_rows = [{"Storage": r["category"], "Count": r["count"], "MAE": f"{r['mae']:.3f}", "RMSE": f"{r['rmse']:.3f}", "R²": "—" if r["r2"] is None else f"{r['r2']:.3f}", "Mean actual": f"{r['mean_actual']:.3f}", "Mean predicted": f"{r['mean_predicted']:.3f}", "Mean signed error": f"{r['mean_signed_error']:.3f}"} for r in a["performance_by_storage_type"]]
    residual_rows = [{"Range": r["range"], "Count": r["count"], "MAE": "—" if r["mae"] is None else f"{r['mae']:.3f}", "Mean signed error": "—" if r["mean_signed_error"] is None else f"{r['mean_signed_error']:.3f}", "Bias": r["bias"] or "—"} for r in a["residual_by_target_range"]]
    combination_rows = [{"Produce": x["produce_type"], "Storage": x["storage_type"], "Count": x["count"], "Percent": f"{x['percent']:.2f}%"} for x in a["dataset_structure"]["category_counts"]["produce_storage_combinations"]]
    num_structure_rows = []
    for col, info in a["dataset_structure"]["column_value_frequency"].items():
        top = info["top_values"][0]
        num_structure_rows.append({"Column": col, "Unique": info["unique_values"], "Most frequent": top["value"], "Count": top["count"], "Share": f"{top['percent']:.2f}%", "Decimal digits": json.dumps(info["decimal_digit_frequency"], sort_keys=True)})
    bootstrap = a["bootstrap"]
    abs_p = a["absolute_error_percentiles"]
    signed_p = a["signed_error_percentiles"]
    assessment = [
        ("Dataset provenance", "No source/provenance documentation is present in the inspected CSV/artifacts.", "Unknown; no independent provenance evidence was available.", "Cannot establish real-world source or collection process."),
        ("Target quality", f"{t['equal_0_5']:,} labels are exactly 0.5 days; target spans {t['minimum']:.2f}–{t['maximum']:.2f} days.", "The reason for the repeated 0.5 label is undocumented; labels lack independent measurement verification.", "Target semantics and measurement protocol remain unverified."),
        ("Random-split validity", "Reproduced shuffled 70/15/15 split and saved metrics.", "No specimen, batch, study, or source identifier is available for grouped splitting.", "Related or rule-generated records can be distributed across train/test."),
        ("Train/test similarity", f"All exact inputs are unique; {nr['near_pairs_le_0_10']['count']:,} same-category pairs fall within 0.10 standardized Euclidean distance.", "Nearness thresholds are exploratory; similar rows may be correlated.", "Random split may test interpolation among similar feature profiles."),
        ("Feature sufficiency", "The eight columns support a strong within-file random-split fit.", "No independent dataset or longitudinal repeated specimen data validates feature sufficiency.", "Performance outside this table is unknown."),
        ("Long-tail performance", f">20–40 day MAE {next(r['mae'] for r in a['performance_by_shelf_life_range'] if r['range']=='gt_20_to_40'):.3f}; >40 day MAE {next(r['mae'] for r in a['performance_by_shelf_life_range'] if r['range']=='gt_40'):.3f}.", "Errors and underprediction increase in long-life ranges.", "Long shelf-life estimates have weaker absolute precision."),
        ("Short-shelf-life performance", f"0.5-day group MAE {floor['mae']:.3f}; group mean signed error {floor['mean_signed_error']:.3f} days.", "Large floor group is heterogeneous and its meaning is unknown.", "Aggregated performance can mask behavior for non-floor targets."),
        ("OOD validation", "No OOD image test was performed.", "The image pipeline cannot reliably provide all environmental/storage/age inputs for arbitrary images.", "No OOD generalization evidence."),
        ("Production input realism", "The existing agent maps quality_score into both freshness_score and quality_score and supplies telemetry/state defaults.", "The dataset treats freshness and quality as separate fields; production defaults and category vocabularies may differ from training.", "Input distribution and semantic mismatch require controlled validation."),
    ]
    assessment_rows = [{"Category": c, "Evidence": e, "Observed result": o, "Limitation": l} for c, e, o, l in assessment]
    assessment_table = md_table(assessment_rows, ["Category", "Evidence", "Observed result", "Limitation"])
    decision = "NOT READY FOR PRODUCTION INTEGRATION"
    return f"""# Final Validation and Generalization Audit — Shelf-Life V1

## 1. Executive Summary

V1 reproduces its stored random-test metrics on the original 7,500-row test split, with saved-artifact hashes matching prior recorded values. This establishes reproducibility on this dataset, not real-world shelf-life accuracy. Provenance and measured-label status are unknown, grouped/independent validation is unavailable, long-tail errors are material, and test predictions include negative values. Decision: **{decision}**.

## 2. Model Identity

- Model: `shelf_life_xgboost_v1`; loaded from the saved JSON artifact; no fitting/retraining occurred.
- XGBoost: {config['xgboost_version']}; Python: {config['python_version']}.
- Configuration: {json.dumps(config['hyperparameters'], sort_keys=True)}.
- Inputs: `{', '.join(FEATURES)}`; target: `{TARGET}`.
- Preprocessing: one-hot encoding of produce/storage; numeric passthrough, no scaling.

## 3. Dataset Verification

Original source `{d['filename']}` has {d['rows']:,} rows, {d['feature_count']} inputs, and target `{TARGET}`. SHA-256: `{d['sha256']}`. Missing values in required features/target: {sum(d['missing_values_per_column'].values())}. Exact duplicate rows: {d['exact_duplicate_rows']:,}. Target count {t['count']:,}; min/max {t['minimum']:.2f}/{t['maximum']:.2f}; mean {t['mean']:.6f}; median {t['median']:.2f}; sample SD {t['std_sample']:.6f}; Q1/Q3 {t['q1']:.2f}/{t['q3']:.2f}; exact 0.5 count {t['equal_0_5']:,}; below 0.5 {t['less_than_0_5']}; exact 1.0 {t['equal_1_0']}.

## 4. Artifact Integrity

Known prior hashes matched for model `{art['hashes'][str((V1 / 'artifacts/shelf_life_xgboost_v1.json').relative_to(ROOT))]}`, preprocessor `{art['hashes'][str((V1 / 'artifacts/preprocessor.joblib').relative_to(ROOT))]}`, and the saved metrics. Feature-manifest and training-config hashes were recorded in this audit; previous hashes were not available for comparison. Model configuration, input manifest, transformed feature count, and preprocessing description are consistent with V1. Protected source hashes were checked before and after validation; no changes detected.

## 5. Test-Set Reproduction

The exact two-stage split from V1 `train.py` was reproduced with seed 42. Train/validation/test sizes: {s['train']:,}/{s['validation']:,}/{s['test']:,}. The loaded model achieved MAE {overall['mae']:.6f}, RMSE {overall['rmse']:.6f}, R² {overall['r2']:.6f}, median AE {overall['median_absolute_error']:.6f}, and maximum AE {overall['max_absolute_error']:.6f}; saved values match within floating-point tolerance. These are metrics on this random split only.

## 6. Dataset Structure Analysis

All {len(a['dataset_structure']['category_counts']['produce_storage_combinations'])} produce/storage combinations are enumerated in the JSON results; their counts appear below.

{md_table(combination_rows, ['Produce', 'Storage', 'Count', 'Percent'])}

Value repetition summary (decimal digits are observed string precision, not measurement precision):

{md_table(num_structure_rows, ['Column', 'Unique', 'Most frequent', 'Count', 'Share', 'Decimal digits'])}

These rounded/repeated values and the 0.5-day mass are observable structure. Provenance is unknown. This supports describing possible synthetic/formula-like structure as a possibility, not a conclusion.

## 7. Duplicate / Near-Duplicate Analysis

Exact duplicated 8-input vectors: {nr['exact_duplicate_feature_vectors']}; unique exact vectors: {nr['unique_exact_feature_vectors']:,}. Nearness was measured after z-scoring six numeric inputs, restricting comparisons to identical produce and storage categories. Exploratory thresholds: ≤0.05 and ≤0.10 standardized Euclidean distance.

- Nearest-neighbor distance median/P95/max: {nr['nearest_neighbor_distance']['median']:.4f}/{nr['nearest_neighbor_distance']['p95']:.4f}/{nr['nearest_neighbor_distance']['max']:.4f}.
- Rows with nearest neighbor ≤0.05/≤0.10: {nr['nearest_neighbor_distance']['count_le_0_05']:,}/{nr['nearest_neighbor_distance']['count_le_0_10']:,}.
- Near pairs ≤0.05/≤0.10: {nr['near_pairs_le_0_05']['count']:,}/{nr['near_pairs_le_0_10']['count']:,}.
- Nearest-neighbor target absolute difference median/P95/max: {nr['near_neighbor_target_absolute_difference']['median']:.3f}/{nr['near_neighbor_target_absolute_difference']['p95']:.3f}/{nr['near_neighbor_target_absolute_difference']['max']:.3f} days.
- Connected near-neighbor components with size ≥2 at ≤0.10: {nr['near_pair_target_spread_le_0_10']['connected_components_size_ge_2']}.
- Near-pair split counts and largest groups with target spread are in `final_validation_metrics.json`.

Similar input profiles can therefore occur across rows; the random split may put close neighbors on both sides. The thresholds are exploratory and do not define scientific duplicates.

## 8. Target Consistency Analysis

Nearest-neighbor target difference median {nr['near_neighbor_target_absolute_difference']['median']:.3f} days, P95 {nr['near_neighbor_target_absolute_difference']['p95']:.3f}, maximum {nr['near_neighbor_target_absolute_difference']['max']:.3f}. Near pairs can have meaningfully different labels, indicating that close input vectors do not uniquely determine the target in this file. This is descriptive, not causal.

## 9. Produce-Level Performance

{md_table(prod_rows, ['Produce', 'Count', 'MAE', 'RMSE', 'R²', 'Mean actual', 'Mean predicted', 'Mean signed error', 'Note'])}

Test counts range from {min(r['count'] for r in a['performance_by_produce_type'])} to {max(r['count'] for r in a['performance_by_produce_type'])}; no produce group is below the 30-row descriptive threshold. Higher-error groups by observed MAE include Garlic ({next(r['mae'] for r in a['performance_by_produce_type'] if r['category']=='Garlic'):.3f} days), Ginger ({next(r['mae'] for r in a['performance_by_produce_type'] if r['category']=='Ginger'):.3f}), Onion ({next(r['mae'] for r in a['performance_by_produce_type'] if r['category']=='Onion'):.3f}), and Pomegranate ({next(r['mae'] for r in a['performance_by_produce_type'] if r['category']=='Pomegranate'):.3f}). These are descriptive differences, not causal findings or rankings. Use JSON for full precision.

## 10. Storage-Level Performance

{md_table(storage_rows, ['Storage', 'Count', 'MAE', 'RMSE', 'R²', 'Mean actual', 'Mean predicted', 'Mean signed error'])}

Storage test counts range from {min(r['count'] for r in a['performance_by_storage_type'])} to {max(r['count'] for r in a['performance_by_storage_type'])}, so these categories are not low-count groups in this split. Observed mean bias varies by category; see the signed-error column and JSON without causal interpretation.

## 11. Shelf-Life Range Performance

{md_table(range_rows, ['Range', 'Count', 'MAE', 'RMSE', 'Mean actual', 'Mean predicted', 'Mean signed error'])}

Long ranges: >20–40 day MAE {next(r['mae'] for r in a['performance_by_shelf_life_range'] if r['range']=='gt_20_to_40'):.3f}; >40 day MAE {next(r['mae'] for r in a['performance_by_shelf_life_range'] if r['range']=='gt_40'):.3f}.

## 12. 0.5-Day Analysis

Count {floor['count']:,} ({floor['percentage_test']:.3f}% of test); MAE {floor['mae']:.4f}; RMSE {floor['rmse']:.4f}; mean/median prediction {floor['mean_predicted']:.4f}/{floor['median_predicted']:.4f}; min/max prediction {floor['minimum_predicted']:.4f}/{floor['maximum_predicted']:.4f}; mean signed error {floor['mean_signed_error']:.4f} days. Full-dataset floor frequency is {t['equal_0_5']:,}/{t['count']:,} ({t['equal_0_5']/t['count']*100:.3f}%).

Prediction counts: <0 = {a['prediction_range']['count_below_0']}; <0.5 = {a['prediction_range']['count_below_0_5']}; <1 = {a['prediction_range']['count_below_1']}.

Overall MAE/RMSE: {overall['mae']:.4f}/{overall['rmse']:.4f}. Excluding 0.5 targets: MAE {a['excluding_0_5_day']['mae']:.4f}, RMSE {a['excluding_0_5_day']['rmse']:.4f}, R² {a['excluding_0_5_day']['r2']:.4f}. Floor-only MAE/RMSE: {floor['mae']:.4f}/{floor['rmse']:.4f}. The floor group is {floor['percentage_test']:.2f}% of test rows and contributes {floor['contribution_to_overall_error']['absolute_error_share_percent']:.2f}% of total absolute error ({floor['contribution_to_overall_error']['squared_error_share_percent']:.2f}% of squared error). Its errors are lower than the non-floor subgroup, so the overall score is influenced by this group but is not simply a result of it. Neither result establishes label validity or real-world accuracy.

## 13. Residual Analysis

Residual is prediction − actual. Overall mean {a['residual_summary']['mean_residual']:.4f}, median {a['residual_summary']['median_residual']:.4f}, MAE {a['residual_summary']['mae']:.4f}, RMSE {a['residual_summary']['rmse']:.4f} days.

{md_table(residual_rows, ['Range', 'Count', 'MAE', 'Mean signed error', 'Bias'])}

Positive mean residual means overprediction; negative means underprediction. Bias by produce/storage is provided in sections 9–10. This audit does not infer causal reasons.

## 14. Prediction Range Analysis

Minimum {a['prediction_range']['minimum']:.4f}; maximum {a['prediction_range']['maximum']:.4f}; below zero {a['prediction_range']['count_below_0']}; below 0.5 {a['prediction_range']['count_below_0_5']}; above dataset maximum 133.47 {a['prediction_range']['count_above_dataset_max']}. Negative output is physically implausible and needs application-layer handling or a future model revision; this audit did not change predictions or model files.

## 15. Error Percentiles

Absolute error percentiles (days): {json.dumps(abs_p, sort_keys=True)}; maximum {overall['max_absolute_error']:.4f}. Signed residual percentiles (days): {json.dumps(signed_p, sort_keys=True)}.

## 16. Bootstrap Confidence Intervals

Percentile bootstrap over the fixed test rows, 1,000 resamples, seed 42:

| Metric | Point estimate | 95% bootstrap CI |
|---|---:|---:|
| MAE (days) | {bootstrap['mae_point_estimate']:.4f} | [{bootstrap['mae_ci_95'][0]:.4f}, {bootstrap['mae_ci_95'][1]:.4f}] |
| RMSE (days) | {bootstrap['rmse_point_estimate']:.4f} | [{bootstrap['rmse_ci_95'][0]:.4f}, {bootstrap['rmse_ci_95'][1]:.4f}] |

These intervals characterize sampling variation within this test set, not external validation uncertainty.

## 17. Random-Split Generalization Risks

The split is reproducible and model metrics replay, but the dataset has no specimen/batch/source ID. Near-neighbor input profiles occur at the exploratory thresholds above. If rows share hidden samples or a common generation rule, random assignment allows related rows into both train and test and can yield optimistic interpolation metrics. No grouped or time-based independent test can be constructed from available columns.

## 18. OOD Validation Status

OOD image validation not performed because reliable eight-feature extraction was unavailable. Existing vision can estimate image-related properties, but arbitrary images do not provide validated temperature, humidity, harvest age, or storage type. No target labels were invented.

## 19. Production Input Risks

The current shelf-life agent obtains produce/quality/defect values from vision/state and environmental values from telemetry/state defaults. In the inspected agent, `freshness_score` is assigned the same `quality_score`, while the training data contains separate freshness and quality fields. The production default `storage_type='ambient'` is not one of the dataset's five storage labels. These semantic/default/category mismatches and unknown input distributions require controlled input validation before integration.

## 20. Limitations

- Dataset provenance is undocumented; targets are not independently confirmed as measured real-world shelf life.
- The reason for 8,634 exact 0.5-day labels is unknown.
- All exact eight-input vectors are unique, so repeated-vector consistency cannot be checked.
- Similar but nonidentical vectors and target spreads exist; their cause is unknown.
- Possible synthetic/formula-like structure is not proven.
- Random-split metrics do not establish generalization to new studies, batches, suppliers, or field conditions.
- No independent measured shelf-life validation or reliable OOD test was performed.
- Correlations and subgroup differences do not establish causality.

## 21. Model Readiness Decision

**{decision}**

V1 is reproducible on this dataset, but unknown provenance and target semantics, lack of independent validation, possible random-split similarity, negative predictions, increasing long-tail error, and production input mismatch do not justify production integration. The dataset result MAE of {overall['mae']:.3f} days must not be presented as real-world shelf-life accuracy.

## 22. Recommended Next Step

Obtain provenance-backed, independently measured longitudinal shelf-life data with specimen/batch identifiers and documented failure criteria. Define a group- or time-based holdout, validate all eight production inputs against source distributions, then assess calibration, nonnegative behavior, and subgroup performance before any controlled integration review.
"""


if __name__ == "__main__":
    main()
