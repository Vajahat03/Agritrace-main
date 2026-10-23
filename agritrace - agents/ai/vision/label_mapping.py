"""
AgriTrace Vision Label Mappings & Schema Standardization
Evidence-based mappings translating heterogeneous raw dataset taxonomies into the standardized AgriTrace schema.
Missing annotations remain None / missing (-1) and are never fabricated.
"""

from typing import Dict, List, Optional, Any

# Supported AgriTrace Produce Classes (9 classes including Unknown)
PRODUCE_CLASSES: List[str] = [
    "Tomato", "Apple", "Banana", "Potato", "Onion", 
    "Orange", "Bell Pepper", "Strawberry", "Unknown"
]
PRODUCE_TO_IDX: Dict[str, int] = {name: idx for idx, name in enumerate(PRODUCE_CLASSES)}
IDX_TO_PRODUCE: Dict[int, str] = {idx: name for idx, name in enumerate(PRODUCE_CLASSES)}

# Standardized Freshness Grades (4 classes - Ordinal)
FRESHNESS_GRADES: List[str] = [
    "Fresh", "Moderately Fresh", "Early Spoilage", "Spoiled"
]
FRESHNESS_TO_IDX: Dict[str, int] = {name: idx for idx, name in enumerate(FRESHNESS_GRADES)}
IDX_TO_FRESHNESS: Dict[int, str] = {idx: name for idx, name in enumerate(FRESHNESS_GRADES)}

# Standardized Defect Types (6 classes)
DEFECT_TYPES: List[str] = [
    "None", "Bruise", "Soft Spot", "Cut", "Mold", "Other"
]
DEFECT_TO_IDX: Dict[str, int] = {name: idx for idx, name in enumerate(DEFECT_TYPES)}
IDX_TO_DEFECT: Dict[int, str] = {idx: name for idx, name in enumerate(DEFECT_TYPES)}

def normalize_agrifreshnet_label(folder_name: str) -> Dict[str, Optional[Any]]:
    """
    Normalizes AgriFreshNET category folder names.
    Extracts produce, freshness stage, and shelf-life interval where explicitly provided.
    Defect type is NOT fabricated and set to None unless verified.
    """
    clean = folder_name.lower().strip()
    
    # 1. Produce mapping
    produce = "Unknown"
    for p in ["Tomato", "Apple", "Banana", "Potato", "Onion", "Orange", "Bell Pepper", "Strawberry"]:
        if p.lower() in clean:
            produce = p
            break
            
    # 2. Freshness mapping
    freshness = None
    if clean.startswith("fresh"):
        freshness = "Fresh"
    elif clean.startswith("semi fresh") or clean.startswith("semi_fresh"):
        freshness = "Moderately Fresh"
    elif clean.startswith("rotten") or clean.startswith("rot"):
        freshness = "Spoiled"
        
    # 3. Defect: Not explicitly classified in AgriFreshNET -> None (missing)
    defect = None
    
    # 4. Quality approximation from freshness if available (continuous 0-100)
    quality = None
    if freshness == "Fresh":
        quality = 90.0
    elif freshness == "Moderately Fresh":
        quality = 65.0
    elif freshness == "Spoiled":
        quality = 20.0
        
    return {
        "produce": produce,
        "freshness": freshness,
        "quality": quality,
        "defect": defect
    }

def normalize_banana_guava_label(produce_name: str, grade_folder: str) -> Dict[str, Optional[Any]]:
    """
    Normalizes Banana and Guava Non-destructive Quality dataset labels.
    Taxonomy: Class_A (Premium), Class_B (Medium), Defect (Surface / Shape Defects).
    """
    clean_prod = produce_name.strip()
    clean_grade = grade_folder.strip().lower()
    
    produce = "Banana" if clean_prod.lower() == "banana" else "Unknown"
    
    if "class_a" in clean_grade or "class a" in clean_grade:
        freshness = "Fresh"
        quality = 95.0
        defect = "None"
    elif "class_b" in clean_grade or "class b" in clean_grade:
        freshness = "Moderately Fresh"
        quality = 75.0
        defect = None  # Specific defect subtype not specified in dataset
    elif "defect" in clean_grade:
        freshness = None  # Freshness stage not explicitly specified
        quality = 30.0
        defect = "Other"  # General defect annotation
    else:
        freshness = None
        quality = None
        defect = None
        
    return {
        "produce": produce,
        "freshness": freshness,
        "quality": quality,
        "defect": defect
    }

def normalize_fruitnet_label(folder_name_or_parent: str, folder_name: Optional[str] = None) -> Dict[str, Optional[Any]]:
    """
    Normalizes FruitNet Indian Fruits Dataset quality folder names.
    Taxonomy: Good Quality_Fruits, Bad Quality_Fruits, Mixed Qualit_Fruits.
    """
    if folder_name is not None:
        p_clean = folder_name_or_parent.lower().strip()
        f_clean = folder_name.lower().strip()
    else:
        p_clean = ""
        f_clean = folder_name_or_parent.lower().strip()
    
    produce = "Unknown"
    for p in ["Apple", "Banana", "Orange", "Tomato"]:
        if p.lower() in f_clean or p.lower() in p_clean:
            produce = p
            break
            
    freshness = None
    quality = None
    defect = None
    
    if "good" in p_clean or "good" in f_clean or f_clean.endswith("_good"):
        quality = 90.0
        freshness = "Fresh"
        defect = "None"
    elif "bad" in p_clean or "bad" in f_clean or f_clean.endswith("_bad"):
        quality = 25.0
        freshness = "Spoiled"
        defect = None  # Do NOT invent Mold/Bruise for bad fruit
    elif "mixed" in p_clean or "mixed" in f_clean:
        quality = 55.0
        freshness = "Moderately Fresh"
        defect = None
        
    return {
        "produce": produce,
        "freshness": freshness,
        "quality": quality,
        "defect": defect
    }

