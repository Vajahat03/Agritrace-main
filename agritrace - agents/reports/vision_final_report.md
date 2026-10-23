# AgriTrace Vision-D121 — Comprehensive Test Evaluation Report

**Model Name**: AgriTrace Vision-D121  
**Architecture**: DenseNet-121 Multi-Task Backbone  
**Checkpoint**: `models/vision/agritrace_vision_d121_best.pt`  
**Evaluation Dataset**: Real Held-Out Test Split (Specimen-Isolated, N=4873)  
**Synthetic Images Used**: 0 (Strictly Real Agricultural Data)  
**Evaluation Timestamp**: 2026-09-05T20:17:35Z  

---

## 1. Multi-Task Measured Performance Summary

| Task | Primary Metric | Measured Result | Status |
| :--- | :--- | :--- | :--- |
| **Produce Classification** | Top-1 Accuracy / Macro F1 | **94.86%** (F1: 0.971) | EVALUATED |
| **Freshness Grade** | 4-Class Accuracy / Macro F1 | **93.39%** (F1: 0.889) | EVALUATED |
| **Freshness Ordinal Error** | Mean Absolute Class Error | **0.103 classes** | EVALUATED |
| **Quality Score Regressor** | MAE / RMSE / R² | **MAE 5.71 / R² 0.905** | EVALUATED |
| **Defect Diagnosis** | 6-Class Accuracy / Macro F1 | **100.0%** (F1: 1.0) | EVALUATED |
| **Confidence Calibration** | Test ECE (T=0.876) | **0.0121 ECE** (Uncal: 0.0234) | EVALUATED |
| **OOD Detection** | AUROC / FPR@95%TPR | **0.6716 AUROC** (FPR95: 1.0) | EVALUATED |

---

## 2. Confidence Calibration & Reliability
- **Optimal Scaling Parameter (Fitted on Validation)**: T = 0.876
- **Raw Test ECE**: 0.0234
- **Calibrated Test ECE**: 0.0121

---

## 3. Environmental Robustness Stress Tests
- **Gaussian Blur**: 76.7% accuracy (30 test samples)
- **Low Brightness**: 86.7% accuracy (30 test samples)
- **High Brightness**: 76.7% accuracy (30 test samples)
- **Low Contrast**: 83.3% accuracy (30 test samples)

---

## 4. Methodological Integrity Notes
1. Zero synthetic images were included in train, validation, or test partitions.
2. No physical specimen or capture session was shared across train, val, or test partitions.
3. Test set was evaluated strictly once on frozen weights and was never used for model selection or calibration fitting.
4. Shelf-life longitudinal modeling is decoupled from pure visual freshness estimation.
