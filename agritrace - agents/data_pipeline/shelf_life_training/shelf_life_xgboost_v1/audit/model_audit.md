# Shelf-Life XGBoost v1 Model Audit

## Executive Summary

The saved model and preprocessor load and reproduce the recorded held-out test metrics when the training split is reconstructed. The model has 900 boosting rounds and 36 transformed inputs, matching the training config and feature manifest. It is technically functional as a development artifact, but is not production-ready. Dataset provenance and label validity remain undocumented. The 0.5-day group is distinguishable from the rest by input distributions, but the available table does not establish why those labels equal 0.5; the reason is **Undetermined from available data.**

## Dataset Findings

The audited CSV has 50,000 rows, 9 columns and SHA-256 `d30663ca50d45c40025f61aa8fa925ae3d68e714a1c1a143543ef74c4b67f1af`. Target summary: count 50,000, min 0.50, max 133.47, mean 8.5154, median 4.28, sample standard deviation 11.4116, Q1 1.08, Q3 10.62.

The bins below are descriptive error-analysis bands, not scientific categories.

| Range | Count | Percent |
|---|---|---|
| 0.5 day | 8634 | 17.268% |
| >0.5 to 1 day | 3382 | 6.764% |
| >1 to 2 days | 5521 | 11.042% |
| >2 to 3 days | 3681 | 7.362% |
| >3 to 5 days | 5801 | 11.602% |
| >5 to 7 days | 4843 | 9.686% |
| >7 to 14 days | 8478 | 16.956% |
| >14 to 30 days | 6623 | 13.246% |
| >30 days | 3037 | 6.074% |

## 0.5-Day Floor Analysis

There are 8,634 floor rows (17.268%) and 41,366 rows above the floor. Input distributions differ; for example, floor rows have mean temperature 26.545°C versus 12.221°C above the floor, and mean defect probability 0.7156 versus 0.5296. These associations do not establish a labeling mechanism.

Classification: **Undetermined from available data.** The exact repeated value is compatible with a floor, category, or generated rule, but the dataset contains no documentation or independent observations that identify which explanation is correct.

### Numerical input distributions

Each numeric group cell lists count; mean; sample SD; Q1; median; Q3; min–max.

| Feature | Floor distribution | Above-floor distribution |
|---|---|---|
| freshness_score | 8634; 60.009; 14.391; 51.640; 62.595; 70.570; 15.000–92.750 | 41366; 73.521; 14.247; 65.360; 75.540; 84.030; 15.000–99.000 |
| quality_score | 8634; 62.760; 11.164; 55.810; 63.970; 70.790; 15.270–94.470 | 41366; 74.103; 12.102; 66.460; 75.150; 83.030; 20.360–100.000 |
| defect_probability | 8634; 0.716; 0.109; 0.639; 0.707; 0.785; 0.355–0.950 | 41366; 0.530; 0.141; 0.425; 0.518; 0.623; 0.146–0.950 |
| temperature_c | 8634; 26.545; 4.919; 24.520; 26.785; 29.587; 0.000–37.690 | 41366; 12.221; 10.617; 3.980; 6.540; 24.300; 0.000–37.340 |
| humidity_rh | 8634; 42.451; 9.267; 35.000; 40.210; 46.130; 35.000–98.000 | 41366; 70.261; 21.560; 47.950; 75.250; 88.910; 35.000–98.000 |
| harvest_age_days | 8634; 5.463; 3.606; 2.780; 4.640; 7.428; 0.200–26.560 | 41366; 4.384; 3.060; 2.100; 3.640; 5.940; 0.200–24.670 |

### `produce_type`

Floor rows:

| Category | Count | Share within floor |
|---|---|---|
| Apple | 234 | 2.71% |
| Banana | 446 | 5.17% |
| Brinjal | 445 | 5.15% |
| Cabbage | 222 | 2.57% |
| Capsicum | 304 | 3.52% |
| Carrot | 232 | 2.69% |
| Cauliflower | 288 | 3.34% |
| Chilli | 293 | 3.39% |
| Cucumber | 351 | 4.07% |
| Garlic | 314 | 3.64% |
| Ginger | 339 | 3.93% |
| Grapes | 340 | 3.94% |
| Guava | 413 | 4.78% |
| Lemon | 228 | 2.64% |
| Mango | 374 | 4.33% |
| Okra | 526 | 6.09% |
| Onion | 359 | 4.16% |
| Orange | 217 | 2.51% |
| Papaya | 417 | 4.83% |
| Peas | 383 | 4.44% |
| Pomegranate | 194 | 2.25% |
| Potato | 372 | 4.31% |
| Spinach | 600 | 6.95% |
| Tomato | 437 | 5.06% |
| Watermelon | 306 | 3.54% |

Above-floor rows:

| Category | Count | Share above floor |
|---|---|---|
| Apple | 1772 | 4.28% |
| Banana | 1609 | 3.89% |
| Brinjal | 1634 | 3.95% |
| Cabbage | 1810 | 4.38% |
| Capsicum | 1719 | 4.16% |
| Carrot | 1762 | 4.26% |
| Cauliflower | 1689 | 4.08% |
| Chilli | 1737 | 4.20% |
| Cucumber | 1669 | 4.03% |
| Garlic | 1664 | 4.02% |
| Ginger | 1635 | 3.95% |
| Grapes | 1643 | 3.97% |
| Guava | 1566 | 3.79% |
| Lemon | 1688 | 4.08% |
| Mango | 1598 | 3.86% |
| Okra | 1544 | 3.73% |
| Onion | 1554 | 3.76% |
| Orange | 1808 | 4.37% |
| Papaya | 1529 | 3.70% |
| Peas | 1608 | 3.89% |
| Pomegranate | 1817 | 4.39% |
| Potato | 1645 | 3.98% |
| Spinach | 1368 | 3.31% |
| Tomato | 1558 | 3.77% |
| Watermelon | 1740 | 4.21% |
### `storage_type`

Floor rows:

| Category | Count | Share within floor |
|---|---|---|
| Cold Storage | 77 | 0.89% |
| Controlled Atmosphere | 14 | 0.16% |
| Open Market | 3480 | 40.31% |
| Refrigerated | 168 | 1.95% |
| Room Temperature | 4895 | 56.69% |

Above-floor rows:

| Category | Count | Share above floor |
|---|---|---|
| Cold Storage | 10950 | 26.47% |
| Controlled Atmosphere | 3983 | 9.63% |
| Open Market | 4060 | 9.81% |
| Refrigerated | 12171 | 29.42% |
| Room Temperature | 10202 | 24.66% |

## Prediction Range Analysis

The untouched test prediction range was -0.2166 to 108.3291 days. Below zero: 2 (0.027%); below 0.5: 19 (0.253%); from 0 inclusive to below 0.5: 17 (0.227%); at least 0.5: 7,481 (99.747%). Categories overlap as stated: the below-zero count is included in below-0.5.

## Performance by Shelf-Life Range

| Target range | n | MAE | RMSE | R² | Mean actual | Mean predicted | Mean signed error |
|---|---|---|---|---|---|---|---|
| target_le_0_5 | 1313 | 1.091 | 1.824 | — | 0.500 | 1.589 | 1.089 |
| gt_0_5_to_2 | 1295 | 0.687 | 1.229 | -7.228 | 1.203 | 1.537 | 0.334 |
| gt_2_to_5 | 1415 | 1.067 | 1.605 | -2.303 | 3.391 | 3.365 | -0.027 |
| gt_5_to_10 | 1436 | 1.450 | 2.143 | -1.346 | 7.160 | 6.846 | -0.314 |
| gt_10_to_20 | 1016 | 2.300 | 3.312 | -0.302 | 14.065 | 13.636 | -0.429 |
| gt_20_to_40 | 802 | 2.944 | 4.101 | 0.435 | 27.928 | 27.258 | -0.669 |
| gt_40 | 223 | 5.230 | 6.936 | 0.706 | 53.487 | 50.817 | -2.669 |

R² is omitted when a group has insufficient observations or no target variation.

## Performance by Produce Type

| Produce | n | MAE | RMSE | R² | Mean actual | Mean predicted |
|---|---|---|---|---|---|---|
| Apple | 259 | 2.196 | 2.758 | 0.959 | 15.925 | 15.518 |
| Banana | 310 | 0.546 | 0.726 | 0.935 | 3.295 | 3.371 |
| Brinjal | 309 | 0.631 | 0.943 | 0.885 | 3.316 | 3.423 |
| Cabbage | 310 | 1.792 | 2.258 | 0.962 | 13.560 | 13.387 |
| Capsicum | 320 | 1.071 | 1.414 | 0.954 | 6.936 | 6.997 |
| Carrot | 312 | 1.574 | 1.972 | 0.956 | 10.974 | 10.725 |
| Cauliflower | 296 | 0.890 | 1.164 | 0.953 | 5.958 | 5.874 |
| Chilli | 314 | 1.240 | 1.578 | 0.946 | 7.574 | 7.528 |
| Cucumber | 305 | 0.710 | 0.952 | 0.947 | 4.646 | 4.700 |
| Garlic | 310 | 5.899 | 7.497 | 0.899 | 24.195 | 23.873 |
| Ginger | 315 | 3.736 | 4.888 | 0.905 | 15.618 | 15.875 |
| Grapes | 285 | 0.802 | 1.014 | 0.948 | 5.045 | 5.177 |
| Guava | 265 | 0.644 | 0.884 | 0.900 | 3.238 | 3.291 |
| Lemon | 278 | 2.149 | 2.826 | 0.957 | 15.753 | 15.774 |
| Mango | 287 | 0.636 | 0.819 | 0.948 | 4.158 | 4.219 |
| Okra | 297 | 0.542 | 0.765 | 0.851 | 2.507 | 2.567 |
| Onion | 310 | 3.565 | 4.656 | 0.917 | 14.715 | 14.631 |
| Orange | 306 | 1.759 | 2.210 | 0.962 | 12.607 | 12.775 |
| Papaya | 278 | 0.567 | 0.748 | 0.941 | 3.437 | 3.414 |
| Peas | 294 | 0.582 | 0.853 | 0.934 | 3.989 | 4.124 |
| Pomegranate | 318 | 3.197 | 3.983 | 0.957 | 22.231 | 21.870 |
| Potato | 282 | 2.124 | 2.712 | 0.893 | 8.375 | 8.128 |
| Spinach | 319 | 0.552 | 0.767 | 0.664 | 1.736 | 1.759 |
| Tomato | 332 | 0.581 | 0.787 | 0.909 | 3.260 | 3.396 |
| Watermelon | 289 | 0.979 | 1.301 | 0.936 | 5.837 | 5.795 |

## Performance by Storage Type

| Storage | n | MAE | RMSE | R² | Mean actual | Mean predicted |
|---|---|---|---|---|---|---|
| Cold Storage | 1714 | 1.849 | 2.993 | 0.953 | 15.436 | 15.267 |
| Controlled Atmosphere | 601 | 2.073 | 3.251 | 0.961 | 18.517 | 18.140 |
| Open Market | 1120 | 1.053 | 1.781 | 0.137 | 1.471 | 1.552 |
| Refrigerated | 1792 | 1.824 | 3.041 | 0.928 | 12.098 | 12.252 |
| Room Temperature | 2273 | 1.282 | 2.108 | 0.379 | 2.199 | 2.179 |

## Feature/Target Analysis

Numerical-feature correlations on the full dataset:

| Feature | Pearson | Spearman |
|---|---|---|
| freshness_score | 0.3657 | 0.5014 |
| quality_score | 0.2895 | 0.4475 |
| defect_probability | -0.6227 | -0.7727 |
| temperature_c | -0.5258 | -0.6836 |
| humidity_rh | 0.5279 | 0.6986 |
| harvest_age_days | -0.1381 | -0.1424 |

These are associations only; they do not show causality. Categorical target summaries follow.

### `produce_type`

| Category | n | Mean target | Median | Min | Max |
|---|---|---|---|---|---|
| Apple | 2006 | 15.301 | 10.615 | 0.500 | 62.890 |
| Banana | 2055 | 3.191 | 2.110 | 0.500 | 12.090 |
| Brinjal | 2079 | 3.325 | 2.360 | 0.500 | 13.760 |
| Cabbage | 2032 | 13.084 | 9.820 | 0.500 | 52.600 |
| Capsicum | 2023 | 7.527 | 5.450 | 0.500 | 31.260 |
| Carrot | 1994 | 11.074 | 8.585 | 0.500 | 42.960 |
| Cauliflower | 1977 | 5.880 | 4.280 | 0.500 | 23.580 |
| Chilli | 2030 | 7.560 | 5.630 | 0.500 | 29.160 |
| Cucumber | 2020 | 4.711 | 3.335 | 0.500 | 18.420 |
| Garlic | 1978 | 22.779 | 15.240 | 0.500 | 133.470 |
| Ginger | 1974 | 15.312 | 10.135 | 0.500 | 88.700 |
| Grapes | 1983 | 4.803 | 3.580 | 0.500 | 18.380 |
| Guava | 1979 | 3.337 | 2.500 | 0.500 | 13.080 |
| Lemon | 1916 | 14.930 | 11.080 | 0.500 | 61.990 |
| Mango | 1972 | 4.028 | 2.790 | 0.500 | 16.350 |
| Okra | 2070 | 2.456 | 1.755 | 0.500 | 10.110 |
| Onion | 1913 | 14.324 | 9.450 | 0.500 | 79.370 |
| Orange | 2025 | 12.579 | 9.290 | 0.500 | 51.150 |
| Papaya | 1946 | 3.466 | 2.285 | 0.500 | 14.600 |
| Peas | 1991 | 3.911 | 2.900 | 0.500 | 14.620 |
| Pomegranate | 2011 | 20.870 | 15.400 | 0.500 | 78.740 |
| Potato | 2017 | 8.568 | 5.760 | 0.500 | 59.650 |
| Spinach | 1968 | 1.738 | 1.290 | 0.500 | 7.200 |
| Tomato | 1995 | 3.215 | 2.480 | 0.500 | 12.680 |
| Watermelon | 2046 | 5.710 | 3.930 | 0.500 | 23.080 |
### `storage_type`

| Category | n | Mean target | Median | Min | Max |
|---|---|---|---|---|---|
| Cold Storage | 11027 | 15.039 | 10.080 | 0.500 | 124.160 |
| Controlled Atmosphere | 3997 | 18.376 | 12.220 | 0.500 | 133.470 |
| Open Market | 7540 | 1.539 | 0.640 | 0.500 | 30.550 |
| Refrigerated | 12339 | 11.550 | 7.710 | 0.500 | 90.330 |
| Room Temperature | 15097 | 2.143 | 1.150 | 0.500 | 27.260 |

## Potential Leakage

No column beyond the specified eight inputs was used for modeling. Repeated-input analysis found 50,000 unique eight-input combinations from 50,000 rows; 0 combinations repeat (additional repeated rows: 0). Repeated groups with one target value: 0; groups with different targets: 0. Exact full-row duplicates: 0. Since every input vector occurs only once, this dataset cannot directly test whether repeated identical vectors map to repeated or differing targets. No direct target column was among the predictors. Strong associations and prior formula-like findings raise a potential generation/leakage concern, but do not prove leakage.

## Potential Synthetic-Data Indicators

    The source provenance is undocumented. The target has 4,774 unique values; decimal-digit counts are `{"1": 12633, "2": 37367}`. There are 125 observed produce/storage pairs out of 125 possible pairs, and exactly 8,634 labels equal 0.5. Prior exploratory work in this project found strong model fit and formula-like structure, while the current audit confirms labels are highly repeated at the floor and rounded to limited decimal precision. Those patterns are consistent with algorithmic generation but are not proof. **No definitive conclusion can be made from the available dataset.**

## Generalization Limitations

The 70/15/15 shuffled row split may overestimate generalization if records share an unobserved specimen, batch, source, or common generation rule. This dataset has no specimen/group identifier available to enforce group isolation. Random test performance therefore describes interpolation within this file, not performance on new harvests, studies, suppliers, or real-world storage conditions. No retraining or official metric change was made during this audit.

## Negative Prediction Issue

The model is an unconstrained regressor and predicts negative days for 2 test rows. Negative remaining shelf life is outside the plausible nonnegative target domain and should be addressed in a future model-development step. This audit did not clamp predictions or change any model artifact.

## Overall Technical Assessment

Artifact integrity check: recomputed test MAE 1.5703, RMSE 2.6313, R² 0.9506; the values match the saved metrics within numeric tolerance. The development model loads and runs. However, the unknown target provenance, prominent exact 0.5-day mass, limited label precision, and random row split prevent treating these metrics as evidence of real-world validity. The floor mechanism is **Undetermined from available data**; synthetic generation is plausible but unproven; direct target leakage is not demonstrated, while dataset-generation structure remains a potential concern.
