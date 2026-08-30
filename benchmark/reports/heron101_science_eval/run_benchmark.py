#!/usr/bin/env python3
"""
Run inference and benchmark evaluation of pretrained Heron-101 on a reproducible 100-sample
scientific paper test set (DocBank - arXiv scientific papers), with Column-Aware Reading Order sorting.
"""

from __future__ import annotations

import argparse
import contextlib
import hashlib
import io
import json
import os
import random
import sys
import time
from collections import defaultdict
from pathlib import Path
from typing import Any

import numpy as np
import torch
from PIL import Image, ImageDraw, ImageFont
from pycocotools.coco import COCO
from pycocotools.cocoeval import COCOeval
from transformers import AutoProcessor, AutoModelForObjectDetection


CURRENT_DIR = Path(__file__).resolve().parent
ROOT = CURRENT_DIR.parents[2] if len(CURRENT_DIR.parents) >= 3 else Path.cwd()
OUT_DIR = CURRENT_DIR if CURRENT_DIR.name == "heron101_science_eval" else ROOT / "benchmark" / "reports" / "heron101_science_eval"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_ID = "docling-project/docling-layout-heron-101"
CONFIDENCE_THRESHOLD = 0.20
IOU_THRESHOLD = 0.50

# Map Heron-101 raw classes to Unified 5-class schema for scientific documents
# 1: text, 2: title, 3: figure, 4: figure_caption, 5: equation
HERON_TO_UNIFIED_ID = {
    "text": 1,
    "list_item": 1,
    "footnote": 1,
    "title": 2,
    "section_header": 2,
    "picture": 3,
    "caption": 4,
    "formula": 5,
}

UNIFIED_CATEGORIES = [
    {"id": 1, "name": "text"},
    {"id": 2, "name": "title"},
    {"id": 3, "name": "figure"},
    {"id": 4, "name": "figure_caption"},
    {"id": 5, "name": "equation"},
]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()


def bbox_iou_xywh(a: list[float], b: list[float]) -> float:
    ax1, ay1, aw, ah = a
    bx1, by1, bw, bh = b
    ax2, ay2 = ax1 + aw, ay1 + ah
    bx2, by2 = bx1 + bw, by1 + bh
    ix1, iy1 = max(ax1, bx1), max(ay1, by1)
    ix2, iy2 = min(ax2, bx2), min(ay2, by2)
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = max(0.0, aw) * max(0.0, ah) + max(0.0, bw) * max(0.0, bh) - inter
    return inter / union if union > 0 else 0.0


def compute_prf(tp: int, fp: int, fn: int) -> dict[str, float | None]:
    p = tp / (tp + fp) if (tp + fp) > 0 else 0.0
    r = tp / (tp + fn) if (tp + fn) > 0 else 0.0
    f1 = 2 * p * r / (p + r) if (p + r) > 0 else 0.0
    return {"precision": p, "recall": r, "f1": f1}


def sort_scientific_reading_order(regions: list[dict[str, Any]], width: float, height: float) -> list[dict[str, Any]]:
    """
    Sort layout bounding boxes according to natural scientific paper reading order:
    1. Headers (Page-header) & Top Full-width Title
    2. Two-column flow:
       - Flush left-column regions (center_x < 0.5 * width) top-to-bottom
       - Flush right-column regions (center_x >= 0.5 * width) top-to-bottom
    3. Full-width blocks across page (wide figures, tables, formulas)
    4. Footers (Page-footer, footnotes)
    5. Assign sequential reading_order: 1, 2, 3, ...
    """
    if not regions:
        return []

    headers = [
        r for r in regions
        if r.get("raw_label") == "page_header" or (
            r.get("label") == "title" and
            r["bbox_pixel_xyxy"][1] < 0.15 * height and
            (r["bbox_pixel_xyxy"][2] - r["bbox_pixel_xyxy"][0]) > 0.5 * width
        )
    ]
    footers = [
        r for r in regions
        if r.get("raw_label") == "page_footer" or r["bbox_pixel_xyxy"][1] > 0.93 * height
    ]

    header_ids = {id(r) for r in headers}
    footer_ids = {id(r) for r in footers}
    body = [r for r in regions if id(r) not in header_ids and id(r) not in footer_ids]

    # Sort body blocks vertically by ymin
    body = sorted(body, key=lambda r: (r["bbox_pixel_xyxy"][1], r["bbox_pixel_xyxy"][0]))

    ordered: list[dict[str, Any]] = sorted(headers, key=lambda r: (r["bbox_pixel_xyxy"][1], r["bbox_pixel_xyxy"][0]))
    narrow_buffer: list[dict[str, Any]] = []

    def flush_columns():
        if not narrow_buffer:
            return
        left = [r for r in narrow_buffer if (r["bbox_pixel_xyxy"][0] + r["bbox_pixel_xyxy"][2]) / 2.0 < width * 0.5]
        right = [r for r in narrow_buffer if r not in left]
        # Sort left column top-to-bottom
        ordered.extend(sorted(left, key=lambda r: (r["bbox_pixel_xyxy"][1], r["bbox_pixel_xyxy"][0])))
        # Sort right column top-to-bottom
        ordered.extend(sorted(right, key=lambda r: (r["bbox_pixel_xyxy"][1], r["bbox_pixel_xyxy"][0])))
        narrow_buffer.clear()

    for r in body:
        w = r["bbox_pixel_xyxy"][2] - r["bbox_pixel_xyxy"][0]
        if w >= 0.65 * width:
            flush_columns()
            ordered.append(r)
        else:
            narrow_buffer.append(r)

    flush_columns()
    ordered.extend(sorted(footers, key=lambda r: (r["bbox_pixel_xyxy"][1], r["bbox_pixel_xyxy"][0])))

    # Gán số thứ tự đọc (reading_order: 1, 2, 3,...)
    for order_idx, r in enumerate(ordered, start=1):
        r["reading_order"] = order_idx

    return ordered


def prepare_sample_dataset(num_samples: int = 100, seed: int = 42, deterministic_order: bool = True) -> tuple[dict[str, Any], list[Path], dict[str, Any]]:
    src_gt_path = ROOT / "data" / "raw" / "docbank" / "annotations" / "test.json"
    img_dir = ROOT / "data" / "raw" / "docbank" / "images" / "test"

    with open(src_gt_path, "r", encoding="utf-8") as f:
        full_gt = json.load(f)

    if deterministic_order:
        selected_images = full_gt["images"][:num_samples]
    else:
        rng = random.Random(seed)
        selected_images = rng.sample(full_gt["images"], min(num_samples, len(full_gt["images"])))

    selected_image_ids = {img["id"] for img in selected_images}

    selected_annotations = [
        ann for ann in full_gt["annotations"]
        if ann["image_id"] in selected_image_ids
    ]

    subset_gt = {
        "images": selected_images,
        "annotations": selected_annotations,
        "categories": UNIFIED_CATEGORIES,
    }

    gt_out_path = OUT_DIR / "docbank_100_gt.json"
    with open(gt_out_path, "w", encoding="utf-8") as f:
        json.dump(subset_gt, f, indent=2)

    image_paths = []
    manifest_records = []
    for idx, img in enumerate(selected_images):
        fn = os.path.basename(img["file_name"])
        path = img_dir / fn
        if not path.exists():
            path = img_dir / f"{img['id']}.jpg"
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {path}")
        image_paths.append(path)

        file_hash = sha256_file(path)
        img_anns = [a for a in selected_annotations if a["image_id"] == img["id"]]
        manifest_records.append({
            "ordinal_index": idx,
            "image_id": img["id"],
            "file_name": img["file_name"],
            "relative_image_path": str(path.relative_to(ROOT)).replace("\\", "/"),
            "width": img["width"],
            "height": img["height"],
            "sha256": file_hash,
            "ground_truth_annotation_count": len(img_anns),
        })

    reproducibility_manifest = {
        "dataset_name": "DocBank (arXiv Scientific Papers)",
        "split": "test",
        "seed": seed,
        "selection_mode": "canonical_first_100_test_split" if deterministic_order else f"random_sample_seed_{seed}",
        "total_samples": len(selected_images),
        "total_annotations": len(selected_annotations),
        "source_annotation_file": "data/raw/docbank/annotations/test.json",
        "source_images_directory": "data/raw/docbank/images/test",
        "categories": UNIFIED_CATEGORIES,
        "sample_manifest": manifest_records,
    }

    manifest_path = OUT_DIR / "sample_reproducibility_manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(reproducibility_manifest, f, indent=2)

    print(f"Prepared {len(selected_images)} scientific paper images (Seed: {seed}). Manifest saved to {manifest_path.name}")
    return subset_gt, image_paths, reproducibility_manifest


def main():
    parser = argparse.ArgumentParser(description="Heron-101 Scientific Paper Benchmark & OCR-ready Layout Extraction with Reading Order")
    parser.add_argument("--num-samples", type=int, default=100, help="Number of test samples (default: 100)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for sample reproducibility (default: 42)")
    parser.add_argument("--device", type=str, default="cuda" if torch.cuda.is_available() else "cpu", help="Device (cuda/cpu)")
    args = parser.parse_args()

    random.seed(args.seed)
    np.random.seed(args.seed)
    torch.manual_seed(args.seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(args.seed)

    print("==================================================================")
    print("  HERON-101 SCIENTIFIC PAPER BENCHMARK & READING ORDER PIPELINE   ")
    print(f"  Seed: {args.seed} | Samples: {args.num_samples} | Device: {args.device}")
    print("==================================================================")

    subset_gt, image_paths, rep_manifest = prepare_sample_dataset(
        num_samples=args.num_samples, seed=args.seed, deterministic_order=True
    )
    gt_file_path = OUT_DIR / "docbank_100_gt.json"

    print(f"\n[1/4] Loading pretrained model: {MODEL_ID}...")
    device = args.device
    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForObjectDetection.from_pretrained(MODEL_ID)
    if device == "cuda":
        model = model.to("cuda", dtype=torch.float16)
        torch.cuda.reset_peak_memory_stats()
    model.eval()

    id2label = {int(k): v for k, v in model.config.id2label.items()}

    print("\n[2/4] Warming up model...")
    warmup_img = Image.open(image_paths[0]).convert("RGB")
    inputs = processor(images=[warmup_img], return_tensors="pt")
    inputs = {k: (v.to(device, dtype=torch.float16) if v.is_floating_point() else v.to(device)) for k, v in inputs.items()}
    with torch.inference_mode():
        _ = model(**inputs)
    if device == "cuda":
        torch.cuda.synchronize()

    print(f"\n[3/4] Running inference & Reading Order Sorting on {len(image_paths)} pages...")
    predictions_coco = []
    page_latencies = []
    sample_outputs = []
    ocr_ready_pages = []

    start_all = time.perf_counter()

    for idx, (img_info, img_path) in enumerate(zip(subset_gt["images"], image_paths)):
        img_id = img_info["id"]
        with Image.open(img_path) as handle:
            img = handle.convert("RGB")
            orig_w, orig_h = img.size

        if device == "cuda":
            torch.cuda.synchronize()
        t0 = time.perf_counter()

        inputs = processor(images=[img], return_tensors="pt")
        inputs = {k: (v.to(device, dtype=torch.float16) if v.is_floating_point() else v.to(device)) for k, v in inputs.items()}

        with torch.inference_mode():
            outputs = model(**inputs)

        target_sizes = torch.tensor([[orig_h, orig_w]], device=outputs.logits.device)
        results = processor.post_process_object_detection(outputs, target_sizes=target_sizes, threshold=0.05)[0]

        if device == "cuda":
            torch.cuda.synchronize()
        t1 = time.perf_counter()
        lat_ms = (t1 - t0) * 1000.0
        page_latencies.append(lat_ms)

        raw_page_regions = []

        for region_idx, (score, label_id, box) in enumerate(zip(results["scores"], results["labels"], results["boxes"])):
            raw_id = int(label_id.item())
            raw_label = id2label.get(raw_id, str(raw_id))
            conf = float(score.item())
            box_coords = [float(v) for v in box.tolist()]
            xmin, ymin, xmax, ymax = box_coords
            width = max(0.0, xmax - xmin)
            height = max(0.0, ymax - ymin)

            unified_cat_id = HERON_TO_UNIFIED_ID.get(raw_label)
            if unified_cat_id is None:
                continue

            unified_name = UNIFIED_CATEGORIES[unified_cat_id - 1]["name"]

            # Save to COCO predictions (for evaluation)
            coco_pred = {
                "image_id": img_id,
                "category_id": unified_cat_id,
                "bbox": [round(xmin, 2), round(ymin, 2), round(width, 2), round(height, 2)],
                "score": round(conf, 4),
                "raw_label": raw_label,
            }
            predictions_coco.append(coco_pred)

            if conf >= CONFIDENCE_THRESHOLD:
                norm_box = [
                    round(ymin / orig_h, 5),
                    round(xmin / orig_w, 5),
                    round(ymax / orig_h, 5),
                    round(xmax / orig_w, 5),
                ]
                raw_page_regions.append({
                    "region_id": region_idx,
                    "label": unified_name,
                    "raw_label": raw_label,
                    "confidence": round(conf, 4),
                    "bbox_pixel_xywh": [round(xmin, 2), round(ymin, 2), round(width, 2), round(height, 2)],
                    "bbox_pixel_xyxy": [round(xmin, 2), round(ymin, 2), round(xmax, 2), round(ymax, 2)],
                    "bbox_normalized": norm_box,
                    "should_ocr": unified_name in {"text", "title", "figure_caption", "equation"},
                    "is_visual_artifact": unified_name == "figure",
                })

        # --- ÁP DỤNG SORTING THỨ TỰ ĐỌC CHUẨN BÀI BÁO KHOA HỌC (READING ORDER) ---
        sorted_regions = sort_scientific_reading_order(raw_page_regions, orig_w, orig_h)

        ocr_ready_pages.append({
            "image_id": img_id,
            "file_name": img_info["file_name"],
            "relative_image_path": str(img_path.relative_to(ROOT)).replace("\\", "/"),
            "width": orig_w,
            "height": orig_h,
            "sha256": rep_manifest["sample_manifest"][idx]["sha256"],
            "layout_model": MODEL_ID,
            "latency_ms": round(lat_ms, 2),
            "regions_count": len(sorted_regions),
            "reading_order_sorted": True,
            "regions": sorted_regions,
        })

        if idx < 5:
            sample_outputs.append({
                "image_id": img_id,
                "file_name": img_info["file_name"],
                "dimensions": {"width": orig_w, "height": orig_h},
                "latency_ms": round(lat_ms, 2),
                "detections_count": len(sorted_regions),
                "reading_order_sorted": True,
                "detections": sorted_regions,
            })
            # Draw preview with reading order badges
            draw_img = img.copy()
            draw = ImageDraw.Draw(draw_img)
            colors = {
                "text": "#1f77b4",          # blue
                "title": "#d62728",         # red
                "figure": "#2ca02c",        # green
                "figure_caption": "#ff7f0e",# orange
                "equation": "#9467bd",      # purple
            }
            for p in sorted_regions:
                bx, by, bw, bh = p["bbox_pixel_xywh"]
                cname = p["label"]
                order_num = p["reading_order"]
                color = colors.get(cname, "#333333")
                draw.rectangle([bx, by, bx + bw, by + bh], outline=color, width=2)
                # Badge with reading order
                badge_text = f"#{order_num} {cname} {p['confidence']:.2f}"
                draw.rectangle([bx, max(0, by - 14), bx + len(badge_text) * 7 + 4, max(0, by)], fill=color)
                draw.text((bx + 2, max(0, by - 14)), badge_text, fill="white")

            preview_file = OUT_DIR / f"preview_sample_{idx + 1}_img{img_id}.jpg"
            draw_img.save(preview_file, "JPEG")

        if (idx + 1) % 20 == 0 or (idx + 1) == len(image_paths):
            print(f"  Processed {idx + 1}/{len(image_paths)} pages (avg latency: {np.mean(page_latencies):.2f} ms/page)")

    total_time = time.perf_counter() - start_all
    peak_vram_gb = torch.cuda.max_memory_allocated() / (1024 ** 3) if device == "cuda" else 0.0

    print(f"\nInference & Reading Order Sorting completed in {total_time:.2f}s:")
    print(f"  Mean latency per page: {np.mean(page_latencies):.2f} ms")
    print(f"  Throughput: {len(image_paths) / total_time:.2f} pages/sec")
    print(f"  Peak GPU VRAM: {peak_vram_gb:.2f} GB")

    pred_path = OUT_DIR / "heron101_docbank_100_predictions.json"
    with open(pred_path, "w", encoding="utf-8") as f:
        json.dump(predictions_coco, f, indent=2)

    sample_path = OUT_DIR / "heron101_sample_inference_outputs.json"
    with open(sample_path, "w", encoding="utf-8") as f:
        json.dump(sample_outputs, f, indent=2)

    ocr_layout_path = OUT_DIR / "heron101_ocr_ready_layout.json"
    with open(ocr_layout_path, "w", encoding="utf-8") as f:
        json.dump({
            "schema_version": "2.0_reading_order",
            "seed": args.seed,
            "model_id": MODEL_ID,
            "reading_order_sorted": True,
            "sorting_algorithm": "two_column_scientific_reading_order",
            "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
            "dataset": "DocBank arXiv Scientific Papers (100 Sample Test Split)",
            "pages_count": len(ocr_ready_pages),
            "documents": ocr_ready_pages,
        }, f, indent=2)

    print("\n[4/4] Evaluating with pycocotools & computing PRF metrics...")
    coco_gt = COCO(str(gt_file_path))
    coco_dt = coco_gt.loadRes(str(pred_path))

    coco_eval = COCOeval(coco_gt, coco_dt, "bbox")
    coco_eval.evaluate()
    coco_eval.accumulate()

    stream = io.StringIO()
    with contextlib.redirect_stdout(stream):
        coco_eval.summarize()
    eval_summary_str = stream.getvalue()
    print(eval_summary_str)

    stats = coco_eval.stats
    coco_metrics = {
        "mAP50-95": float(stats[0]),
        "mAP50": float(stats[1]),
        "mAP75": float(stats[2]),
        "AP_small": float(stats[3]),
        "AP_medium": float(stats[4]),
        "AP_large": float(stats[5]),
        "AR_1": float(stats[6]),
        "AR_10": float(stats[7]),
        "AR_100": float(stats[8]),
        "AR_small": float(stats[9]),
        "AR_medium": float(stats[10]),
        "AR_large": float(stats[11]),
    }

    per_class_ap = {}
    for cat in UNIFIED_CATEGORIES:
        cid = cat["id"]
        cname = cat["name"]
        cat_eval = COCOeval(coco_gt, coco_dt, "bbox")
        cat_eval.params.catIds = [cid]
        cat_eval.evaluate()
        cat_eval.accumulate()
        dummy_io = io.StringIO()
        with contextlib.redirect_stdout(dummy_io):
            cat_eval.summarize()
        c_stats = cat_eval.stats
        per_class_ap[cname] = {
            "category_id": cid,
            "mAP50-95": float(c_stats[0]) if len(c_stats) > 0 and c_stats[0] >= 0 else 0.0,
            "mAP50": float(c_stats[1]) if len(c_stats) > 1 and c_stats[1] >= 0 else 0.0,
            "mAP75": float(c_stats[2]) if len(c_stats) > 2 and c_stats[2] >= 0 else 0.0,
        }

    gts = defaultdict(list)
    preds = defaultdict(list)
    for ann in subset_gt["annotations"]:
        gts[(int(ann["image_id"]), int(ann["category_id"]))].append(ann)
    for pred in predictions_coco:
        if float(pred["score"]) >= CONFIDENCE_THRESHOLD:
            preds[(int(pred["image_id"]), int(pred["category_id"]))].append(pred)

    class_counts = {c["id"]: {"tp": 0, "fp": 0, "fn": 0, "name": c["name"]} for c in UNIFIED_CATEGORIES}
    for key in set(gts) | set(preds):
        _, cat_id = key
        truth = gts.get(key, [])
        dets = sorted(preds.get(key, []), key=lambda x: x["score"], reverse=True)
        used = set()
        for det in dets:
            best_idx, best_iou = None, 0.0
            for idx, ann in enumerate(truth):
                if idx in used:
                    continue
                iou = bbox_iou_xywh(det["bbox"], ann["bbox"])
                if iou > best_iou:
                    best_idx, best_iou = idx, iou
            if best_idx is not None and best_iou >= IOU_THRESHOLD:
                used.add(best_idx)
                class_counts[cat_id]["tp"] += 1
            else:
                class_counts[cat_id]["fp"] += 1
        class_counts[cat_id]["fn"] += len(truth) - len(used)

    per_class_prf = {}
    tot_tp, tot_fp, tot_fn = 0, 0, 0
    for cid, counts in class_counts.items():
        tot_tp += counts["tp"]
        tot_fp += counts["fp"]
        tot_fn += counts["fn"]
        res = compute_prf(counts["tp"], counts["fp"], counts["fn"])
        per_class_prf[counts["name"]] = {
            "category_id": cid,
            "tp": counts["tp"],
            "fp": counts["fp"],
            "fn": counts["fn"],
            "precision": round(res["precision"], 4),
            "recall": round(res["recall"], 4),
            "f1": round(res["f1"], 4),
            "mAP50-95": round(per_class_ap[counts["name"]]["mAP50-95"], 4),
            "mAP50": round(per_class_ap[counts["name"]]["mAP50"], 4),
            "mAP75": round(per_class_ap[counts["name"]]["mAP75"], 4),
        }

    global_prf = compute_prf(tot_tp, tot_fp, tot_fn)

    final_report = {
        "benchmark_metadata": {
            "model_name": "Heron-101 (Pretrained Original)",
            "model_id": MODEL_ID,
            "architecture": "RT-DETRv2-ResNet101",
            "weights_source": "HuggingFace Official docling-project/docling-layout-heron-101",
            "dataset_name": "DocBank (arXiv Scientific Papers)",
            "reproducibility_seed": args.seed,
            "reading_order_sorted": True,
            "sorting_algorithm": "two_column_scientific_reading_order",
            "sample_count": len(image_paths),
            "ground_truth_annotations_count": len(subset_gt["annotations"]),
            "confidence_threshold": CONFIDENCE_THRESHOLD,
            "iou_threshold": IOU_THRESHOLD,
            "hardware": {
                "gpu": torch.cuda.get_device_name(0) if device == "cuda" else "CPU",
                "dtype": "FP16" if device == "cuda" else "FP32",
            }
        },
        "performance_metrics": {
            "mean_latency_ms_per_page": round(float(np.mean(page_latencies)), 2),
            "median_latency_ms_per_page": round(float(np.median(page_latencies)), 2),
            "throughput_pages_per_sec": round(float(len(image_paths) / total_time), 2),
            "peak_vram_gb": round(float(peak_vram_gb), 2),
            "total_inference_time_sec": round(float(total_time), 2),
        },
        "coco_detection_metrics": coco_metrics,
        "global_classification_metrics": {
            "tp": tot_tp,
            "fp": tot_fp,
            "fn": tot_fn,
            "precision": round(global_prf["precision"], 4),
            "recall": round(global_prf["recall"], 4),
            "f1": round(global_prf["f1"], 4),
        },
        "per_class_breakdown": per_class_prf,
    }

    report_path = OUT_DIR / "heron101_benchmark_metrics.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(final_report, f, indent=2)

    manifest_path = OUT_DIR / "sample_reproducibility_manifest.json"
    print("\n==================================================")
    print("              EVALUATION RESULTS SUMMARY          ")
    print("==================================================")
    print(f"Seed: {args.seed} (Fully Reproducible with Reading Order)")
    print(f"Saved reproducibility manifest to: {manifest_path.name}")
    print(f"Saved OCR-ready layout format (Sorted) to: {ocr_layout_path.name}")
    print(f"Saved metric report to: {report_path.name}")


if __name__ == "__main__":
    main()
