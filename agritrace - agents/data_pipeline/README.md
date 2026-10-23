# Shelf-Life Dataset Pipeline

Run from the repository root:

```powershell
python -m data_pipeline.build_dataset
```

The pipeline reads only locally available source files. Optional external inputs are expected at:

- `data/external/dryad_tomato_normalized.csv`
- `data/external/zenodo_tomato.xlsx`
- `data/external/mendeley_spoilage.csv`

The optional Dryad CSV must expose the explicitly verified columns `sample_id`, `observation_day`, `failure_day`, `temperature_c`, and `humidity_rh`. The adapter will not infer those fields from arbitrary workbook headers.

Outputs:

- `data/processed/agritrace_master_shelf_life.csv`
- `data/processed/agritrace_auxiliary_postharvest.csv`
- `data/processed/data_quality_report.md`
- `data/processed/master_data_dictionary.md`
- `data/processed/validation_report.json`

No model training or production inference changes are performed.
