"""Focused check for whether the 0.5 target mass is predictable/censored."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.metrics import accuracy_score, average_precision_score, confusion_matrix, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from xgboost import XGBClassifier, XGBRegressor

ROOT = Path(__file__).resolve().parents[2]
df = pd.read_csv(ROOT / "shelf life prediction dataset.xlsx.csv")
target = "remaining_shelf_life_days"
cats = ["produce_type", "storage_type"]
nums = ["freshness_score", "quality_score", "defect_probability", "temperature_c", "humidity_rh", "harvest_age_days"]
features = cats + nums
y = df[target].astype(float)
is_floor = y.eq(.5).astype(int)
train_idx, test_idx = train_test_split(np.arange(len(df)), test_size=.2, random_state=42)
X_train, X_test = df.iloc[train_idx][features], df.iloc[test_idx][features]
y_train, y_test = y.iloc[train_idx], y.iloc[test_idx]
floor_train, floor_test = is_floor.iloc[train_idx], is_floor.iloc[test_idx]
floor_test_mask = floor_test.eq(1).to_numpy()
prep = ColumnTransformer([("cats", OneHotEncoder(handle_unknown="ignore"), cats), ("nums", "passthrough", nums)])

def descript(a):
    return {"count": int(len(a)), "min": float(np.min(a)), "q25": float(np.quantile(a,.25)), "median": float(np.median(a)), "q75": float(np.quantile(a,.75)), "max": float(np.max(a)), "mean": float(np.mean(a))}

res = {"split": {"seed": 42, "train": len(train_idx), "test": len(test_idx)}, "floor_classification": {}, "regression_fit_above_floor_only": {}}
classifiers = {
    "Random Forest classifier": RandomForestClassifier(n_estimators=200, min_samples_leaf=1, n_jobs=8, random_state=42, class_weight=None),
    "XGBoost classifier": XGBClassifier(n_estimators=400, max_depth=6, learning_rate=.05, min_child_weight=3, subsample=.9, colsample_bytree=.9, reg_lambda=1, objective="binary:logistic", eval_metric="logloss", random_state=42, n_jobs=8, tree_method="hist", verbosity=0),
}
for name, model in classifiers.items():
    pipe = Pipeline([("preprocess", prep), ("model", model)])
    pipe.fit(X_train, floor_train)
    p = pipe.predict_proba(X_test)[:, 1]
    pred = p >= .5
    res["floor_classification"][name] = {
        "roc_auc": float(roc_auc_score(floor_test, p)),
        "average_precision": float(average_precision_score(floor_test, p)),
        "accuracy_at_0_5": float(accuracy_score(floor_test, pred)),
        "precision_at_0_5": float(precision_score(floor_test, pred, zero_division=0)),
        "recall_at_0_5": float(recall_score(floor_test, pred, zero_division=0)),
        "confusion_matrix_tn_fp_fn_tp": confusion_matrix(floor_test, pred, labels=[0,1]).ravel().tolist(),
        "predicted_probability_floor_rows": descript(p[floor_test_mask]),
        "predicted_probability_nonfloor_rows": descript(p[~floor_test_mask]),
    }

regressors = {
    "Random Forest trained above floor": RandomForestRegressor(n_estimators=200, min_samples_leaf=1, max_features=1.0, n_jobs=8, random_state=42),
    "XGBoost trained above floor": XGBRegressor(objective="reg:squarederror", n_estimators=500, max_depth=7, learning_rate=.05, min_child_weight=3, subsample=.9, colsample_bytree=.9, reg_lambda=1, random_state=42, n_jobs=8, tree_method="hist", verbosity=0),
}
train_nonfloor = y_train > .5
test_nonfloor_mask = y_test > .5
for name, model in regressors.items():
    pipe = Pipeline([("preprocess", prep), ("model", model)])
    pipe.fit(X_train.loc[train_nonfloor], y_train.loc[train_nonfloor])
    pred_nonfloor = pipe.predict(X_test.loc[test_nonfloor_mask])
    pred_floor = pipe.predict(X_test.loc[~test_nonfloor_mask])
    res["regression_fit_above_floor_only"][name] = {
        "fit_rows_above_floor": int(train_nonfloor.sum()),
        "holdout_nonfloor_rows": int(test_nonfloor_mask.sum()),
        "holdout_floor_rows": int((~test_nonfloor_mask).sum()),
        "nonfloor_test_mae": float(np.mean(np.abs(y_test.loc[test_nonfloor_mask].to_numpy() - pred_nonfloor))),
        "nonfloor_test_rmse": float(np.sqrt(np.mean((y_test.loc[test_nonfloor_mask].to_numpy() - pred_nonfloor) ** 2))),
        "nonfloor_test_r2": float(1 - np.sum((y_test.loc[test_nonfloor_mask].to_numpy() - pred_nonfloor) ** 2) / np.sum((y_test.loc[test_nonfloor_mask].to_numpy() - y_test.loc[test_nonfloor_mask].mean()) ** 2)),
        "floor_row_unclipped_predictions": descript(pred_floor),
        "floor_rows_predicted_le_0_5": int((pred_floor <= .5).sum()),
        "floor_rows_predicted_le_0_5_percent": float(np.mean(pred_floor <= .5) * 100),
    }

out = Path(__file__).resolve().parent / "50k_floor_investigation.json"
out.write_text(json.dumps(res, indent=2), encoding="utf-8")
print(json.dumps(res, indent=2))
