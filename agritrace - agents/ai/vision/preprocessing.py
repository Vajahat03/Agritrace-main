"""
AgriTrace Image Preprocessing & Quality Assessment
Checks resolution, Laplacian blur, lighting exposure, and prepares normalized tensors.
"""

from typing import Dict, Any, Tuple
import numpy as np
from PIL import Image
import torch
import torchvision.transforms as transforms

# Standard DenseNet normalization
TRANSFORM_PIPELINE = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def check_image_quality(image: Image.Image) -> Dict[str, Any]:
    """
    Evaluates image quality: resolution, blur (Laplacian variance), and lighting exposure.
    """
    width, height = image.size
    
    # 1. Resolution Check
    if width < 120 or height < 120:
        return {
            "acceptable": False,
            "reason": f"Image resolution ({width}x{height}) is too low for reliable produce diagnosis (min 120x120 required).",
            "blur_score": 0.0,
            "exposure": "invalid"
        }

    # Convert to NumPy grayscale for Laplacian & luminance analysis
    img_rgb = image.convert("RGB")
    img_np = np.array(img_rgb)
    gray = np.mean(img_np, axis=2).astype(np.float32)

    # 2. Laplacian Blur Estimation (Kernel Approximation)
    # 2D discrete Laplacian filter
    lap_kernel = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=np.float32)
    # Simple valid convolution for variance
    h, w = gray.shape
    if h >= 3 and w >= 3:
        sub_gray = gray[::2, ::2]  # Subsample for high speed
        sh, sw = sub_gray.shape
        lap = (
            sub_gray[1:sh-1, 2:sw] + sub_gray[1:sh-1, 0:sw-2] +
            sub_gray[2:sh, 1:sw-1] + sub_gray[0:sh-2, 1:sw-1] -
            4 * sub_gray[1:sh-1, 1:sw-1]
        )
        blur_var = float(np.var(lap))
    else:
        blur_var = 100.0

    # 3. Exposure / Luminance Check
    mean_luminance = float(np.mean(gray))
    
    if mean_luminance < 25.0:
        exposure = "severely_underexposed"
    elif mean_luminance > 240.0:
        exposure = "severely_overexposed"
    elif mean_luminance < 50.0:
        exposure = "underexposed"
    elif mean_luminance > 215.0:
        exposure = "overexposed"
    else:
        exposure = "good"

    # Extreme blur threshold
    is_blurry = blur_var < 15.0
    is_bad_exposure = exposure in ["severely_underexposed", "severely_overexposed"]

    acceptable = not (is_blurry or is_bad_exposure)
    
    reason = "Image quality is acceptable."
    if is_blurry and is_bad_exposure:
        reason = "Image is too blurry and poorly lit. Please provide a clear, well-lit photo."
    elif is_blurry:
        reason = "Image is too blurry for accurate defect detection. Please hold the camera steady."
    elif is_bad_exposure:
        reason = f"Image is {exposure.replace('_', ' ')}. Please ensure adequate lighting."

    return {
        "acceptable": acceptable,
        "width": width,
        "height": height,
        "blur_score": round(blur_var, 2),
        "mean_luminance": round(mean_luminance, 2),
        "exposure": exposure,
        "reason": reason
    }

def preprocess_for_model(image: Image.Image) -> torch.Tensor:
    """Preprocesses a PIL Image into a normalized tensor (1, 3, 224, 224)."""
    img_rgb = image.convert("RGB")
    tensor = TRANSFORM_PIPELINE(img_rgb)
    return tensor.unsqueeze(0)
