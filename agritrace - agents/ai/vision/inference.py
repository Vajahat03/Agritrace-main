"""
AgriTrace Vision-D121 Production Inference API
Loads the trained checkpoint from models/vision/agritrace_vision_d121_best.pt
Provides analyze_image(image) and run_vision_pipeline(image) returning calibrated
structured multi-task predictions and visual Grad-CAM attention maps.
"""

from typing import Dict, Any, Optional
import os
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F

from ai.vision.preprocessing import check_image_quality, preprocess_for_model
from ai.vision.ood_detector import analyze_produce_likelihood
from ai.vision.densenet121 import get_vision_model
from ai.vision.label_mapping import (
    PRODUCE_CLASSES, 
    FRESHNESS_GRADES, 
    DEFECT_TYPES
)
from ai.vision.gradcam import GradCAM, overlay_gradcam

MODEL_VERSION_TAG = "AgriTrace-Vision-D121-v1.0.0"

def get_calibrated_temperature() -> float:
    """Reads calibrated temperature scaling parameter if available from test report."""
    from pathlib import Path
    base_dir = Path(__file__).resolve().parent.parent.parent
    report_candidates = [
        str(base_dir / "reports" / "vision_test_report.json"),
        r"D:\agritrace d\frontend\agritrace - agents\reports\vision_test_report.json",
        r"D:\agritrace d\agritrace - agents\reports\vision_test_report.json",
        "reports/vision_test_report.json",
    ]
    for report_path in report_candidates:
        if os.path.exists(report_path):
            try:
                import json
                with open(report_path, "r") as f:
                    rep = json.load(f)
                return float(rep.get("calibration", {}).get("optimal_temperature_fitted_on_val", 1.0))
            except Exception:
                return 1.0
    return 1.0

def analyze_image(image: Image.Image, checkpoint_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Standardized production inference endpoint matching AgriTrace Master Specification Section 35.
    Loads real trained weights from resolved checkpoint path.
    """
    # 1. Quality Check
    q_check = check_image_quality(image)
    if not q_check["acceptable"]:
        return {
            "model_version": MODEL_VERSION_TAG,
            "status": "REJECTED_QUALITY",
            "message": q_check["reason"],
            "ood": {"is_unknown": True, "score": 0.99},
            "produce": {"class": "Unknown", "confidence": 0.0},
            "freshness": {"grade": "N/A", "confidence": 0.0},
            "quality": {"score": 0.0},
            "defect": {"type": "None", "probability": 0.0},
            "embedding": []
        }

    # 2. Produce / Non-Produce OOD Validation
    ood_check = analyze_produce_likelihood(image)
    if not ood_check["is_produce"]:
        return {
            "model_version": MODEL_VERSION_TAG,
            "status": "REJECTED_OOD",
            "message": ood_check["message"],
            "ood": {"is_unknown": True, "score": round(1.0 - ood_check["produce_confidence"], 3)},
            "produce": {"class": "Unknown", "confidence": ood_check["produce_confidence"]},
            "freshness": {"grade": "N/A", "confidence": 0.0},
            "quality": {"score": 0.0},
            "defect": {"type": "None", "probability": 0.0},
            "embedding": []
        }

    # 3. DenseNet-121 Multi-Task Forward Pass
    model = get_vision_model(checkpoint_path=checkpoint_path)
    tensor = preprocess_for_model(image)
    temp_scaling = get_calibrated_temperature()

    with torch.no_grad():
        out = model(tensor)
        
        # Temperature scaled logits
        p_logits = out["produce_logits"] / temp_scaling
        f_logits = out["freshness_logits"] / temp_scaling
        d_logits = out["defect_logits"] / temp_scaling
        
        p_probs = F.softmax(p_logits, dim=1).cpu().numpy()[0]
        f_probs = F.softmax(f_logits, dim=1).cpu().numpy()[0]
        d_probs = F.softmax(d_logits, dim=1).cpu().numpy()[0]
        
        top_p_idx = int(np.argmax(p_probs))
        top_f_idx = int(np.argmax(f_probs))
        top_d_idx = int(np.argmax(d_probs))
        
        prod_class = PRODUCE_CLASSES[top_p_idx]
        fresh_grade = FRESHNESS_GRADES[top_f_idx]
        defect_type = DEFECT_TYPES[top_d_idx]
        
        quality_val = float(out["quality"].cpu().numpy()[0][0])
        defect_prob = float(1.0 - d_probs[0])
        embedding_vec = out["embedding"].cpu().numpy()[0].tolist()

    return {
        "model_version": MODEL_VERSION_TAG,
        "produce": {
            "class": prod_class,
            "confidence": round(float(p_probs[top_p_idx]), 4)
        },
        "freshness": {
            "grade": fresh_grade,
            "confidence": round(float(f_probs[top_f_idx]), 4)
        },
        "quality": {
            "score": round(quality_val, 1)
        },
        "defect": {
            "type": defect_type,
            "probability": round(defect_prob, 4)
        },
        "embedding": embedding_vec[:32],  # Compact vector slice
        "full_embedding_dim": len(embedding_vec),
        "ood": {
            "is_unknown": False,
            "score": round(1.0 - float(p_probs[top_p_idx]), 4)
        }
    }

def run_vision_pipeline(image: Image.Image, checkpoint_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Unified full pipeline returning structured result + Grad-CAM heatmap visualization.
    """
    analysis = analyze_image(image, checkpoint_path=checkpoint_path)
    if analysis.get("status") in ["REJECTED_QUALITY", "REJECTED_OOD"]:
        return {
            **analysis,
            "status": analysis.get("status"),
            "produce_detected": False,
            "message": analysis.get("message")
        }

    # Compute Grad-CAM heatmap for top predicted freshness index
    model = get_vision_model(checkpoint_path=checkpoint_path)
    tensor = preprocess_for_model(image)
    
    top_f_idx = FRESHNESS_GRADES.index(analysis["freshness"]["grade"]) if analysis["freshness"]["grade"] in FRESHNESS_GRADES else 0
    gradcam = GradCAM(model)
    heatmap = gradcam.generate_heatmap(tensor, target_class_idx=top_f_idx)
    _, gradcam_url = overlay_gradcam(image, heatmap)

    explanation = (
        f"Identified {analysis['produce']['class']} with {analysis['produce']['confidence']*100:.1f}% confidence. "
        f"Freshness classified as '{analysis['freshness']['grade']}' (Quality Score: {analysis['quality']['score']}/100) "
        f"with {analysis['defect']['probability']*100:.1f}% defect probability ({analysis['defect']['type']})."
    )

    return {
        "status": "SUCCESS",
        "produce_detected": True,
        "model_version": MODEL_VERSION_TAG,
        "produce_type": analysis["produce"]["class"].lower().replace(" ", "_"),
        "produce_confidence": analysis["produce"]["confidence"],
        "freshness_grade": analysis["freshness"]["grade"].lower().replace(" ", "_"),
        "freshness_confidence": analysis["freshness"]["confidence"],
        "quality_score": analysis["quality"]["score"],
        "defect_type": analysis["defect"]["type"].lower().replace(" ", "_"),
        "defect_probability": analysis["defect"]["probability"],
        "gradcam_heatmap_url": gradcam_url,
        "visual_embeddings": analysis["embedding"],
        "raw_embeddings_dim": analysis["full_embedding_dim"],
        "explanation": explanation,
        "ood_metrics": analysis["ood"]
    }

# Alias for flexible integration
analyze_produce_image = run_vision_pipeline

