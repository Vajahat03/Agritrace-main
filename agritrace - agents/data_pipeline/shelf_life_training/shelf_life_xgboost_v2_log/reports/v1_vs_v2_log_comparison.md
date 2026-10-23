# V1 vs V2-Log Comparison

Both models were evaluated against the same original target values on the same 7,500 test rows. V1 predicts the original target directly; V2-Log predicts `log1p(y)` and applies `expm1` for day-unit evaluation. Differences are descriptive and do not declare a winner.

| Metric | V1 | V2-Log |
|---|---:|---:|
| MAE | 1.5703 | 1.5909 |
| RMSE | 2.6313 | 2.7956 |
| R² | 0.9506 | 0.9442 |
| Median Absolute Error | 0.8389 | 0.8107 |
| Maximum Absolute Error | 23.5855 | 38.1192 |
| ±0.5 day | 34.1467 | 36.2133 |
| ±1 day | 55.5200 | 56.9467 |
| ±2 days | 76.2533 | 76.7733 |
| ±3 days | 85.7467 | 85.5867 |

The ± threshold rows are percentages of test predictions within that absolute error in days.

- V1 0.5-day group: n=1313, MAE=1.0912, RMSE=1.8240; V2-Log: MAE=0.8185, RMSE=1.3739.
- V1 excluding 0.5: MAE=1.6720, RMSE=2.7725, R²=0.9495; V2-Log: MAE=1.7548, RMSE=3.0123, R²=0.9403.
- Prediction range: V1 -0.2166–108.3291; V2-Log 0.4274–96.7384.
- Negative predictions: V1 2; V2-Log 0. Below 0.5: V1 19; V2-Log 8. Below 1: V1 1172; V2-Log 1438.

## Shelf-Life Range Comparison

| Range | n | V1 MAE | V2-Log MAE | V1 RMSE | V2-Log RMSE | V1 signed bias | V2-Log signed bias |
|---|---:|---:|---:|---:|---:|---:|---:|
| exactly_0_5 | 1313 | 1.091 | 0.819 | 1.824 | 1.374 | 1.089 | 0.818 |
| gt_0_5_to_1 | 497 | 0.665 | 0.519 | 1.256 | 0.992 | 0.603 | 0.445 |
| gt_1_to_2 | 798 | 0.700 | 0.615 | 1.212 | 0.984 | 0.167 | -0.035 |
| gt_2_to_5 | 1415 | 1.067 | 1.081 | 1.605 | 1.531 | -0.027 | -0.312 |
| gt_5_to_10 | 1436 | 1.450 | 1.548 | 2.143 | 2.293 | -0.314 | -0.594 |
| gt_10_to_20 | 1016 | 2.300 | 2.425 | 3.312 | 3.559 | -0.429 | -0.863 |
| gt_20_to_40 | 802 | 2.944 | 3.199 | 4.101 | 4.452 | -0.669 | -1.134 |
| gt_40 | 223 | 5.230 | 5.951 | 6.936 | 8.268 | -2.669 | -3.829 |

V1 was reproduced against its saved metrics on these test rows. A smaller error in one subgroup does not establish overall or real-world superiority.
