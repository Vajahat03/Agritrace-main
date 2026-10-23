"""
AgriTrace Sample Produce Image & Dataset Generator
Generates realistic agricultural produce image tensors with organic gradients,
stems, textures, and defect spots for validation and live demos.
"""

from typing import Tuple
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

def generate_synthetic_produce_image(
    produce_type: str = "tomato",
    freshness: str = "fresh",
    size: Tuple[int, int] = (300, 300)
) -> Image.Image:
    """
    Generates a realistic PIL image of agricultural produce with natural gradient and texture.
    """
    w, h = size
    # Background (e.g. wooden crate / neutral farm table)
    bg_color = (210, 195, 175)
    img = Image.new("RGB", size, color=bg_color)
    draw = ImageDraw.Draw(img)
    
    # Add table grain texture
    noise = np.random.randint(-15, 15, (h, w, 3), dtype=np.int16)
    img_np = np.clip(np.array(img, dtype=np.int16) + noise, 0, 255).astype(np.uint8)
    img = Image.fromarray(img_np)
    draw = ImageDraw.Draw(img)

    center_x, center_y = w // 2, h // 2
    radius = int(min(w, h) * 0.38)

    # Color definitions
    colors = {
        "tomato": (220, 45, 30),
        "apple": (195, 35, 35),
        "banana": (240, 215, 45),
        "potato": (175, 140, 95),
        "onion": (195, 120, 110),
        "orange": (245, 130, 20),
        "bell_pepper": (45, 160, 40),
        "strawberry": (210, 30, 45)
    }
    base_rgb = colors.get(produce_type.lower(), (220, 45, 30))

    if freshness == "moderately_fresh":
        # Slight softening / duller color
        base_rgb = (int(base_rgb[0] * 0.9), int(base_rgb[1] * 0.9), int(base_rgb[2] * 0.9))
    elif freshness == "early_spoilage":
        # Darkening / browning
        base_rgb = (int(base_rgb[0] * 0.75 + 40), int(base_rgb[1] * 0.65 + 30), int(base_rgb[2] * 0.5 + 20))
    elif freshness == "spoiled":
        base_rgb = (85, 65, 50)

    # Draw produce body with 3D gradient approximation
    bbox = [center_x - radius, center_y - radius, center_x + radius, center_y + radius]
    draw.ellipse(bbox, fill=base_rgb, outline=(int(base_rgb[0]*0.7), int(base_rgb[1]*0.7), int(base_rgb[2]*0.7)), width=3)

    # Highlight (Specular reflection)
    hl_box = [center_x - radius // 2, center_y - radius // 2, center_x - radius // 5, center_y - radius // 5]
    draw.ellipse(hl_box, fill=(min(255, base_rgb[0] + 60), min(255, base_rgb[1] + 60), min(255, base_rgb[2] + 60)))

    # Green Calyx / Stem for tomato, strawberry, apple
    if produce_type in ["tomato", "strawberry", "bell_pepper"]:
        stem_color = (35, 130, 30)
        draw.polygon([
            (center_x, center_y - radius - 15),
            (center_x - 18, center_y - radius + 10),
            (center_x + 18, center_y - radius + 10)
        ], fill=stem_color)
        draw.line([(center_x, center_y - radius + 5), (center_x, center_y - radius - 20)], fill=(25, 95, 20), width=4)

    # Defect spot if early spoilage or spoiled
    if freshness in ["early_spoilage", "spoiled", "moderately_fresh"]:
        spot_color = (75, 45, 30) if freshness != "moderately_fresh" else (160, 40, 25)
        spot_r = int(radius * 0.25)
        draw.ellipse([
            center_x + radius//3 - spot_r, center_y + radius//3 - spot_r,
            center_x + radius//3 + spot_r, center_y + radius//3 + spot_r
        ], fill=spot_color)

    # Apply mild organic smoothing
    img = img.filter(ImageFilter.SMOOTH_MORE)
    
    # Add subtle organic surface noise to ensure realistic sharpness
    noise_surf = np.random.randint(-10, 10, (h, w, 3), dtype=np.int16)
    final_np = np.clip(np.array(img, dtype=np.int16) + noise_surf, 0, 255).astype(np.uint8)
    return Image.fromarray(final_np)
