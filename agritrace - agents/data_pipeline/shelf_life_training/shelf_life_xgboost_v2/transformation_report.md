# V2 Derived Dataset Transformation Report

The clarified target rule was applied to the development copy only: values below 0.5 become 0.0; values at or above 0.5 become 1.0. The original dataset has no values below 0.5, so all derived targets equal 1.0. This differs from the initial instruction to change only exact 0.5 rows; the user's later clarification explicitly selected the broader recoding.

- Original rows: 50,000
- Derived rows: 50,000
- Original columns: 9
- Derived columns: 9
- Original 0.5-day rows: 8,634
- Converted exact 0.5 rows to 1.0: 8,634
- Original 1.0-day rows: 48
- Derived 1.0-day rows: 50,000
- Original targets above 0.5: 41,366
- Original targets below 0.5: 0
- Additional non-0.5 targets changed by the clarified rule: 41,318
- Predictor values changed: 0
- Target values changed: 49,952
- Derived minimum target: 1.0
- Derived rows below 1.0: 0
- Original SHA-256 (unchanged): `d30663ca50d45c40025f61aa8fa925ae3d68e714a1c1a143543ef74c4b67f1af`
- Derived SHA-256: `7b9f77481cdf2223fd544de9d330ec458869bcdbed912fa7ebbd6a0ad95f9242`
