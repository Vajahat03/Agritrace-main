# Shelf-Life XGBoost V2

This is an isolated development experiment. It does not connect to or replace the AgriTrace production model or V1.

Run from the repository root with:

```powershell
.\.venv-shelflife\Scripts\python.exe data_pipeline\shelf_life_training\shelf_life_xgboost_v2\train.py
```

The user's clarified recode maps targets below 0.5 to 0 and targets at or above 0.5 to 1. The source data has no rows below 0.5; consequently, all 50,000 V2 targets equal 1.0. The resulting fitted model is a constant-target regression artifact, not a useful shelf-life predictor. The report records this limitation and undefined test R².

`predict.py` is an isolated wrapper for exercising the saved artifacts only.
