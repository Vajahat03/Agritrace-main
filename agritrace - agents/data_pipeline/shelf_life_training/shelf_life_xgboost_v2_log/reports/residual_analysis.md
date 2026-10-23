# V2-Log Residual Analysis

Residual is `prediction − actual` in days; positive values indicate overprediction and negative values underprediction. No causal interpretation is intended.

Overall: n=7500; mean residual -0.3556; median residual 0.0148; MAE 1.5909; RMSE 2.7956.

## By Produce Type

| Produce | n | MAE | Mean signed error | Pattern |
|---|---:|---:|---:|---|
| Apple | 259 | 2.328 | -0.801 | underprediction |
| Banana | 310 | 0.527 | 0.001 | overprediction |
| Brinjal | 309 | 0.569 | 0.028 | overprediction |
| Cabbage | 310 | 1.909 | -0.585 | underprediction |
| Capsicum | 320 | 1.037 | -0.142 | underprediction |
| Carrot | 312 | 1.600 | -0.568 | underprediction |
| Cauliflower | 296 | 0.873 | -0.185 | underprediction |
| Chilli | 314 | 1.252 | -0.238 | underprediction |
| Cucumber | 305 | 0.688 | 0.003 | overprediction |
| Garlic | 310 | 6.219 | -2.179 | underprediction |
| Ginger | 315 | 3.798 | -0.620 | underprediction |
| Grapes | 285 | 0.774 | 0.072 | overprediction |
| Guava | 265 | 0.614 | -0.024 | underprediction |
| Lemon | 278 | 2.083 | -0.421 | underprediction |
| Mango | 287 | 0.598 | -0.027 | underprediction |
| Okra | 297 | 0.516 | -0.037 | underprediction |
| Onion | 310 | 3.684 | -1.040 | underprediction |
| Orange | 306 | 1.781 | -0.108 | underprediction |
| Papaya | 278 | 0.549 | -0.061 | underprediction |
| Peas | 294 | 0.576 | 0.086 | overprediction |
| Pomegranate | 318 | 3.345 | -1.141 | underprediction |
| Potato | 282 | 2.134 | -0.735 | underprediction |
| Spinach | 319 | 0.513 | -0.062 | underprediction |
| Tomato | 332 | 0.529 | 0.050 | overprediction |
| Watermelon | 289 | 0.969 | -0.081 | underprediction |

## By Storage Type

| Storage | n | MAE | Mean signed error | Pattern |
|---|---:|---:|---:|---|
| Cold Storage | 1714 | 1.934 | -0.426 | underprediction |
| Controlled Atmosphere | 601 | 2.051 | -0.747 | underprediction |
| Open Market | 1120 | 1.004 | -0.199 | underprediction |
| Refrigerated | 1792 | 1.870 | -0.204 | underprediction |
| Room Temperature | 2273 | 1.279 | -0.396 | underprediction |

## By Target Range

| Range | n | MAE | Mean signed error | Pattern |
|---|---:|---:|---:|---|
| exactly_0_5 | 1313 | 0.819 | 0.818 | overprediction |
| gt_0_5_to_1 | 497 | 0.519 | 0.445 | overprediction |
| gt_1_to_2 | 798 | 0.615 | -0.035 | underprediction |
| gt_2_to_5 | 1415 | 1.081 | -0.312 | underprediction |
| gt_5_to_10 | 1436 | 1.548 | -0.594 | underprediction |
| gt_10_to_20 | 1016 | 2.425 | -0.863 | underprediction |
| gt_20_to_40 | 802 | 3.199 | -1.134 | underprediction |
| gt_40 | 223 | 5.951 | -3.829 | underprediction |
