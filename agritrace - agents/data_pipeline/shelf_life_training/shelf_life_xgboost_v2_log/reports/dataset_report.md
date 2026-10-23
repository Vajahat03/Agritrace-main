# Dataset Report

- File: `shelf life prediction dataset.xlsx.csv`
- Rows: 50,000
- Columns: 9
- Missing values: 0
- Exact duplicate rows: 0
- Unique predictor vectors: 50,000
- SHA-256: `d30663ca50d45c40025f61aa8fa925ae3d68e714a1c1a143543ef74c4b67f1af`

Original target: min 0.50, max 133.47, mean 8.515354, median 4.28, SD 11.411589, Q1 1.08, Q3 10.62.

Exact 0.5 count: 8,634; below 0.5: 0; exact 1.0: 48. Target values were not altered in the source or for day-unit evaluation; training used `log1p(y)`.
