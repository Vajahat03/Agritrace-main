# AgriTrace Agricultural Dataset Audit & Integrity Report

**Generated**: 2026-09-05 12:51:12Z  
**Status**: VERIFIED REAL DATASETS (0 SYNTHETIC IMAGES)

---

## 1. Summary Statistics

| Metric | Measured Value |
| :--- | :--- |
| **Total Real Images Processed** | **34,234** |
| **Usable / Readable Images** | **34,234** |
| **Corrupted Images** | **1** |
| **Duplicate Image Hashes** | **76** |
| **Synthetic / Generated Images** | **0** |
| **Unique Physical Specimens / Capture Groups** | **3,668** |
| **Train Set Partition (70%)** | **24,051** |
| **Validation Set Partition (15%)** | **5,310** |
| **Held-Out Test Partition (15%)** | **4,873** |
| **Specimen Leakage Check** | **0 Overlap (Verified Zero Leakage)** |

---

## 2. Multi-Task Label Coverage

### Produce Classes
| Produce Class | Images |
| :--- | :--- |
| **Unknown** | 19,173 |
| **Banana** | 5,458 |
| **Orange** | 4,270 |
| **Apple** | 4,153 |
| **Tomato** | 1,180 |

### Freshness Stages
| Freshness Stage | Images |
| :--- | :--- |
| **Fresh** | 17,055 |
| **Spoiled** | 11,508 |
| **Moderately Fresh** | 5,063 |
| **Missing** | 608 |

### Defect Annotations
| Defect Type | Images |
| :--- | :--- |
| **Missing** | 21,291 |
| **None** | 12,335 |
| **Other** | 608 |

### Continuous Quality Score Coverage
- **Annotated Samples**: 34,234 (100.0%)
- **Missing (Loss Masked)**: 0

---

## 3. Dataset Attribution & Sources
- **AgriFreshNET**: 12,960 valid images (CC BY 4.0)
- **Banana & Guava Quality**: 1,748 valid images (CC BY 4.0)
- **FruitNet**: 19,526 valid images (CC BY 4.0)
- **VegFru**: Noted as requiring manual Baidu Pan download per Rule 14.
