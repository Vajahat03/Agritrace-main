"""
AgriTrace Vision-D121 Architecture
Multi-Task Agricultural Computer Vision Backbone based on DenseNet-121.
Exposes 1024-dim visual embeddings for downstream XGBoost shelf-life modeling.
"""

from typing import Dict, Any, List, Optional
import torch
import torch.nn as nn
import torch.nn.functional as F
import torchvision.models as models

from ai.vision.label_mapping import (
    PRODUCE_CLASSES, 
    FRESHNESS_GRADES, 
    DEFECT_TYPES
)

class AgriTraceVisionD121(nn.Module):
    """
    AgriTrace Vision-D121 Multi-Task Architecture:
    Backbone: DenseNet-121 Feature Extractor (1024 dims)
    Heads:
      1. Produce Classification (9 classes)
      2. Freshness Grade (4 classes)
      3. Continuous Quality Score (0 to 100 regression)
      4. Defect Diagnosis (6 defect classes)
    """
    def __init__(
        self,
        num_produce_classes: int = len(PRODUCE_CLASSES),
        num_freshness_classes: int = len(FRESHNESS_GRADES),
        num_defect_classes: int = len(DEFECT_TYPES),
        embedding_dim: int = 1024,
        pretrained: bool = True
    ):
        super(AgriTraceVisionD121, self).__init__()
        
        # 1. Backbone: DenseNet-121 Feature Extractor
        try:
            weights = models.DenseNet121_Weights.DEFAULT if pretrained else None
            base_densenet = models.densenet121(weights=weights)
        except Exception:
            base_densenet = models.densenet121(weights=None)
            
        self.features = base_densenet.features
        in_features = base_densenet.classifier.in_features  # 1024
        
        # 2. Shared Multi-Task Bottleneck Projection
        self.shared_projection = nn.Sequential(
            nn.Linear(in_features, 512),
            nn.BatchNorm1d(512),
            nn.ReLU(inplace=False),
            nn.Dropout(p=0.20)
        )
        
        # 3. Produce Classification Head (9 classes)
        self.head_produce = nn.Linear(512, num_produce_classes)
        
        # 4. Freshness Classification Head (4 classes)
        self.head_freshness = nn.Linear(512, num_freshness_classes)
        
        # 5. Quality Regression Head (0 to 100)
        self.head_quality = nn.Sequential(
            nn.Linear(512, 128),
            nn.ReLU(inplace=False),
            nn.Linear(128, 1),
            nn.Sigmoid()  # Multiplied by 100.0 in forward pass
        )
        
        # 6. Defect Classification Head (6 classes)
        self.head_defect = nn.Linear(512, num_defect_classes)

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extracts the 1024-dimensional visual embedding vector."""
        features = self.features(x)
        out = F.relu(features, inplace=False)
        out = F.adaptive_avg_pool2d(out, (1, 1))
        return torch.flatten(out, 1)

    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        # 1. Feature representation
        embedding = self.extract_features(x)
        
        # 2. Shared bottleneck
        shared = self.shared_projection(embedding)
        
        # 3. Head predictions
        produce_logits = self.head_produce(shared)
        freshness_logits = self.head_freshness(shared)
        quality = self.head_quality(shared) * 100.0
        defect_logits = self.head_defect(shared)
        
        return {
            "embedding": embedding,
            "produce_logits": produce_logits,
            "freshness_logits": freshness_logits,
            "quality": quality,
            "defect_logits": defect_logits
        }

import os
import logging
from pathlib import Path

logger = logging.getLogger("agritrace.ai.vision.densenet121")
_GLOBAL_VISION_MODEL = None

def resolve_vision_checkpoint(checkpoint_path: Optional[str] = None) -> Optional[str]:
    """
    Resolves absolute path to the fine-tuned AgriTrace DenseNet-121 checkpoint.
    """
    candidates = []
    if checkpoint_path:
        candidates.append(checkpoint_path)
    if os.environ.get("VISION_CHECKPOINT_PATH"):
        candidates.append(os.environ["VISION_CHECKPOINT_PATH"])

    base_dir = Path(__file__).resolve().parent.parent.parent
    candidates.extend([
        str(base_dir / "models" / "vision" / "agritrace_vision_d121_best.pt"),
        str(base_dir / "models" / "vision" / "agritrace_vision_d121_final.pt"),
        r"D:\agritrace d\frontend\agritrace - agents\models\vision\agritrace_vision_d121_best.pt",
        r"D:\agritrace d\agritrace - agents\models\vision\agritrace_vision_d121_best.pt",
        "models/vision/agritrace_vision_d121_best.pt",
    ])

    for c in candidates:
        if c and os.path.exists(c):
            return str(Path(c).resolve())
    return None

def get_vision_model(
    device: str = "cpu",
    checkpoint_path: Optional[str] = None,
    reload: bool = False
) -> AgriTraceVisionD121:
    """
    Returns the production AgriTrace Vision-D121 model.
    Loads fine-tuned weights from resolved checkpoint path without remote download blocking.
    """
    global _GLOBAL_VISION_MODEL
    if _GLOBAL_VISION_MODEL is None or reload:
        resolved = resolve_vision_checkpoint(checkpoint_path)
        if resolved and os.path.exists(resolved):
            model = AgriTraceVisionD121(pretrained=False)
            ckpt = torch.load(resolved, map_location=device)
            state_dict = ckpt.get("model_state_dict", ckpt)
            model.load_state_dict(state_dict)
            logger.info("[Vision-D121] Loaded fine-tuned checkpoint: %s", resolved)
        else:
            model = AgriTraceVisionD121(pretrained=False)
            logger.warning("[Vision-D121] Checkpoint not located; initialized offline architecture safely.")
            
        model.to(device)
        model.eval()
        _GLOBAL_VISION_MODEL = model
        
    return _GLOBAL_VISION_MODEL


