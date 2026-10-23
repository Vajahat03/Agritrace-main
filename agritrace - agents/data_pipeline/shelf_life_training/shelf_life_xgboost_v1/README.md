# Isolated shelf-life XGBoost experiment

This is a development-only experiment. It does not modify or connect to the existing AgriTrace production model, API, agent, frontend, or inference code.

Run training from the repository root with:

```powershell
.\.venv-shelflife\Scripts\python.exe data_pipeline\shelf_life_training\shelf_life_xgboost_v1\train.py
```

The script uses the root-level `shelf life prediction dataset.xlsx.csv`, validates its schema and required values, creates a seeded 70/15/15 split, selects among three fixed XGBoost configurations using validation MAE, and evaluates the selected configuration once on the held-out test set. It refuses to overwrite existing artifacts.

Use `predict.predict(...)` for the eight logical input fields. The wrapper loads the saved feature manifest, fitted preprocessing transformer, and XGBoost model from this directory. See `model_card.md` for evaluation and dataset limitations.
