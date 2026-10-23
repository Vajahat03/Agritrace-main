# Shelf-Life Dataset Acquisition

## Outcome

No dataset was acquired or approved for regression training in this pass. Existing pipeline outputs were not changed. Numeric regression rows remain 0; the 43,529 auxiliary records remain as they were.

## Candidate 1: Dryad tomato fruit quality / heterosis

- **Official source:** https://doi.org/10.5061/dryad.p2ngf1vpp
- **Research source:** Rodriguez et al. (2022), *Journal of Experimental Botany*, https://doi.org/10.1093/jxb/erab222
- **Official files listed:** `FORTUNY-et-al-2021__JXB_JEXBOT2021304210_Raw-Data_README.txt` (14.20 KB) and `Fortuny-et-al-2021_Tomato-fruit-quality-traits-and-metabolite-content-are-affected-by-reciprocal-effect-and-heterosis_RawData.xls` (3.32 MB).
- **Acquisition result:** Both official Dryad file links returned HTTP 403 Forbidden. Stopped this candidate. No mirror or bypass was attempted.
- **Downloaded files / checksums / sizes on disk:** None; no checksum applies. The sizes above are Dryad landing-page metadata, not local file measurements.
- **Workbook sheets, row counts, exact column names, types, missing values, duplicate count:** Not inspected because file bytes were inaccessible.
- **Source-described target:** Shelf life (SL), defined as days from harvest until first visible deterioration symptoms, on tomatoes stored at 25 ± 3 °C. The study describes at least eight fruits per plant/genotype and traits including weight, height, diameter, shape index, firmness, and shelf life. Temperature is given; humidity and target file granularity are not established by the accessible text.
- **Target units/statistics/missing target count:** Days are the described unit; min, max, median, missingness, and usable row count cannot be calculated without the workbook.
- **Production-feature mapping:** Source-described data includes produce type (tomato), physical weight/height/diameter/firmness and genotype/cultivar; no confirmed freshness score, quality score, defect probability, humidity, harvest age, or storage-type fields. Do not impute these.
- **Grouping / leakage:** The paper describes fruits nested within plant/genotype. Exact specimen IDs and whether raw rows are fruit-level could not be confirmed. If acquired and suitable, split/group by fruit; if fruit IDs are absent, establish a defensible biological replicate grouping before splitting.
- **Target status:** Strong source-defined measured endpoint, but **not file-verified**. Not approved for regression training.

## Candidate 2: Hass avocado ripening dataset (conditional follow-up)

- **Official source:** https://doi.org/10.17632/3xd9n945v8.1
- **Repository-described contents:** 14,710 JPEGs, Excel metadata, 478 Hass avocados; listed metadata fields include image filename, sample number, storage group, Ripening Index, experiment day, and photographed side. Stage 4 is the documented end of optimal shelf life. T10 is 10 °C/85% RH; T20 is 20 °C/85% RH; ambient conditions are not numerically specified.
- **Acquisition result:** No file downloaded. The official repository page is readable. The documented Mendeley public-files API route was attempted and returned `Unauthorized (no suitable authorization credentials were provided)`. Stopped without attempting to bypass authentication.
- **File, checksum, size, sheet names, exact columns, row counts, target statistics:** Not available because the workbook bytes were not obtained.
- **Potential target:** Only after inspection, `failure_day` may be defined as the first recorded stage-4 day for each sample, and `remaining_shelf_life_days = failure_day - observation_day`. These values have not been derived. Fruits with no observed stage 4 would be censored and must not receive an invented endpoint.
- **Coverage / repeats / censoring:** Repository states daily photos, two sides per sample. Actual repeated rows, unique fruit count in the workbook, how many fruits reached stage 4, full-trajectory count, and censored count are unverified.
- **Production-feature mapping:** Produce type, storage group, day, stage, temperature/RH (for controlled groups) are repository-described. Freshness score, quality score, defect probability, harvest age, and storage type are not confirmed. Do not invent mappings.
- **Target status:** Defensible source-described longitudinal endpoint, but **not file-verified**. Not approved for regression training.

## Training and data handling

- No model was trained; XGBoost training was not run.
- No training rows were prepared, and no candidate data was integrated into the pipeline.
- If the avocado workbook becomes officially accessible, inspect its actual rows first, preserve censoring, and keep every fruit/sample wholly within one train/validation/test split. Never split images or observations from the same fruit across splits.
- If the Dryad workbook becomes officially accessible, verify target granularity and specimen IDs before deciding on a sample-level split. For one-row-per-fruit data, use a documented grouped/random split appropriate to its genotype and plant structure.

## Exact next step

Obtain an authorized, ordinary official download for the Dryad raw XLS and README, or the Mendeley workbook through its official public download UI/API with valid authorization. Then record local file hashes/sizes and inspect workbook sheets, rows, columns, types, missingness, target distribution, target units, and specimen structure before considering approval. Until those checks pass, valid regression rows remain 0 and training remains blocked.
