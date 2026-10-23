"""
AgriTrace Confidence Calibration Engine
Implements Temperature Scaling and Expected Calibration Error (ECE)
to ensure model confidence accurately reflects true posterior probability.
"""

from typing import Dict, Any, Tuple
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim

class TemperatureScaling(nn.Module):
    """
    Applies temperature scaling post-processing to calibrate softmax confidence:
    p_i = exp(z_i / T) / sum_j exp(z_j / T)
    """
    def __init__(self, initial_temp: float = 1.0):
        super(TemperatureScaling, self).__init__()
        self.temperature = nn.Parameter(torch.ones(1) * initial_temp)

    def forward(self, logits: torch.Tensor) -> torch.Tensor:
        temp = self.temperature.clamp(min=0.1, max=5.0)
        return logits / temp

def compute_ece(probs: np.ndarray, labels: np.ndarray, n_bins: int = 10) -> float:
    """
    Calculates Expected Calibration Error (ECE) across prediction probability bins.
    """
    if len(probs) == 0 or len(labels) == 0:
        return 0.0
        
    confidences = np.max(probs, axis=1)
    predictions = np.argmax(probs, axis=1)
    accuracies = (predictions == labels)

    bin_boundaries = np.linspace(0, 1, n_bins + 1)
    ece = 0.0

    for i in range(n_bins):
        bin_lower = bin_boundaries[i]
        bin_upper = bin_boundaries[i + 1]
        
        in_bin = (confidences > bin_lower) & (confidences <= bin_upper)
        prop_in_bin = np.mean(in_bin)
        
        if prop_in_bin > 0:
            accuracy_in_bin = np.mean(accuracies[in_bin])
            avg_confidence_in_bin = np.mean(confidences[in_bin])
            ece += np.abs(avg_confidence_in_bin - accuracy_in_bin) * prop_in_bin

    return float(np.round(ece, 4))

def calibrate_model_logits(logits: torch.Tensor, labels: torch.Tensor, lr: float = 0.01, max_iter: int = 50) -> Tuple[float, float, float]:
    """
    Optimizes temperature parameter T using NLL on validation set.
    Returns (Optimal Temperature, Uncalibrated ECE, Calibrated ECE).
    """
    valid_mask = labels >= 0
    if valid_mask.sum() == 0:
        return 1.0, 0.0, 0.0

    valid_logits = logits[valid_mask]
    valid_labels = labels[valid_mask]

    temp_model = TemperatureScaling()
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.LBFGS([temp_model.temperature], lr=lr, max_iter=max_iter)

    def eval_loss():
        optimizer.zero_grad()
        loss = criterion(temp_model(valid_logits), valid_labels)
        loss.backward()
        return loss

    try:
        optimizer.step(eval_loss)
    except Exception:
        pass
        
    opt_temp = float(temp_model.temperature.clamp(0.1, 5.0).item())

    # Calculate ECE before and after
    raw_probs = torch.softmax(valid_logits, dim=1).detach().cpu().numpy()
    cal_probs = torch.softmax(temp_model(valid_logits), dim=1).detach().cpu().numpy()
    y = valid_labels.detach().cpu().numpy()

    uncal_ece = compute_ece(raw_probs, y)
    cal_ece = compute_ece(cal_probs, y)

    return opt_temp, uncal_ece, cal_ece
