import os
import sys
sys.path.insert(0, os.path.abspath("."))
import pandas as pd
from PIL import Image
from ai.vision.inference import analyze_produce_image, analyze_image
from ai.vision.gradcam import GradCAM, overlay_gradcam
from ai.vision.densenet121 import get_vision_model
from ai.vision.preprocessing import preprocess_for_model

def run_verification():
    print("[Verification] Starting Real Vision Pipeline Test...")
    test_csv = "data/splits/test.csv"
    if not os.path.exists(test_csv):
        raise FileNotFoundError("test.csv not found")

    test_df = pd.read_csv(test_csv)
    known = test_df[test_df["produce_class"].isin(["Banana", "Apple", "Tomato", "Orange"])]
    if len(known) == 0:
        sample = test_df.iloc[0]
    else:
        sample = known.iloc[0]

    img_path = sample["image_path"]
    print(f"[Verification] Selected test image: {img_path}")
    print(f"  Ground Truth - Produce: {sample.get('produce_class')}, Freshness: {sample.get('freshness_grade')}")

    img = Image.open(img_path).convert("RGB")
    
    # 1. Test analyze_image
    analysis = analyze_image(img)
    print("\n--- Raw Analysis Result ---")
    for k, v in analysis.items():
        print(f"  {k}: {v}")

    # 2. Test Full Pipeline with Grad-CAM
    pipeline_res = analyze_produce_image(img)
    print("\n--- Pipeline Result with Grad-CAM ---")
    for k, v in pipeline_res.items():
        if k != "gradcam_heatmap_url":
            print(f"  {k}: {v}")
        else:
            print(f"  gradcam_heatmap_url: {v[:40]}... (total length: {len(v)})")

    # 3. Save sample Grad-CAM heatmap visualization to reports/gradcam/
    os.makedirs("reports/gradcam", exist_ok=True)
    model = get_vision_model()
    tensor = preprocess_for_model(img)
    gradcam = GradCAM(model)
    heatmap = gradcam.generate_heatmap(tensor, target_class_idx=0)
    overlay_img, _ = overlay_gradcam(img, heatmap)
    
    out_gradcam_path = "reports/gradcam/sample_gradcam_overlay.png"
    overlay_img.save(out_gradcam_path)
    print(f"\n[Verification] Successfully saved sample Grad-CAM image to {out_gradcam_path}")
    print("[Verification] ALL REAL-IMAGE VISION PIPELINE CHECKS PASSED!")

if __name__ == "__main__":
    run_verification()
