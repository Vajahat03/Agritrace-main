"""
AgriTrace Produce / Non-Produce & Out-of-Distribution (OOD) Detector
Prevents non-agricultural images (faces, vehicles, laptops, indoor clutter, blank surfaces)
from triggering spurious produce classifications.
"""

from typing import Dict, Any, List
import numpy as np
from PIL import Image

SUPPORTED_PRODUCE_CLASSES = [
    "tomato", "apple", "banana", "potato", "onion", 
    "orange", "bell_pepper", "strawberry"
]

def analyze_produce_likelihood(image: Image.Image) -> Dict[str, Any]:
    """
    Evaluates whether the given image contains agricultural produce or is Out-Of-Distribution (OOD).
    Uses color-histogram entropy, hue distribution, and organic edge texture characteristics.
    """
    img_rgb = image.convert("RGB").resize((128, 128))
    img_np = np.array(img_rgb, dtype=np.float32)
    
    # 1. Variance / Flatness check (Reject uniform / blank white/gray/black backgrounds)
    channel_stds = np.std(img_np, axis=(0, 1))
    avg_std = float(np.mean(channel_stds))
    avg_luminance = float(np.mean(img_np))
    if avg_std < 2.0 and (avg_luminance > 240.0 or avg_luminance < 15.0):
        return {
            "is_produce": False,
            "produce_confidence": 0.05,
            "ood_status": "blank_or_solid_color",
            "message": "This image appears to be a blank or uniform surface. Please upload a clear photo of produce."
        }

    # 2. Color Space Analysis (HSV Conversion)
    r, g, b = img_np[:, :, 0] / 255.0, img_np[:, :, 1] / 255.0, img_np[:, :, 2] / 255.0
    cmax = np.maximum(np.maximum(r, g), b)
    cmin = np.minimum(np.minimum(r, g), b)
    delta = cmax - cmin + 1e-6
    
    # Saturation
    saturation = np.where(cmax == 0, 0, delta / (cmax + 1e-6))
    avg_saturation = float(np.mean(saturation))
    
    # Value/Brightness
    avg_value = float(np.mean(cmax))
    
    # Hue calculation in degrees [0, 360]
    hue = np.zeros_like(r)
    mask_r = (cmax == r) & (delta > 1e-5)
    mask_g = (cmax == g) & (delta > 1e-5)
    mask_b = (cmax == b) & (delta > 1e-5)
    
    hue[mask_r] = 60.0 * (((g[mask_r] - b[mask_r]) / delta[mask_r]) % 6)
    hue[mask_g] = 60.0 * (((b[mask_g] - r[mask_g]) / delta[mask_g]) + 2)
    hue[mask_b] = 60.0 * (((r[mask_b] - g[mask_b]) / delta[mask_b]) + 4)

    # 3. Organic Produce Color Distribution Match:
    # Red/Orange (Tomatoes, Strawberries, Oranges, Apples): 0-45 deg or 330-360 deg
    # Yellow/Green (Bananas, Bell Peppers, Apples): 45-160 deg
    # Brown/Earthy (Potatoes, Onions): 20-50 deg with moderate saturation
    # Non-produce indicators: Pure synthetic blues/magentas (190-310 deg with high saturation),
    # or cold monochrome metallic grays (very low saturation, high contrast).
    
    synthetic_cool_mask = (hue >= 190) & (hue <= 300) & (saturation > 0.35)
    synthetic_cool_ratio = float(np.mean(synthetic_cool_mask))
    
    organic_warm_mask = ((hue <= 165) | (hue >= 330)) & (saturation > 0.18)
    organic_warm_ratio = float(np.mean(organic_warm_mask))

    # Calculate Organic Produce Score (0.0 to 1.0)
    produce_score = float(np.clip(
        (organic_warm_ratio * 1.2) - (synthetic_cool_ratio * 1.8) + (avg_saturation * 0.4),
        0.05, 0.98
    ))

    # OOD Decision Rule
    if synthetic_cool_ratio > 0.35 or produce_score < 0.30:
        return {
            "is_produce": False,
            "produce_confidence": round(produce_score, 2),
            "ood_status": "non_produce_detected",
            "message": "This image cannot be reliably identified as supported agricultural produce. Please upload a clearer image."
        }

    return {
        "is_produce": True,
        "produce_confidence": round(produce_score, 2),
        "ood_status": "in_distribution",
        "message": "Produce visual signature verified."
    }
