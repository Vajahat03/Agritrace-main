"""
AgriTrace PyTorch Dataset & DataLoader Implementation
Handles real multi-dataset agricultural images with dynamic masking for partially labeled samples
and specimen-aware leakage prevention.
Synthetic fallback images are strictly forbidden.
"""

from typing import Dict, Any, List, Optional, Tuple
import os
import pandas as pd
import numpy as np
from PIL import Image
import torch
from torch.utils.data import Dataset, DataLoader

from ai.vision.label_mapping import (
    PRODUCE_TO_IDX, 
    FRESHNESS_TO_IDX, 
    DEFECT_TO_IDX
)
from ai.vision.augmentations import get_train_transforms, get_val_transforms

class AgriTraceDataset(Dataset):
    """
    PyTorch Dataset implementing the unified AgriTrace schema for real agricultural images.
    Missing annotations are represented as -1 / NaN and dynamically masked during loss computation.
    """
    def __init__(
        self,
        df: pd.DataFrame,
        transform=None,
        is_train: bool = False
    ):
        self.df = df.reset_index(drop=True)
        self.transform = transform or (get_train_transforms() if is_train else get_val_transforms())

    def __len__(self) -> int:
        return len(self.df)

    def __getitem__(self, idx: int) -> Dict[str, Any]:
        row = self.df.iloc[idx]
        image_path = str(row["image_path"])

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Real image file not found: {image_path}. Synthetic fallbacks are strictly prohibited.")

        try:
            img = Image.open(image_path).convert("RGB")
        except Exception as e:
            raise IOError(f"Corrupted real image file at {image_path}: {e}")

        image_tensor = self.transform(img)

        # 1. Produce Label (0 to num_produce_classes-1)
        prod_str = str(row.get("produce_class", "Unknown"))
        prod_idx = PRODUCE_TO_IDX.get(prod_str, PRODUCE_TO_IDX["Unknown"])

        # 2. Freshness Label (-1 if missing)
        fresh_str = row.get("freshness_grade")
        fresh_idx = FRESHNESS_TO_IDX.get(str(fresh_str), -1) if pd.notna(fresh_str) and str(fresh_str) in FRESHNESS_TO_IDX else -1

        # 3. Quality Score (-1.0 if missing)
        quality_val = row.get("quality_score")
        quality_score = float(quality_val) if pd.notna(quality_val) and float(quality_val) >= 0 else -1.0

        # 4. Defect Label (-1 if missing)
        defect_str = row.get("defect_type")
        defect_idx = DEFECT_TO_IDX.get(str(defect_str), -1) if pd.notna(defect_str) and str(defect_str) in DEFECT_TO_IDX else -1

        return {
            "image": image_tensor,
            "produce_label": torch.tensor(prod_idx, dtype=torch.long),
            "freshness_label": torch.tensor(fresh_idx, dtype=torch.long),
            "quality_label": torch.tensor(quality_score, dtype=torch.float32),
            "defect_label": torch.tensor(defect_idx, dtype=torch.long),
            "image_path": image_path,
            "specimen_id": str(row.get("specimen_id", f"spec_{idx}"))
        }

def create_specimen_aware_split(
    df: pd.DataFrame,
    train_ratio: float = 0.70,
    val_ratio: float = 0.15,
    test_ratio: float = 0.15,
    random_seed: int = 42
) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Splits dataset into Train, Validation, and Test partitions without specimen or capture session leakage.
    All photos belonging to the same specimen_id or batch remain strictly within the same partition.
    """
    np.random.seed(random_seed)
    
    unique_specimens = df["specimen_id"].unique()
    np.random.shuffle(unique_specimens)
    
    n_total = len(unique_specimens)
    n_train = int(n_total * train_ratio)
    n_val = int(n_total * val_ratio)
    
    train_specs = set(unique_specimens[:n_train])
    val_specs = set(unique_specimens[n_train:n_train + n_val])
    test_specs = set(unique_specimens[n_train + n_val:])
    
    train_df = df[df["specimen_id"].isin(train_specs)].copy().reset_index(drop=True)
    val_df = df[df["specimen_id"].isin(val_specs)].copy().reset_index(drop=True)
    test_df = df[df["specimen_id"].isin(test_specs)].copy().reset_index(drop=True)
    
    return train_df, val_df, test_df
