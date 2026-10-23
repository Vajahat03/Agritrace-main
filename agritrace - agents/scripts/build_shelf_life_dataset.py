"""CLI wrapper for the isolated shelf-life data pipeline."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_pipeline.build_dataset import build
from data_pipeline.generate_dictionary import OUTPUT as DICTIONARY_OUTPUT


if __name__ == "__main__":
    DICTIONARY_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    from data_pipeline.generate_dictionary import TEXT
    DICTIONARY_OUTPUT.write_text(TEXT, encoding="utf-8")
    build()
