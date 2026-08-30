#!/usr/bin/env python3
"""
Example showing how to load the Heron-101 OCR-ready layout format
and crop bounding boxes for downstream OCR engines (PaddleOCR, PyMuPDF, etc.).
"""

import json
from pathlib import Path
from PIL import Image

CURRENT_DIR = Path(__file__).resolve().parent
ROOT = CURRENT_DIR.parents[2] if len(CURRENT_DIR.parents) >= 3 else Path.cwd()

LAYOUT_FILE = CURRENT_DIR / "heron101_ocr_ready_layout.json"


def main():
    print("=" * 60)
    print("  OCR INGESTION FROM HERON-101 LAYOUT DETECTIONS")
    print("=" * 60)

    if not LAYOUT_FILE.exists():
        raise FileNotFoundError(f"Layout file not found at {LAYOUT_FILE}")

    with open(LAYOUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    print(f"Loaded {data['pages_count']} documents from: {LAYOUT_FILE.name}")
    print(f"Model used: {data['model_id']} | Seed: {data['seed']}")

    # Process first 3 sample documents
    for doc_idx, doc in enumerate(data["documents"][:3]):
        img_path = ROOT / doc["relative_image_path"]
        if not img_path.exists():
            print(f"Warning: Image file not found: {img_path}")
            continue

        img = Image.open(img_path).convert("RGB")
        ocr_regions = [r for r in doc["regions"] if r["should_ocr"]]
        visual_regions = [r for r in doc["regions"] if r["is_visual_artifact"]]

        print(f"\n[Page {doc_idx + 1}] ID: {doc['image_id']} | {doc['file_name']}")
        print(f"  Dimensions: {doc['width']}x{doc['height']} px | SHA256: {doc['sha256'][:12]}...")
        print(f"  Total Regions: {len(doc['regions'])} | Reading Order Sorted: {doc.get('reading_order_sorted', False)}")
        print(f"  Text/OCR Regions: {len(ocr_regions)} | Visual Figures: {len(visual_regions)}")

        # Demonstrate ROI cropping following reading order
        print("  -> First 5 regions in natural reading order:")
        for r_idx, region in enumerate(ocr_regions[:5]):
            xmin, ymin, xmax, ymax = region["bbox_pixel_xyxy"]
            cropped = img.crop((xmin, ymin, xmax, ymax))
            order_num = region.get("reading_order", r_idx + 1)
            print(f"     Order #{order_num:02d} [{region['label']:14s}] (conf={region['confidence']:.2f}) -> ROI Crop: {cropped.size} px at [x={xmin:.0f}, y={ymin:.0f}]")

    print("\n" + "=" * 60)
    print("Ready for OCR engines (PaddleOCR / PyMuPDF / Tesseract).")
    print("=" * 60)


if __name__ == "__main__":
    main()
