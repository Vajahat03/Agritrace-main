# Final Validation and Generalization Audit — Shelf-Life V1

## 1. Executive Summary

V1 reproduces its stored random-test metrics on the original 7,500-row test split, with saved-artifact hashes matching prior recorded values. This establishes reproducibility on this dataset, not real-world shelf-life accuracy. Provenance and measured-label status are unknown, grouped/independent validation is unavailable, long-tail errors are material, and test predictions include negative values. Decision: **NOT READY FOR PRODUCTION INTEGRATION**.

## 2. Model Identity

- Model: `shelf_life_xgboost_v1`; loaded from the saved JSON artifact; no fitting/retraining occurred.
- XGBoost: 3.4.1; Python: 3.12.10.
- Configuration: {"colsample_bytree": 0.9, "eval_metric": "rmse", "learning_rate": 0.035, "max_depth": 7, "min_child_weight": 3, "n_estimators": 900, "n_jobs": 4, "objective": "reg:squarederror", "random_state": 42, "reg_lambda": 1.0, "subsample": 0.9, "tree_method": "hist"}.
- Inputs: `produce_type, freshness_score, quality_score, defect_probability, temperature_c, humidity_rh, harvest_age_days, storage_type`; target: `remaining_shelf_life_days`.
- Preprocessing: one-hot encoding of produce/storage; numeric passthrough, no scaling.

## 3. Dataset Verification

Original source `shelf life prediction dataset.xlsx.csv` has 50,000 rows, 8 inputs, and target `remaining_shelf_life_days`. SHA-256: `D30663CA50D45C40025F61AA8FA925AE3D68E714A1C1A143543EF74C4B67F1AF`. Missing values in required features/target: 0. Exact duplicate rows: 0. Target count 50,000; min/max 0.50/133.47; mean 8.515354; median 4.28; sample SD 11.411589; Q1/Q3 1.08/10.62; exact 0.5 count 8,634; below 0.5 0; exact 1.0 48.

## 4. Artifact Integrity

Known prior hashes matched for model `03E0EECB4355E650B7C31633AC89DB8F8B7DA97B06366618BE87961A8BCC2FF6`, preprocessor `0707C9F01E5AC1A459ADE0CCCA3C315DDB7ADB659B5EEB7C505EBF9E9501907D`, and the saved metrics. Feature-manifest and training-config hashes were recorded in this audit; previous hashes were not available for comparison. Model configuration, input manifest, transformed feature count, and preprocessing description are consistent with V1. Protected source hashes were checked before and after validation; no changes detected.

## 5. Test-Set Reproduction

The exact two-stage split from V1 `train.py` was reproduced with seed 42. Train/validation/test sizes: 34,999/7,501/7,500. The loaded model achieved MAE 1.570323, RMSE 2.631259, R² 0.950568, median AE 0.838910, and maximum AE 23.585470; saved values match within floating-point tolerance. These are metrics on this random split only.

## 6. Dataset Structure Analysis

All 125 produce/storage combinations are enumerated in the JSON results; their counts appear below.

| Produce | Storage | Count | Percent |
|---|---|---|---|
| Apple | Cold Storage | 437 | 0.87% |
| Apple | Controlled Atmosphere | 156 | 0.31% |
| Apple | Open Market | 301 | 0.60% |
| Apple | Refrigerated | 498 | 1.00% |
| Apple | Room Temperature | 614 | 1.23% |
| Banana | Cold Storage | 450 | 0.90% |
| Banana | Controlled Atmosphere | 158 | 0.32% |
| Banana | Open Market | 317 | 0.63% |
| Banana | Refrigerated | 505 | 1.01% |
| Banana | Room Temperature | 625 | 1.25% |
| Brinjal | Cold Storage | 455 | 0.91% |
| Brinjal | Controlled Atmosphere | 158 | 0.32% |
| Brinjal | Open Market | 310 | 0.62% |
| Brinjal | Refrigerated | 506 | 1.01% |
| Brinjal | Room Temperature | 650 | 1.30% |
| Cabbage | Cold Storage | 440 | 0.88% |
| Cabbage | Controlled Atmosphere | 166 | 0.33% |
| Cabbage | Open Market | 317 | 0.63% |
| Cabbage | Refrigerated | 518 | 1.04% |
| Cabbage | Room Temperature | 591 | 1.18% |
| Capsicum | Cold Storage | 446 | 0.89% |
| Capsicum | Controlled Atmosphere | 154 | 0.31% |
| Capsicum | Open Market | 300 | 0.60% |
| Capsicum | Refrigerated | 510 | 1.02% |
| Capsicum | Room Temperature | 613 | 1.23% |
| Carrot | Cold Storage | 430 | 0.86% |
| Carrot | Controlled Atmosphere | 164 | 0.33% |
| Carrot | Open Market | 267 | 0.53% |
| Carrot | Refrigerated | 531 | 1.06% |
| Carrot | Room Temperature | 602 | 1.20% |
| Cauliflower | Cold Storage | 448 | 0.90% |
| Cauliflower | Controlled Atmosphere | 154 | 0.31% |
| Cauliflower | Open Market | 288 | 0.58% |
| Cauliflower | Refrigerated | 474 | 0.95% |
| Cauliflower | Room Temperature | 613 | 1.23% |
| Chilli | Cold Storage | 458 | 0.92% |
| Chilli | Controlled Atmosphere | 160 | 0.32% |
| Chilli | Open Market | 295 | 0.59% |
| Chilli | Refrigerated | 499 | 1.00% |
| Chilli | Room Temperature | 618 | 1.24% |
| Cucumber | Cold Storage | 441 | 0.88% |
| Cucumber | Controlled Atmosphere | 150 | 0.30% |
| Cucumber | Open Market | 314 | 0.63% |
| Cucumber | Refrigerated | 486 | 0.97% |
| Cucumber | Room Temperature | 629 | 1.26% |
| Garlic | Cold Storage | 423 | 0.85% |
| Garlic | Controlled Atmosphere | 147 | 0.29% |
| Garlic | Open Market | 310 | 0.62% |
| Garlic | Refrigerated | 516 | 1.03% |
| Garlic | Room Temperature | 582 | 1.16% |
| Ginger | Cold Storage | 432 | 0.86% |
| Ginger | Controlled Atmosphere | 170 | 0.34% |
| Ginger | Open Market | 305 | 0.61% |
| Ginger | Refrigerated | 504 | 1.01% |
| Ginger | Room Temperature | 563 | 1.13% |
| Grapes | Cold Storage | 434 | 0.87% |
| Grapes | Controlled Atmosphere | 161 | 0.32% |
| Grapes | Open Market | 292 | 0.58% |
| Grapes | Refrigerated | 492 | 0.98% |
| Grapes | Room Temperature | 604 | 1.21% |
| Guava | Cold Storage | 460 | 0.92% |
| Guava | Controlled Atmosphere | 146 | 0.29% |
| Guava | Open Market | 294 | 0.59% |
| Guava | Refrigerated | 500 | 1.00% |
| Guava | Room Temperature | 579 | 1.16% |
| Lemon | Cold Storage | 436 | 0.87% |
| Lemon | Controlled Atmosphere | 155 | 0.31% |
| Lemon | Open Market | 339 | 0.68% |
| Lemon | Refrigerated | 450 | 0.90% |
| Lemon | Room Temperature | 536 | 1.07% |
| Mango | Cold Storage | 418 | 0.84% |
| Mango | Controlled Atmosphere | 181 | 0.36% |
| Mango | Open Market | 306 | 0.61% |
| Mango | Refrigerated | 470 | 0.94% |
| Mango | Room Temperature | 597 | 1.19% |
| Okra | Cold Storage | 451 | 0.90% |
| Okra | Controlled Atmosphere | 149 | 0.30% |
| Okra | Open Market | 300 | 0.60% |
| Okra | Refrigerated | 521 | 1.04% |
| Okra | Room Temperature | 649 | 1.30% |
| Onion | Cold Storage | 427 | 0.85% |
| Onion | Controlled Atmosphere | 156 | 0.31% |
| Onion | Open Market | 289 | 0.58% |
| Onion | Refrigerated | 442 | 0.88% |
| Onion | Room Temperature | 599 | 1.20% |
| Orange | Cold Storage | 444 | 0.89% |
| Orange | Controlled Atmosphere | 177 | 0.35% |
| Orange | Open Market | 306 | 0.61% |
| Orange | Refrigerated | 488 | 0.98% |
| Orange | Room Temperature | 610 | 1.22% |
| Papaya | Cold Storage | 400 | 0.80% |
| Papaya | Controlled Atmosphere | 169 | 0.34% |
| Papaya | Open Market | 299 | 0.60% |
| Papaya | Refrigerated | 464 | 0.93% |
| Papaya | Room Temperature | 614 | 1.23% |
| Peas | Cold Storage | 461 | 0.92% |
| Peas | Controlled Atmosphere | 145 | 0.29% |
| Peas | Open Market | 315 | 0.63% |
| Peas | Refrigerated | 490 | 0.98% |
| Peas | Room Temperature | 580 | 1.16% |
| Pomegranate | Cold Storage | 452 | 0.90% |
| Pomegranate | Controlled Atmosphere | 156 | 0.31% |
| Pomegranate | Open Market | 298 | 0.60% |
| Pomegranate | Refrigerated | 498 | 1.00% |
| Pomegranate | Room Temperature | 607 | 1.21% |
| Potato | Cold Storage | 423 | 0.85% |
| Potato | Controlled Atmosphere | 168 | 0.34% |
| Potato | Open Market | 280 | 0.56% |
| Potato | Refrigerated | 506 | 1.01% |
| Potato | Room Temperature | 640 | 1.28% |
| Spinach | Cold Storage | 464 | 0.93% |
| Spinach | Controlled Atmosphere | 162 | 0.32% |
| Spinach | Open Market | 282 | 0.56% |
| Spinach | Refrigerated | 471 | 0.94% |
| Spinach | Room Temperature | 589 | 1.18% |
| Tomato | Cold Storage | 453 | 0.91% |
| Tomato | Controlled Atmosphere | 165 | 0.33% |
| Tomato | Open Market | 303 | 0.61% |
| Tomato | Refrigerated | 522 | 1.04% |
| Tomato | Room Temperature | 552 | 1.10% |
| Watermelon | Cold Storage | 444 | 0.89% |
| Watermelon | Controlled Atmosphere | 170 | 0.34% |
| Watermelon | Open Market | 313 | 0.63% |
| Watermelon | Refrigerated | 478 | 0.96% |
| Watermelon | Room Temperature | 641 | 1.28% |

Value repetition summary (decimal digits are observed string precision, not measurement precision):

| Column | Unique | Most frequent | Count | Share | Decimal digits |
|---|---|---|---|---|---|
| freshness_score | 6912 | 99.0 | 205 | 0.41% | {"1": 5238, "2": 44762} |
| quality_score | 6171 | 100.0 | 135 | 0.27% | {"1": 5132, "2": 44868} |
| defect_probability | 6856 | 0.95 | 501 | 1.00% | {"1": 56, "2": 902, "3": 4505, "4": 44537} |
| temperature_c | 2857 | 0.0 | 735 | 1.47% | {"1": 5522, "2": 44478} |
| humidity_rh | 6157 | 98.0 | 5441 | 10.88% | {"1": 14396, "2": 35604} |
| harvest_age_days | 1745 | 0.2 | 136 | 0.27% | {"1": 5101, "2": 44899} |
| remaining_shelf_life_days | 4774 | 0.5 | 8634 | 17.27% | {"1": 12633, "2": 37367} |

These rounded/repeated values and the 0.5-day mass are observable structure. Provenance is unknown. This supports describing possible synthetic/formula-like structure as a possibility, not a conclusion.

## 7. Duplicate / Near-Duplicate Analysis

Exact duplicated 8-input vectors: 0; unique exact vectors: 50,000. Nearness was measured after z-scoring six numeric inputs, restricting comparisons to identical produce and storage categories. Exploratory thresholds: ≤0.05 and ≤0.10 standardized Euclidean distance.

- Nearest-neighbor distance median/P95/max: 0.3164/0.5531/3.4038.
- Rows with nearest neighbor ≤0.05/≤0.10: 2/90.
- Near pairs ≤0.05/≤0.10: 1/45.
- Nearest-neighbor target absolute difference median/P95/max: 1.070/7.210/34.630 days.
- Connected near-neighbor components with size ≥2 at ≤0.10: 45.
- Near-pair split counts and largest groups with target spread are in `final_validation_metrics.json`.

Similar input profiles can therefore occur across rows; the random split may put close neighbors on both sides. The thresholds are exploratory and do not define scientific duplicates.

## 8. Target Consistency Analysis

Nearest-neighbor target difference median 1.070 days, P95 7.210, maximum 34.630. Near pairs can have meaningfully different labels, indicating that close input vectors do not uniquely determine the target in this file. This is descriptive, not causal.

## 9. Produce-Level Performance

| Produce | Count | MAE | RMSE | R² | Mean actual | Mean predicted | Mean signed error | Note |
|---|---|---|---|---|---|---|---|---|
| Apple | 259 | 2.196 | 2.758 | 0.959 | 15.925 | 15.518 | -0.407 | sufficient descriptive count |
| Banana | 310 | 0.546 | 0.726 | 0.935 | 3.295 | 3.371 | 0.077 | sufficient descriptive count |
| Brinjal | 309 | 0.631 | 0.943 | 0.885 | 3.316 | 3.423 | 0.107 | sufficient descriptive count |
| Cabbage | 310 | 1.792 | 2.258 | 0.962 | 13.560 | 13.387 | -0.173 | sufficient descriptive count |
| Capsicum | 320 | 1.071 | 1.414 | 0.954 | 6.936 | 6.997 | 0.061 | sufficient descriptive count |
| Carrot | 312 | 1.574 | 1.972 | 0.956 | 10.974 | 10.725 | -0.248 | sufficient descriptive count |
| Cauliflower | 296 | 0.890 | 1.164 | 0.953 | 5.958 | 5.874 | -0.083 | sufficient descriptive count |
| Chilli | 314 | 1.240 | 1.578 | 0.946 | 7.574 | 7.528 | -0.046 | sufficient descriptive count |
| Cucumber | 305 | 0.710 | 0.952 | 0.947 | 4.646 | 4.700 | 0.054 | sufficient descriptive count |
| Garlic | 310 | 5.899 | 7.497 | 0.899 | 24.195 | 23.873 | -0.322 | sufficient descriptive count |
| Ginger | 315 | 3.736 | 4.888 | 0.905 | 15.618 | 15.875 | 0.256 | sufficient descriptive count |
| Grapes | 285 | 0.802 | 1.014 | 0.948 | 5.045 | 5.177 | 0.132 | sufficient descriptive count |
| Guava | 265 | 0.644 | 0.884 | 0.900 | 3.238 | 3.291 | 0.053 | sufficient descriptive count |
| Lemon | 278 | 2.149 | 2.826 | 0.957 | 15.753 | 15.774 | 0.021 | sufficient descriptive count |
| Mango | 287 | 0.636 | 0.819 | 0.948 | 4.158 | 4.219 | 0.061 | sufficient descriptive count |
| Okra | 297 | 0.542 | 0.765 | 0.851 | 2.507 | 2.567 | 0.060 | sufficient descriptive count |
| Onion | 310 | 3.565 | 4.656 | 0.917 | 14.715 | 14.631 | -0.084 | sufficient descriptive count |
| Orange | 306 | 1.759 | 2.210 | 0.962 | 12.607 | 12.775 | 0.167 | sufficient descriptive count |
| Papaya | 278 | 0.567 | 0.748 | 0.941 | 3.437 | 3.414 | -0.023 | sufficient descriptive count |
| Peas | 294 | 0.582 | 0.853 | 0.934 | 3.989 | 4.124 | 0.134 | sufficient descriptive count |
| Pomegranate | 318 | 3.197 | 3.983 | 0.957 | 22.231 | 21.870 | -0.361 | sufficient descriptive count |
| Potato | 282 | 2.124 | 2.712 | 0.893 | 8.375 | 8.128 | -0.247 | sufficient descriptive count |
| Spinach | 319 | 0.552 | 0.767 | 0.664 | 1.736 | 1.759 | 0.023 | sufficient descriptive count |
| Tomato | 332 | 0.581 | 0.787 | 0.909 | 3.260 | 3.396 | 0.136 | sufficient descriptive count |
| Watermelon | 289 | 0.979 | 1.301 | 0.936 | 5.837 | 5.795 | -0.042 | sufficient descriptive count |

Test counts range from 259 to 332; no produce group is below the 30-row descriptive threshold. Higher-error groups by observed MAE include Garlic (5.899 days), Ginger (3.736), Onion (3.565), and Pomegranate (3.197). These are descriptive differences, not causal findings or rankings. Use JSON for full precision.

## 10. Storage-Level Performance

| Storage | Count | MAE | RMSE | R² | Mean actual | Mean predicted | Mean signed error |
|---|---|---|---|---|---|---|---|
| Cold Storage | 1714 | 1.849 | 2.993 | 0.953 | 15.436 | 15.267 | -0.169 |
| Controlled Atmosphere | 601 | 2.073 | 3.251 | 0.961 | 18.517 | 18.140 | -0.378 |
| Open Market | 1120 | 1.053 | 1.781 | 0.137 | 1.471 | 1.552 | 0.081 |
| Refrigerated | 1792 | 1.824 | 3.041 | 0.928 | 12.098 | 12.252 | 0.154 |
| Room Temperature | 2273 | 1.282 | 2.108 | 0.379 | 2.199 | 2.179 | -0.019 |

Storage test counts range from 601 to 2273, so these categories are not low-count groups in this split. Observed mean bias varies by category; see the signed-error column and JSON without causal interpretation.

## 11. Shelf-Life Range Performance

| Range | Count | MAE | RMSE | Mean actual | Mean predicted | Mean signed error |
|---|---|---|---|---|---|---|
| exactly_0_5 | 1313 | 1.091 | 1.824 | 0.500 | 1.589 | 1.089 |
| gt_0_5_to_1 | 497 | 0.665 | 1.256 | 0.756 | 1.359 | 0.603 |
| gt_1_to_2 | 798 | 0.700 | 1.212 | 1.481 | 1.648 | 0.167 |
| gt_2_to_5 | 1415 | 1.067 | 1.605 | 3.391 | 3.365 | -0.027 |
| gt_5_to_10 | 1436 | 1.450 | 2.143 | 7.160 | 6.846 | -0.314 |
| gt_10_to_20 | 1016 | 2.300 | 3.312 | 14.065 | 13.636 | -0.429 |
| gt_20_to_40 | 802 | 2.944 | 4.101 | 27.928 | 27.258 | -0.669 |
| gt_40 | 223 | 5.230 | 6.936 | 53.487 | 50.817 | -2.669 |

Long ranges: >20–40 day MAE 2.944; >40 day MAE 5.230.

## 12. 0.5-Day Analysis

Count 1,313 (17.507% of test); MAE 1.0912; RMSE 1.8240; mean/median prediction 1.5886/1.0267; min/max prediction -0.0928/18.8317; mean signed error 1.0886 days. Full-dataset floor frequency is 8,634/50,000 (17.268%).

Prediction counts: <0 = 2; <0.5 = 19; <1 = 1172.

Overall MAE/RMSE: 1.5703/2.6313. Excluding 0.5 targets: MAE 1.6720, RMSE 2.7725, R² 0.9495. Floor-only MAE/RMSE: 1.0912/1.8240. The floor group is 17.51% of test rows and contributes 12.17% of total absolute error (8.41% of squared error). Its errors are lower than the non-floor subgroup, so the overall score is influenced by this group but is not simply a result of it. Neither result establishes label validity or real-world accuracy.

## 13. Residual Analysis

Residual is prediction − actual. Overall mean -0.0260, median 0.1428, MAE 1.5703, RMSE 2.6313 days.

| Range | Count | MAE | Mean signed error | Bias |
|---|---|---|---|---|
| 0.5_to_1_inclusive | 1810 | 0.974 | 0.955 | overprediction |
| gt_1_to_2 | 798 | 0.700 | 0.167 | overprediction |
| gt_2_to_5 | 1415 | 1.067 | -0.027 | underprediction |
| gt_5_to_10 | 1436 | 1.450 | -0.314 | underprediction |
| gt_10_to_20 | 1016 | 2.300 | -0.429 | underprediction |
| gt_20_to_40 | 802 | 2.944 | -0.669 | underprediction |
| gt_40 | 223 | 5.230 | -2.669 | underprediction |

Positive mean residual means overprediction; negative means underprediction. Bias by produce/storage is provided in sections 9–10. This audit does not infer causal reasons.

## 14. Prediction Range Analysis

Minimum -0.2166; maximum 108.3291; below zero 2; below 0.5 19; above dataset maximum 133.47 0. Negative output is physically implausible and needs application-layer handling or a future model revision; this audit did not change predictions or model files.

## 15. Error Percentiles

Absolute error percentiles (days): {"50": 0.8389102220535279, "75": 1.8918463706970212, "90": 3.7549382686615007, "95": 5.528065666198727, "99": 10.433847370147706}; maximum 23.5855. Signed residual percentiles (days): {"1": -8.706681589889527, "25": -0.818095371723174, "5": -4.197867892980575, "50": 0.14280239820480345, "75": 0.8523239958286295, "95": 3.4740297694206235, "99": 7.6772468009948875}.

## 16. Bootstrap Confidence Intervals

Percentile bootstrap over the fixed test rows, 1,000 resamples, seed 42:

| Metric | Point estimate | 95% bootstrap CI |
|---|---:|---:|
| MAE (days) | 1.5703 | [1.5215, 1.6168] |
| RMSE (days) | 2.6313 | [2.5159, 2.7331] |

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

**NOT READY FOR PRODUCTION INTEGRATION**

V1 is reproducible on this dataset, but unknown provenance and target semantics, lack of independent validation, possible random-split similarity, negative predictions, increasing long-tail error, and production input mismatch do not justify production integration. The dataset result MAE of 1.570 days must not be presented as real-world shelf-life accuracy.

## 22. Recommended Next Step

Obtain provenance-backed, independently measured longitudinal shelf-life data with specimen/batch identifiers and documented failure criteria. Define a group- or time-based holdout, validate all eight production inputs against source distributions, then assess calibration, nonnegative behavior, and subgroup performance before any controlled integration review.
