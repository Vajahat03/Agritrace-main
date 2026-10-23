"""
AgriTrace Image Augmentations & Transforms
Provides calibrated transforms that preserve post-harvest spoilage and defect signatures.
"""

import torchvision.transforms as transforms

IMAGENET_MEAN = [0.485, 0.456, 0.406]
IMAGENET_STD = [0.229, 0.224, 0.225]

def get_train_transforms(image_size: int = 224) -> transforms.Compose:
    """
    Moderate agricultural augmentation pipeline:
    Preserves visual discoloration, mold patterns, and texture cues.
    """
    return transforms.Compose([
        transforms.Resize((int(image_size * 1.14), int(image_size * 1.14))),
        transforms.RandomCrop((image_size, image_size)),
        transforms.RandomHorizontalFlip(p=0.5),
        transforms.RandomRotation(degrees=15),
        transforms.ColorJitter(brightness=0.15, contrast=0.15, saturation=0.15, hue=0.04),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

def get_val_transforms(image_size: int = 224) -> transforms.Compose:
    """Standard validation and evaluation transform."""
    return transforms.Compose([
        transforms.Resize((int(image_size * 1.14), int(image_size * 1.14))),
        transforms.CenterCrop((image_size, image_size)),
        transforms.ToTensor(),
        transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
    ])

def get_robustness_transforms(distortion_type: str, image_size: int = 224) -> transforms.Compose:
    """Applies specific environmental distortions for robustness testing."""
    if distortion_type == "blur":
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.GaussianBlur(kernel_size=(7, 7), sigma=(2.0, 3.0)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
        ])
    elif distortion_type == "low_light":
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ColorJitter(brightness=(0.3, 0.4)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
        ])
    elif distortion_type == "high_glare":
        return transforms.Compose([
            transforms.Resize((image_size, image_size)),
            transforms.ColorJitter(brightness=(1.5, 1.8), contrast=(1.3, 1.6)),
            transforms.ToTensor(),
            transforms.Normalize(mean=IMAGENET_MEAN, std=IMAGENET_STD)
        ])
    else:
        return get_val_transforms(image_size)
