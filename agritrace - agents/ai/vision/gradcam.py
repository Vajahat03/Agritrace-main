"""
AgriTrace Explainable AI: Grad-CAM Heatmap Generator
Computes visual attention heatmaps from DenseNet-121 final convolutional layers
to explain freshness and defect localization to judges and users.
"""

from typing import Dict, Any, Tuple
import io
import base64
import numpy as np
from PIL import Image
import torch
import torch.nn.functional as F
from ai.vision.densenet121 import AgriTraceVisionD121

class GradCAM:
    def __init__(self, model: AgriTraceVisionD121, target_layer: torch.nn.Module = None):
        self.model = model
        self.model.eval()
        # Target the final dense block of DenseNet-121
        if target_layer is None:
            self.target_layer = self.model.features.denseblock4
        else:
            self.target_layer = target_layer
            
        self.gradients = None
        self.activations = None
        
        # Register hooks
        self.target_layer.register_forward_hook(self._save_activations)
        self.target_layer.register_full_backward_hook(self._save_gradients)

    def _save_activations(self, module, input, output):
        self.activations = output.clone().detach()

    def _save_gradients(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].clone().detach()

    def generate_heatmap(self, input_tensor: torch.Tensor, target_class_idx: int = 0) -> np.ndarray:
        """
        Generates a 2D normalized Grad-CAM heatmap for the specified freshness class index.
        """
        self.model.zero_grad()
        out = self.model(input_tensor)
        freshness_logits = out["freshness_logits"]
        
        # Target score for backprop
        score = freshness_logits[0, target_class_idx]
        score.backward(retain_graph=True)
        
        # Global average pool the gradients
        pooled_gradients = torch.mean(self.gradients, dim=[0, 2, 3])
        
        # Weight the channels by corresponding gradients
        activations = self.activations[0]
        for i in range(activations.size(0)):
            activations[i, :, :] *= pooled_gradients[i]
            
        # Channel-wise mean & ReLU
        heatmap = torch.mean(activations, dim=0).squeeze().cpu().numpy()
        heatmap = np.maximum(heatmap, 0)
        
        max_val = np.max(heatmap)
        if max_val > 1e-6:
            heatmap = heatmap / max_val
        else:
            heatmap = np.zeros_like(heatmap)
            
        return heatmap

def overlay_gradcam(original_image: Image.Image, heatmap: np.ndarray, alpha: float = 0.45) -> Tuple[Image.Image, str]:
    """
    Overlays a Grad-CAM heatmap onto the original image with a vibrant colormap (JET/Turbo).
    Returns (Composite PIL Image, Base64 data URL).
    """
    orig_rgb = original_image.convert("RGB")
    w, h = orig_rgb.size
    
    # Resize heatmap to match image dimensions
    heatmap_pil = Image.fromarray((heatmap * 255).astype(np.uint8)).resize((w, h), Image.Resampling.BILINEAR)
    heat_np = np.array(heatmap_pil, dtype=np.float32) / 255.0
    
    # Colormap approximation (Blue -> Green -> Yellow -> Red)
    r = np.clip(1.5 - np.abs(heat_np * 4.0 - 3.0), 0.0, 1.0)
    g = np.clip(1.5 - np.abs(heat_np * 4.0 - 2.0), 0.0, 1.0)
    b = np.clip(1.5 - np.abs(heat_np * 4.0 - 1.0), 0.0, 1.0)
    
    colormap = np.stack([r, g, b], axis=2) * 255.0
    orig_np = np.array(orig_rgb, dtype=np.float32)
    
    # Blend overlay where heatmap activation is significant
    mask = np.expand_dims(np.clip(heat_np * 1.5, 0.0, 1.0), axis=2)
    blended = orig_np * (1.0 - alpha * mask) + colormap * (alpha * mask)
    blended_img = Image.fromarray(np.clip(blended, 0, 255).astype(np.uint8))
    
    # Convert to base64 for direct API/UI display
    buffered = io.BytesIO()
    blended_img.save(buffered, format="JPEG", quality=85)
    b64_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    data_url = f"data:image/jpeg;base64,{b64_str}"
    
    return blended_img, data_url
