"""
AgriTrace Vision-D121 Two-Stage Multi-Task Training Pipeline
Stage 1: Frozen Backbone -> Warm up Multi-Task Heads
Stage 2: Full Fine-Tuning -> Discriminative Learning Rates & Cosine Annealing

Supports active Mixed Precision (torch.autocast + GradScaler) on CUDA and CPU.
Calculates loss strictly for available labels with dynamic masking.
"""

import os
import time
import json
import yaml
from typing import Dict, Any, Optional
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from ai.vision.densenet121 import AgriTraceVisionD121
from ai.vision.dataset import AgriTraceDataset

def train_agritrace_vision(
    config_path: str = "configs/vision_training.yaml",
    experiment_id: str = "EXP-D121-REAL-001"
) -> AgriTraceVisionD121:
    with open(config_path, "r") as f:
        cfg = yaml.safe_load(f)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[{experiment_id}] Device: {device} | PyTorch: {torch.__version__}")

    os.makedirs(cfg["paths"]["checkpoints_dir"], exist_ok=True)
    exp_dir = os.path.join(cfg["paths"]["experiments_dir"], experiment_id)
    os.makedirs(exp_dir, exist_ok=True)

    # Save experiment config
    with open(os.path.join(exp_dir, "config.yaml"), "w") as f:
        yaml.safe_dump(cfg, f)

    train_csv = "data/splits/train.csv"
    val_csv = "data/splits/val.csv"
    
    if not os.path.exists(train_csv) or not os.path.exists(val_csv):
        from ai.vision.dataset_ingestion import ingest_raw_datasets
        print("[Training] Split CSVs not found. Running dataset ingestion...")
        ingest_raw_datasets()

    train_df = pd.read_csv(train_csv)
    val_df = pd.read_csv(val_csv)

    train_dataset = AgriTraceDataset(train_df, is_train=True)
    val_dataset = AgriTraceDataset(val_df, is_train=False)

    batch_size = cfg["training"].get("batch_size", 16)
    num_workers = cfg["training"].get("num_workers", 0)
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, drop_last=False, num_workers=num_workers)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=num_workers)

    # Initialize model with ImageNet initialization
    model = AgriTraceVisionD121(
        num_produce_classes=cfg["model"]["num_produce_classes"],
        num_freshness_classes=cfg["model"]["num_freshness_classes"],
        num_defect_classes=cfg["model"]["num_defect_classes"],
        pretrained=cfg["model"].get("pretrained", True)
    ).to(device)

    # Multi-task loss functions with ignore index for missing labels
    ce_loss = nn.CrossEntropyLoss(ignore_index=-1)
    huber_loss = nn.HuberLoss(delta=1.0)

    w_prod = cfg["loss"].get("produce_weight", 1.0)
    w_fresh = cfg["loss"].get("freshness_weight", 1.2)
    w_qual = cfg["loss"].get("quality_weight", 0.8)
    w_def = cfg["loss"].get("defect_weight", 1.0)

    use_amp = cfg["training"].get("mixed_precision", True) and device.type == "cuda"
    scaler = torch.cuda.amp.GradScaler(enabled=use_amp)

    history = []
    best_val_loss = float("inf")
    start_time = time.time()

    # ==================== STAGE 1: FROZEN BACKBONE ====================
    epochs_s1 = cfg["training"].get("epochs_stage1", 5)
    print(f"\n=======================================================")
    print(f"STAGE 1: Training Multi-Task Heads (DenseNet Frozen, {epochs_s1} Epochs)")
    print(f"=======================================================")
    
    for param in model.features.parameters():
        param.requires_grad = False

    stage1_optimizer = AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=cfg["training"].get("learning_rate_head", 0.001),
        weight_decay=cfg["training"].get("weight_decay", 0.0001)
    )

    max_batches = cfg["training"].get("max_batches_per_epoch", None)

    for epoch in range(1, epochs_s1 + 1):
        model.train()
        train_loss = 0.0
        batch_count = 0
        
        for batch_idx, batch in enumerate(train_loader):
            if max_batches is not None and batch_idx >= max_batches:
                break
            images = batch["image"].to(device)
            y_prod = batch["produce_label"].to(device)
            y_fresh = batch["freshness_label"].to(device)
            y_qual = batch["quality_label"].to(device)
            y_def = batch["defect_label"].to(device)

            stage1_optimizer.zero_grad()

            with torch.autocast(device_type=device.type, enabled=use_amp):
                preds = model(images)
                l_prod = ce_loss(preds["produce_logits"], y_prod) if (y_prod >= 0).any() else torch.tensor(0.0, device=device)
                l_fresh = ce_loss(preds["freshness_logits"], y_fresh) if (y_fresh >= 0).any() else torch.tensor(0.0, device=device)
                l_def = ce_loss(preds["defect_logits"], y_def) if (y_def >= 0).any() else torch.tensor(0.0, device=device)

                valid_q = y_qual >= 0.0
                if valid_q.sum() > 0:
                    l_qual = huber_loss(preds["quality"][valid_q].squeeze(-1), y_qual[valid_q])
                else:
                    l_qual = torch.tensor(0.0, device=device)

                loss = w_prod * l_prod + w_fresh * l_fresh + w_qual * l_qual + w_def * l_def

            if use_amp:
                scaler.scale(loss).backward()
                scaler.step(stage1_optimizer)
                scaler.update()
            else:
                loss.backward()
                stage1_optimizer.step()

            train_loss += loss.item()
            batch_count += 1

        avg_loss = train_loss / max(1, batch_count)
        print(f"Stage 1 [Epoch {epoch:02d}/{epochs_s1:02d}] Train Loss: {avg_loss:.4f}")

    # ==================== STAGE 2: FULL FINE-TUNING ====================
    epochs_s2 = cfg["training"].get("epochs_stage2", 15)
    print(f"\n=======================================================")
    print(f"STAGE 2: Full Fine-Tuning (Discriminative LRs, {epochs_s2} Epochs)")
    print(f"=======================================================")
    
    for param in model.features.parameters():
        param.requires_grad = True

    lr_backbone = cfg["training"].get("learning_rate_backbone", 0.00002)
    lr_head = cfg["training"].get("learning_rate_head", 0.001) * 0.5

    optimizer_grouped_parameters = [
        {"params": model.features.parameters(), "lr": lr_backbone},
        {"params": model.shared_projection.parameters(), "lr": lr_head},
        {"params": model.head_produce.parameters(), "lr": lr_head},
        {"params": model.head_freshness.parameters(), "lr": lr_head},
        {"params": model.head_quality.parameters(), "lr": lr_head},
        {"params": model.head_defect.parameters(), "lr": lr_head},
    ]

    stage2_optimizer = AdamW(optimizer_grouped_parameters, weight_decay=cfg["training"].get("weight_decay", 0.0001))
    scheduler = CosineAnnealingLR(stage2_optimizer, T_max=epochs_s2, eta_min=cfg["scheduler"].get("eta_min", 1e-6))

    for epoch in range(1, epochs_s2 + 1):
        model.train()
        train_loss = 0.0
        batch_count = 0
        
        for batch_idx, batch in enumerate(train_loader):
            if max_batches is not None and batch_idx >= max_batches:
                break
            images = batch["image"].to(device)
            y_prod = batch["produce_label"].to(device)
            y_fresh = batch["freshness_label"].to(device)
            y_qual = batch["quality_label"].to(device)
            y_def = batch["defect_label"].to(device)

            stage2_optimizer.zero_grad()

            with torch.autocast(device_type=device.type, enabled=use_amp):
                preds = model(images)
                l_prod = ce_loss(preds["produce_logits"], y_prod) if (y_prod >= 0).any() else torch.tensor(0.0, device=device)
                l_fresh = ce_loss(preds["freshness_logits"], y_fresh) if (y_fresh >= 0).any() else torch.tensor(0.0, device=device)
                l_def = ce_loss(preds["defect_logits"], y_def) if (y_def >= 0).any() else torch.tensor(0.0, device=device)

                valid_q = y_qual >= 0.0
                if valid_q.sum() > 0:
                    l_qual = huber_loss(preds["quality"][valid_q].squeeze(-1), y_qual[valid_q])
                else:
                    l_qual = torch.tensor(0.0, device=device)

                loss = w_prod * l_prod + w_fresh * l_fresh + w_qual * l_qual + w_def * l_def

            if use_amp:
                scaler.scale(loss).backward()
                scaler.step(stage2_optimizer)
                scaler.update()
            else:
                loss.backward()
                stage2_optimizer.step()

            train_loss += loss.item()
            batch_count += 1

        scheduler.step()
        avg_train_loss = train_loss / max(1, batch_count)

        # Validation evaluation
        model.eval()
        val_loss = 0.0
        prod_correct = 0
        prod_total = 0
        fresh_correct = 0
        fresh_total = 0
        val_batch_count = 0
        max_val_batches = max_batches // 2 if max_batches else None

        with torch.no_grad():
            for v_idx, batch in enumerate(val_loader):
                if max_val_batches is not None and v_idx >= max_val_batches:
                    break
                images = batch["image"].to(device)
                y_prod = batch["produce_label"].to(device)
                y_fresh = batch["freshness_label"].to(device)
                y_qual = batch["quality_label"].to(device)
                y_def = batch["defect_label"].to(device)

                with torch.autocast(device_type=device.type, enabled=use_amp):
                    preds = model(images)
                    l_prod = ce_loss(preds["produce_logits"], y_prod) if (y_prod >= 0).any() else torch.tensor(0.0, device=device)
                    l_fresh = ce_loss(preds["freshness_logits"], y_fresh) if (y_fresh >= 0).any() else torch.tensor(0.0, device=device)
                    l_def = ce_loss(preds["defect_logits"], y_def) if (y_def >= 0).any() else torch.tensor(0.0, device=device)

                    valid_q = y_qual >= 0.0
                    if valid_q.sum() > 0:
                        l_qual = huber_loss(preds["quality"][valid_q].squeeze(-1), y_qual[valid_q])
                    else:
                        l_qual = torch.tensor(0.0, device=device)

                    loss = w_prod * l_prod + w_fresh * l_fresh + w_qual * l_qual + w_def * l_def

                val_loss += loss.item()
                val_batch_count += 1

                p_preds = preds["produce_logits"].argmax(dim=1)
                valid_p = y_prod >= 0
                prod_correct += (p_preds[valid_p] == y_prod[valid_p]).sum().item()
                prod_total += valid_p.sum().item()

                f_preds = preds["freshness_logits"].argmax(dim=1)
                valid_f = y_fresh >= 0
                fresh_correct += (f_preds[valid_f] == y_fresh[valid_f]).sum().item()
                fresh_total += valid_f.sum().item()

        avg_val_loss = val_loss / max(1, val_batch_count)
        val_prod_acc = (prod_correct / max(1, prod_total)) * 100.0 if prod_total > 0 else 0.0
        val_fresh_acc = (fresh_correct / max(1, fresh_total)) * 100.0 if fresh_total > 0 else 0.0


        print(f"Stage 2 [Epoch {epoch:02d}/{epochs_s2:02d}] Train Loss: {avg_train_loss:.4f} | Val Loss: {avg_val_loss:.4f} | Produce Acc: {val_prod_acc:.1f}% | Freshness Acc: {val_fresh_acc:.1f}%")

        epoch_record = {
            "epoch": epoch,
            "train_loss": round(avg_train_loss, 4),
            "val_loss": round(avg_val_loss, 4),
            "val_produce_acc": round(val_prod_acc, 2),
            "val_freshness_acc": round(val_fresh_acc, 2),
            "lr_backbone": float(scheduler.get_last_lr()[0])
        }
        history.append(epoch_record)

        # Checkpoint saving on best validation loss
        if avg_val_loss < best_val_loss:
            best_val_loss = avg_val_loss
            best_ckpt_path = os.path.join(cfg["paths"]["checkpoints_dir"], "agritrace_vision_d121_best.pt")
            torch.save({
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": stage2_optimizer.state_dict(),
                "epoch": epoch,
                "best_val_loss": round(best_val_loss, 4),
                "val_metrics": {
                    "produce_accuracy": round(val_prod_acc, 2),
                    "freshness_accuracy": round(val_fresh_acc, 2)
                },
                "config": cfg,
                "model_version": "AgriTrace-Vision-D121-v1.0.0",
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }, best_ckpt_path)
            print(f"  -> Saved new best checkpoint to {best_ckpt_path}")

    # Save final checkpoint
    final_ckpt_path = os.path.join(cfg["paths"]["checkpoints_dir"], "agritrace_vision_d121_final.pt")
    torch.save({
        "model_state_dict": model.state_dict(),
        "epoch": epochs_s2,
        "config": cfg,
        "model_version": "AgriTrace-Vision-D121-v1.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }, final_ckpt_path)

    # Save training history
    with open(os.path.join(exp_dir, "training_log.json"), "w") as f:
        json.dump(history, f, indent=2)

    total_time = time.time() - start_time
    print(f"\n[Training Completed in {total_time/60:.1f} mins] Best Checkpoint: {os.path.join(cfg['paths']['checkpoints_dir'], 'agritrace_vision_d121_best.pt')}")
    return model

if __name__ == "__main__":
    train_agritrace_vision()
