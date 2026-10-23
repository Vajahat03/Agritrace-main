"""Read-only investigation and temporary model benchmarks for the 50k CSV."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.spatial import cKDTree
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeRegressor
from xgboost import XGBRegressor


ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "shelf life prediction dataset.xlsx.csv"
OUT = Path(__file__).resolve().parent / "50k_investigation.json"
SEED = 42
TARGET = "remaining_shelf_life_days"
CATS = ["produce_type", "storage_type"]
NUMS = [
    "freshness_score",
    "quality_score",
    "defect_probability",
    "temperature_c",
    "humidity_rh",
    "harvest_age_days",
]
FEATURES = CATS + NUMS
EXPECTED = [
    "produce_type", "freshness_score", "quality_score", "defect_probability",
    "temperature_c", "humidity_rh", "harvest_age_days", "storage_type", TARGET,
]


def py(value):
    if isinstance(value, dict):
        return {str(k): py(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [py(v) for v in value]
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if not np.isfinite(value) else float(value)
    if isinstance(value, (np.bool_,)):
        return bool(value)
    if pd.isna(value):
        return None
    return value


def metrics(y, pred):
    return {
        "mae": mean_absolute_error(y, pred),
        "rmse": np.sqrt(mean_squared_error(y, pred)),
        "r2": r2_score(y, pred),
    }


def stats(s: pd.Series):
    return {
        "count": int(s.count()),
        "min": s.min(),
        "q25": s.quantile(0.25),
        "median": s.median(),
        "q75": s.quantile(0.75),
        "max": s.max(),
        "mean": s.mean(),
        "std_sample": s.std(ddof=1),
    }


def main():
    np.random.seed(SEED)
    df = pd.read_csv(DATA)
    if list(df.columns) != EXPECTED:
        raise ValueError(f"Unexpected columns: {list(df.columns)}")
    if df.isna().any().any():
        raise ValueError("Unexpected missing values; investigate before modeling")

    y = df[TARGET].astype(float)
    floor = y.eq(0.5)
    result = {
        "dataset": {
            "path": str(DATA),
            "file_size_bytes": DATA.stat().st_size,
            "sha256": hashlib.sha256(DATA.read_bytes()).hexdigest(),
            "rows": len(df),
            "columns": list(df.columns),
            "dtypes": {c: str(t) for c, t in df.dtypes.items()},
            "missing": {c: int(n) for c, n in df.isna().sum().items()},
            "exact_duplicate_rows": int(df.duplicated().sum()),
            "exact_duplicate_feature_vectors": int(df.duplicated(FEATURES).sum()),
            "first_10": df.head(10).to_dict(orient="records"),
            "last_10": df.tail(10).to_dict(orient="records"),
        },
        "target": {
            **stats(y),
            "quartiles": {"q25": y.quantile(.25), "q50": y.quantile(.50), "q75": y.quantile(.75)},
            "unique_values": int(y.nunique()),
            "equal_0_5": int(floor.sum()),
            "percent_equal_0_5": float(floor.mean() * 100),
            "range_counts_half_open": {
                "below_1": int((y < 1).sum()),
                "1_to_lt_3": int(((y >= 1) & (y < 3)).sum()),
                "3_to_lt_7": int(((y >= 3) & (y < 7)).sum()),
                "7_to_lt_14": int(((y >= 7) & (y < 14)).sum()),
                "14_to_lt_30": int(((y >= 14) & (y < 30)).sum()),
                "30_to_60_inclusive": int(((y >= 30) & (y <= 60)).sum()),
                "above_60": int((y > 60).sum()),
            },
            "decimal_digits": {str(k): int(v) for k, v in y.astype(str).str.split(".").str[-1].str.len().value_counts().sort_index().items()},
            "most_repeated_values": y.value_counts().head(15).rename_axis("value").reset_index(name="count").to_dict("records"),
        },
        "correlations": {},
        "produce": {},
        "storage": {},
        "temperature": {},
        "humidity": {},
        "floor_vs_rest": {},
        "suspicious_patterns": {},
        "models": {},
        "multiplicative_formula_candidate": {},
    }

    for feature in NUMS:
        result["correlations"][feature] = {
            "pearson": df[feature].corr(y, method="pearson"),
            "spearman": df[feature].corr(y, method="spearman"),
        }

    produce = df.groupby("produce_type", observed=True)
    for name, group in produce:
        result["produce"][name] = {
            "sample_count": len(group),
            "shelf_life_mean": group[TARGET].mean(),
            "shelf_life_median": group[TARGET].median(),
            "shelf_life_min": group[TARGET].min(),
            "shelf_life_max": group[TARGET].max(),
            **{f"mean_{c}": group[c].mean() for c in NUMS},
        }

    storage = df.groupby("storage_type", observed=True)
    for name, group in storage:
        result["storage"][name] = {
            "sample_count": len(group),
            "shelf_life_mean": group[TARGET].mean(),
            "shelf_life_median": group[TARGET].median(),
            **{f"mean_{c}": group[c].mean() for c in ["temperature_c", "humidity_rh", "freshness_score", "quality_score"]},
        }

    result["temperature"]["overall"] = {
        "pearson": df.temperature_c.corr(y),
        "spearman": df.temperature_c.corr(y, method="spearman"),
        "quintiles": df.groupby(pd.qcut(df.temperature_c, 5, duplicates="drop"), observed=True)
        .agg(n=(TARGET, "size"), temp_mean=("temperature_c", "mean"), shelf_life_mean=(TARGET, "mean"), shelf_life_median=(TARGET, "median"))
        .reset_index(drop=True).to_dict("records"),
    }
    for name, group in storage:
        result["temperature"][name] = {
            "pearson": group.temperature_c.corr(group[TARGET]),
            "spearman": group.temperature_c.corr(group[TARGET], method="spearman"),
            "temperature_min": group.temperature_c.min(),
            "temperature_max": group.temperature_c.max(),
        }

    result["humidity"]["overall"] = {
        "pearson": df.humidity_rh.corr(y),
        "spearman": df.humidity_rh.corr(y, method="spearman"),
        "deciles": df.groupby(pd.qcut(df.humidity_rh, 10, duplicates="drop"), observed=True)
        .agg(n=(TARGET, "size"), rh_mean=("humidity_rh", "mean"), shelf_life_mean=(TARGET, "mean"), shelf_life_median=(TARGET, "median"))
        .reset_index(drop=True).to_dict("records"),
    }
    for name, group in storage:
        result["humidity"][name] = {
            "pearson": group.humidity_rh.corr(group[TARGET]),
            "spearman": group.humidity_rh.corr(group[TARGET], method="spearman"),
            "quintiles": group.groupby(pd.qcut(group.humidity_rh, 5, duplicates="drop"), observed=True)
            .agg(n=(TARGET, "size"), rh_mean=("humidity_rh", "mean"), shelf_life_mean=(TARGET, "mean"))
            .reset_index(drop=True).to_dict("records"),
        }

    floor_df, rest_df = df.loc[floor], df.loc[~floor]
    floor_info = {
        "floor_count": len(floor_df),
        "rest_count": len(rest_df),
        "numeric_floor": {c: stats(floor_df[c]) for c in NUMS},
        "numeric_rest": {c: stats(rest_df[c]) for c in NUMS},
        "categorical_floor": {},
        "categorical_rest": {},
    }
    for c in CATS:
        floor_vc = floor_df[c].value_counts().sort_index()
        rest_vc = rest_df[c].value_counts().sort_index()
        floor_info["categorical_floor"][c] = {
            k: {"count": int(v), "percent_of_group": float(v / len(floor_df) * 100)} for k, v in floor_vc.items()
        }
        floor_info["categorical_rest"][c] = {
            k: {"count": int(v), "percent_of_group": float(v / len(rest_df) * 100)} for k, v in rest_vc.items()
        }
    result["floor_vs_rest"] = floor_info

    combo = df.groupby(CATS, observed=True)[TARGET].agg(["count", "mean", "std", "min", "max"])
    combo_spread = combo["max"] - combo["min"]
    # The stored decimal precision, exact predictor vectors, and nearest numeric neighbours.
    numeric_scaled = StandardScaler().fit_transform(df[NUMS])
    nn_dist, nn_idx = cKDTree(numeric_scaled).query(numeric_scaled, k=2, workers=-1)
    nearest = nn_dist[:, 1]
    rounded_inputs = df[FEATURES].copy()
    rounded_inputs[NUMS] = rounded_inputs[NUMS].round(1)
    result["suspicious_patterns"] = {
        "unique_produce_storage_pairs": int(df[CATS].drop_duplicates().shape[0]),
        "all_possible_produce_storage_pairs": int(df.produce_type.nunique() * df.storage_type.nunique()),
        "unique_target_values": int(y.nunique()),
        "target_values_with_1_decimal": int(y.astype(str).str.split(".").str[-1].str.len().eq(1).sum()),
        "target_values_with_2_decimals": int(y.astype(str).str.split(".").str[-1].str.len().eq(2).sum()),
        "predictor_rows_repeated_when_numeric_rounded_1_decimal": int(rounded_inputs.duplicated(FEATURES).sum()),
        "nearest_neighbor_numeric_distance_standardized": {
            "min": float(nearest.min()),
            "median": float(np.median(nearest)),
            "p01": float(np.quantile(nearest, .01)),
            "p05": float(np.quantile(nearest, .05)),
            "below_0_05": int((nearest < .05).sum()),
            "below_0_10": int((nearest < .10).sum()),
        },
        "produce_storage_target_range": {
            "groups": len(combo),
            "groups_with_constant_target": int((combo_spread == 0).sum()),
            "group_target_std_min": combo["std"].min(),
            "group_target_std_median": combo["std"].median(),
            "group_target_std_max": combo["std"].max(),
            "group_target_range_min": combo_spread.min(),
            "group_target_range_median": combo_spread.median(),
            "group_target_range_max": combo_spread.max(),
        },
        "target_floor_by_produce_percent": (floor_df.produce_type.value_counts(normalize=True).sort_index() * 100).to_dict(),
        "target_floor_by_storage_percent": (floor_df.storage_type.value_counts(normalize=True).sort_index() * 100).to_dict(),
        "target_floor_fraction_by_produce": (df.assign(is_floor=floor).groupby("produce_type", observed=True).is_floor.mean() * 100).to_dict(),
        "target_floor_fraction_by_storage": (df.assign(is_floor=floor).groupby("storage_type", observed=True).is_floor.mean() * 100).to_dict(),
    }

    # Same fixed 80/20 split for every requested model.
    idx_train, idx_test = train_test_split(np.arange(len(df)), test_size=.20, random_state=SEED)
    X_train, X_test = df.iloc[idx_train][FEATURES], df.iloc[idx_test][FEATURES]
    y_train, y_test = y.iloc[idx_train], y.iloc[idx_test]
    result["split"] = {"train_rows": len(idx_train), "test_rows": len(idx_test), "seed": SEED, "test_size": .20}
    result["models"]["Mean baseline"] = metrics(y_test, np.full(len(y_test), y_train.mean()))

    encoder = ColumnTransformer(
        [("categorical", OneHotEncoder(handle_unknown="ignore"), CATS), ("numeric", "passthrough", NUMS)],
        remainder="drop",
    )
    models = {
        "Linear Regression": LinearRegression(),
        "Decision Tree": DecisionTreeRegressor(random_state=SEED),
        "Random Forest": RandomForestRegressor(n_estimators=250, min_samples_leaf=1, max_features=1.0, n_jobs=-1, random_state=SEED),
        "XGBoost": XGBRegressor(
            objective="reg:squarederror", n_estimators=500, max_depth=7, learning_rate=.05,
            min_child_weight=3, subsample=.9, colsample_bytree=.9, reg_lambda=1,
            random_state=SEED, n_jobs=8, tree_method="hist", verbosity=0,
        ),
    }
    fitted = {}
    for name, estimator in models.items():
        pipe = Pipeline([("preprocess", encoder), ("model", estimator)])
        pipe.fit(X_train, y_train)
        pred = pipe.predict(X_test)
        fitted[name] = pipe
        result["models"][name] = metrics(y_test, pred)
        if name in {"Random Forest", "XGBoost"}:
            result.setdefault("floor_model_checks", {})[name] = {
                "test_floor_rows": int(floor.iloc[idx_test].sum()),
                "test_floor_actual_mean": float(y_test[floor.iloc[idx_test].to_numpy()].mean()),
                "test_floor_predicted_mean": float(np.mean(pred[floor.iloc[idx_test].to_numpy()])),
                "test_floor_predicted_median": float(np.median(pred[floor.iloc[idx_test].to_numpy()])),
                "test_nonfloor_metrics": metrics(y_test[~floor.iloc[idx_test].to_numpy()], pred[~floor.iloc[idx_test].to_numpy()]),
            }

    # A simple multiplicative/power-law candidate: categorical base × powers of
    # freshness, quality and (1-defect) × exponential temperature/RH/age effects,
    # with a 0.5 floor. Fit log-target only on rows above the suspected floor.
    formula_frame = df[CATS + NUMS].copy()
    formula_frame["log_freshness"] = np.log(df.freshness_score.clip(lower=.01) / 100)
    formula_frame["log_quality"] = np.log(df.quality_score.clip(lower=.01) / 100)
    formula_frame["log_no_defect"] = np.log((1 - df.defect_probability).clip(lower=.001))
    formula_frame["temperature_c"] = df.temperature_c
    formula_frame["humidity_rh"] = df.humidity_rh
    formula_frame["harvest_age_days"] = df.harvest_age_days
    formula_cols = CATS + ["log_freshness", "log_quality", "log_no_defect", "temperature_c", "humidity_rh", "harvest_age_days"]
    formula_encoder = ColumnTransformer(
        [("categorical", OneHotEncoder(handle_unknown="ignore"), CATS),
         ("numeric", "passthrough", formula_cols[len(CATS):])]
    )
    train_nonfloor = y_train > .5
    formula_pipe = Pipeline([("preprocess", formula_encoder), ("model", LinearRegression())])
    formula_pipe.fit(formula_frame.iloc[idx_train][formula_cols].loc[train_nonfloor.to_numpy()], np.log(y_train.loc[train_nonfloor].to_numpy()))
    log_latent_test = formula_pipe.predict(formula_frame.iloc[idx_test][formula_cols])
    latent_test = np.exp(np.clip(log_latent_test, -20, 20))
    clipped_pred = np.maximum(.5, latent_test)
    test_floor_mask = floor.iloc[idx_test].to_numpy()
    result["multiplicative_formula_candidate"] = {
        "description": "log-linear categorical produce/storage baseline with power effects for freshness, quality and (1-defect), and exponential effects for temperature, humidity and harvest age; fit on target > 0.5, predictions clipped at 0.5",
        "trained_rows_above_0_5": int(train_nonfloor.sum()),
        "all_test_metrics_after_0_5_floor": metrics(y_test, clipped_pred),
        "nonfloor_test_metrics_unclipped": metrics(y_test[~test_floor_mask], latent_test[~test_floor_mask]),
        "test_floor_count": int(test_floor_mask.sum()),
        "floor_rows_with_unclipped_formula_prediction_le_0_5": int((latent_test[test_floor_mask] <= .5).sum()),
        "floor_rows_percent_unclipped_formula_prediction_le_0_5": float(np.mean(latent_test[test_floor_mask] <= .5) * 100),
        "floor_rows_unclipped_prediction_stats": stats(pd.Series(latent_test[test_floor_mask])),
    }

    # Feature importance from the temporary XGBoost diagnostic model only.
    xgb_pipe = fitted["XGBoost"]
    encoded_names = xgb_pipe.named_steps["preprocess"].get_feature_names_out()
    importance = xgb_pipe.named_steps["model"].feature_importances_
    result["models"]["XGBoost_feature_importance_top_20"] = [
        {"feature": name, "importance": value}
        for name, value in sorted(zip(encoded_names, importance), key=lambda x: x[1], reverse=True)[:20]
    ]

    OUT.write_text(json.dumps(py(result), indent=2, allow_nan=False), encoding="utf-8")
    print(f"Wrote {OUT}")
    print(json.dumps(py({"target": result["target"], "correlations": result["correlations"], "split": result["split"], "models": result["models"], "multiplicative_formula_candidate": result["multiplicative_formula_candidate"], "floor_model_checks": result.get("floor_model_checks", {})}), indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
