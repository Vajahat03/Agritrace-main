# V2-Log Feature Analysis

Correlations and gain importance are descriptive, not causal. Correlations use the full source dataset; gain importance is from the trained V2-Log model.

## Numerical Feature / Target Correlations

| Feature | Pearson | Spearman |
|---|---:|---:|
| freshness_score | 0.3657 | 0.5014 |
| quality_score | 0.2895 | 0.4475 |
| defect_probability | -0.6227 | -0.7727 |
| temperature_c | -0.5258 | -0.6836 |
| humidity_rh | 0.5279 | 0.6986 |
| harvest_age_days | -0.1381 | -0.1424 |

## Aggregated Feature-Group Gain Importance

| Feature group | Gain | Share |
|---|---:|---:|
| produce_type | 159.633 | 77.295% |
| temperature_c | 18.836 | 9.121% |
| storage_type | 14.340 | 6.944% |
| defect_probability | 7.238 | 3.504% |
| humidity_rh | 3.275 | 1.586% |
| freshness_score | 1.310 | 0.634% |
| quality_score | 1.219 | 0.590% |
| harvest_age_days | 0.675 | 0.327% |

## Top Transformed Features

| Transformed feature | Gain |
|---|---:|
| numeric__temperature_c | 18.836 |
| categorical__produce_type_Spinach | 18.413 |
| categorical__produce_type_Garlic | 16.650 |
| categorical__produce_type_Onion | 14.305 |
| categorical__produce_type_Ginger | 12.510 |
| categorical__produce_type_Okra | 12.258 |
| categorical__produce_type_Tomato | 10.867 |
| categorical__produce_type_Brinjal | 10.282 |
| categorical__produce_type_Guava | 9.220 |
| categorical__produce_type_Cabbage | 7.238 |
| numeric__defect_probability | 7.238 |
| categorical__produce_type_Pomegranate | 7.205 |
| categorical__produce_type_Lemon | 6.580 |
| categorical__produce_type_Banana | 6.329 |
| categorical__storage_type_Refrigerated | 6.239 |
| categorical__produce_type_Potato | 5.668 |
| categorical__storage_type_Controlled Atmosphere | 5.609 |
| categorical__produce_type_Papaya | 4.550 |
| categorical__produce_type_Apple | 3.747 |
| numeric__humidity_rh | 3.275 |
| categorical__produce_type_Mango | 2.729 |
| categorical__produce_type_Orange | 2.416 |
| categorical__produce_type_Chilli | 2.154 |
| categorical__produce_type_Carrot | 1.588 |
| categorical__produce_type_Cauliflower | 1.510 |
