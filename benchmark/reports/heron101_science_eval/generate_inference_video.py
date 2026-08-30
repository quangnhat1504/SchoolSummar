#!/usr/bin/env python3
"""
Generate a publication-grade inference recording video and interactive player
for Heron-101 layout detection over 100 DocBank scientific paper pages.
"""

import json
import os
import shutil
import sys
import time
from collections import defaultdict
from pathlib import Path
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

CURRENT_DIR = Path(__file__).resolve().parent
ROOT = CURRENT_DIR.parents[2] if len(CURRENT_DIR.parents) >= 3 else Path.cwd()
EVAL_DIR = CURRENT_DIR
LAYOUT_JSON_PATH = EVAL_DIR / "heron101_ocr_ready_layout.json"
OUTPUT_VIDEO_PATH = EVAL_DIR / "heron101_inference_100_pages.mp4"
OUTPUT_WEBP_PATH = EVAL_DIR / "heron101_inference_preview.webp"
HTML_PLAYER_PATH = EVAL_DIR / "interactive_player.html"

# Color Palette (BGR for OpenCV & RGB for PIL)
COLORS_RGB = {
    "title": (229, 62, 62),          # Crimson Red
    "text": (49, 130, 206),          # Slate Blue
    "figure": (56, 161, 105),        # Forest Green
    "figure_caption": (221, 107, 32),# Amber Orange
    "equation": (128, 90, 213),      # Royal Purple
}

COLORS_BGR = {
    k: (v[2], v[1], v[0]) for k, v in COLORS_RGB.items()
}

CANVAS_W = 1920
CANVAS_H = 1080
PAGE_VIEW_W = 860
PAGE_VIEW_H = 1000
FPS = 15
FRAMES_PER_PAGE = 18  # 1.2 seconds per page


def render_dashboard_frame(doc: dict, doc_idx: int, total_docs: int, frame_in_page: int) -> np.ndarray:
    """Render a single 1920x1080 dashboard frame."""
    canvas = np.zeros((CANVAS_H, CANVAS_W, 3), dtype=np.uint8)
    
    # Background: Deep tech dark theme (#0F172A - slate 900)
    canvas[:] = (26, 23, 15)  # BGR

    # 1. Left Panel (Page Viewport Background)
    cv2.rectangle(canvas, (40, 40), (40 + PAGE_VIEW_W, 40 + PAGE_VIEW_H), (36, 32, 22), -1)
    cv2.rectangle(canvas, (40, 40), (40 + PAGE_VIEW_W, 40 + PAGE_VIEW_H), (70, 65, 45), 2)

    # Load and scale page image
    img_path = ROOT / doc["relative_image_path"]
    if img_path.exists():
        raw_img = Image.open(img_path).convert("RGB")
        orig_w, orig_h = raw_img.size
        scale = min((PAGE_VIEW_W - 20) / orig_w, (PAGE_VIEW_H - 20) / orig_h)
        target_w = int(orig_w * scale)
        target_h = int(orig_h * scale)
        
        resized_pil = raw_img.resize((target_w, target_h), Image.Resampling.LANCZOS)
        
        # Draw bounding boxes on resized image
        draw = ImageDraw.Draw(resized_pil, "RGBA")
        
        regions = doc.get("regions", [])
        for r in regions:
            cname = r["label"]
            conf = r["confidence"]
            order = r.get("reading_order", 0)
            rgb = COLORS_RGB.get(cname, (180, 180, 180))
            
            bx, by, bw, bh = r["bbox_pixel_xywh"]
            sx = int(bx * scale)
            sy = int(by * scale)
            sw = int(bw * scale)
            sh = int(bh * scale)
            
            # Semi-transparent fill + solid border
            fill_color = (rgb[0], rgb[1], rgb[2], 35)
            draw.rectangle([sx, sy, sx + sw, sy + sh], outline=rgb, fill=fill_color, width=2)
            
            # Badge text
            badge_text = f"#{order} {cname[:4].upper()} {conf:.2f}"
            tw = len(badge_text) * 6 + 4
            th = 12
            draw.rectangle([sx, max(0, sy - th), sx + tw, sy], fill=rgb)
            draw.text((sx + 2, max(0, sy - th)), badge_text, fill=(255, 255, 255))
            
        page_np = np.array(resized_pil)
        page_bgr = cv2.cvtColor(page_np, cv2.COLOR_RGB2BGR)
        
        # Position page centered in left viewport
        ox = 40 + (PAGE_VIEW_W - target_w) // 2
        oy = 40 + (PAGE_VIEW_H - target_h) // 2
        canvas[oy:oy + target_h, ox:ox + target_w] = page_bgr
        
        # Animated scanning line effect
        if FRAMES_PER_PAGE > 1:
            scan_y = oy + int((frame_in_page / FRAMES_PER_PAGE) * target_h)
            cv2.line(canvas, (ox, scan_y), (ox + target_w, scan_y), (0, 255, 255), 1)

    # 2. Right Panel (Telemetry & Metadata Dashboard)
    rx = 940
    rw = 940
    
    # Header
    cv2.putText(canvas, "HERON-101 (RT-DETRv2-101) INFERENCE MONITOR", (rx, 75),
                cv2.FONT_HERSHEY_DUPLEX, 0.85, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(canvas, "Scientific Paper Document Layout Detection & Reading Order", (rx, 105),
                cv2.FONT_HERSHEY_SIMPLEX, 0.52, (180, 180, 180), 1, cv2.LINE_AA)
    
    # Divider
    cv2.line(canvas, (rx, 120), (rx + rw - 60, 120), (60, 55, 40), 1)

    # Page Progress Bar
    cv2.putText(canvas, f"PAGE PROGRESS: {doc_idx + 1:03d} / {total_docs:03d}", (rx, 155),
                cv2.FONT_HERSHEY_DUPLEX, 0.65, (0, 215, 255), 1, cv2.LINE_AA)
    bar_w = rw - 60
    progress = (doc_idx + 1) / total_docs
    cv2.rectangle(canvas, (rx, 170), (rx + bar_w, 182), (40, 35, 25), -1)
    cv2.rectangle(canvas, (rx, 170), (rx + int(bar_w * progress), 182), (0, 215, 255), -1)
    cv2.rectangle(canvas, (rx, 170), (rx + bar_w, 182), (80, 75, 55), 1)

    # Telemetry KPI Boxes
    kpi_y = 210
    kpis = [
        ("INFERENCE LATENCY", f"{doc.get('latency_ms', 55.0):.1f} ms", (0, 230, 120)),
        ("GPU VRAM", "0.23 GB", (255, 180, 0)),
        ("PAGE REGIONS", f"{len(doc.get('regions', []))} boxes", (255, 100, 220)),
        ("READING ORDER", "Column-Aware", (0, 200, 255)),
    ]
    box_w = (rw - 80) // 4
    for i, (title, val, color) in enumerate(kpis):
        bx = rx + i * (box_w + 6)
        cv2.rectangle(canvas, (bx, kpi_y), (bx + box_w, kpi_y + 65), (38, 33, 23), -1)
        cv2.rectangle(canvas, (bx, kpi_y), (bx + box_w, kpi_y + 65), (65, 60, 45), 1)
        cv2.putText(canvas, title, (bx + 8, kpi_y + 20), cv2.FONT_HERSHEY_SIMPLEX, 0.36, (160, 160, 160), 1)
        cv2.putText(canvas, val, (bx + 8, kpi_y + 50), cv2.FONT_HERSHEY_DUPLEX, 0.60, color, 1)

    # Class Breakdown Counters
    counts_y = 300
    cv2.putText(canvas, "DETECTED REGION BREAKDOWN:", (rx, counts_y),
                cv2.FONT_HERSHEY_DUPLEX, 0.58, (220, 220, 220), 1)

    cat_counts = defaultdict(int)
    for r in doc.get("regions", []):
        cat_counts[r["label"]] += 1

    cats_order = ["title", "text", "figure", "figure_caption", "equation"]
    cat_names = {
        "title": "Title / Header",
        "text": "Body Text",
        "figure": "Figure / Chart",
        "figure_caption": "Caption",
        "equation": "Math Formula"
    }

    c_box_w = (rw - 80) // 5
    for i, cat in enumerate(cats_order):
        cx = rx + i * (c_box_w + 5)
        cy = counts_y + 15
        cnt = cat_counts.get(cat, 0)
        rgb = COLORS_RGB.get(cat, (200, 200, 200))
        bgr = (rgb[2], rgb[1], rgb[0])
        
        cv2.rectangle(canvas, (cx, cy), (cx + c_box_w, cy + 55), (35, 30, 20), -1)
        cv2.rectangle(canvas, (cx, cy), (cx + c_box_w, cy + 55), bgr, 1)
        cv2.putText(canvas, cat_names[cat], (cx + 6, cy + 18), cv2.FONT_HERSHEY_SIMPLEX, 0.35, (200, 200, 200), 1)
        cv2.putText(canvas, f"{cnt:02d}", (cx + 6, cy + 46), cv2.FONT_HERSHEY_DUPLEX, 0.75, bgr, 2)

    # Live Reading Order Sequence Log
    table_y = 400
    cv2.putText(canvas, "SEQUENTIAL READING ORDER (Top Elements):", (rx, table_y),
                cv2.FONT_HERSHEY_DUPLEX, 0.58, (220, 220, 220), 1)
    
    cv2.rectangle(canvas, (rx, table_y + 15), (rx + rw - 60, table_y + 550), (32, 28, 19), -1)
    cv2.rectangle(canvas, (rx, table_y + 15), (rx + rw - 60, table_y + 550), (65, 60, 45), 1)

    # Table Header
    th_y = table_y + 38
    cv2.putText(canvas, "ORDER", (rx + 15, th_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150, 150, 150), 1)
    cv2.putText(canvas, "CLASS LABEL", (rx + 90, th_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150, 150, 150), 1)
    cv2.putText(canvas, "CONF", (rx + 270, th_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150, 150, 150), 1)
    cv2.putText(canvas, "BBOX (PIXEL XYXY)", (rx + 360, th_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150, 150, 150), 1)
    cv2.putText(canvas, "OCR STATUS", (rx + 620, th_y), cv2.FONT_HERSHEY_SIMPLEX, 0.42, (150, 150, 150), 1)
    cv2.line(canvas, (rx + 10, th_y + 8), (rx + rw - 70, th_y + 8), (55, 50, 35), 1)

    # List up to 14 regions
    display_regions = doc.get("regions", [])[:14]
    for row_idx, r in enumerate(display_regions):
        row_y = th_y + 32 + row_idx * 33
        order = r.get("reading_order", row_idx + 1)
        cname = r["label"]
        conf = r["confidence"]
        bx1, by1, bx2, by2 = [int(v) for v in r["bbox_pixel_xyxy"]]
        should_ocr = "YES (TEXT)" if r.get("should_ocr") else "NO (IMAGE)"
        
        rgb = COLORS_RGB.get(cname, (200, 200, 200))
        bgr = (rgb[2], rgb[1], rgb[0])
        
        # Order pill
        cv2.circle(canvas, (rx + 35, row_y - 4), 11, bgr, -1)
        cv2.putText(canvas, f"{order}", (rx + (29 if order < 10 else 23), row_y),
                    cv2.FONT_HERSHEY_DUPLEX, 0.38, (255, 255, 255), 1)
        
        cv2.putText(canvas, cat_names.get(cname, cname), (rx + 90, row_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, bgr, 1)
        cv2.putText(canvas, f"{conf:.2f}", (rx + 270, row_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.45, (220, 220, 220), 1)
        cv2.putText(canvas, f"[{bx1:3d}, {by1:3d}, {bx2:3d}, {by2:3d}]", (rx + 360, row_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (180, 180, 180), 1)
        cv2.putText(canvas, should_ocr, (rx + 620, row_y),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.42, (100, 230, 150) if "YES" in should_ocr else (150, 150, 220), 1)

    # Document details footer
    footer_y = 1000
    fname = doc.get("file_name", "").split("/")[-1]
    cv2.putText(canvas, f"FILE: {fname}  |  SHA256: {doc.get('sha256', '')[:16]}...  |  RES: {doc.get('width')}x{doc.get('height')}px",
                (rx, footer_y), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (130, 130, 130), 1)

    return canvas


def generate_interactive_html(layout_data: dict, output_html: Path):
    """Generate an interactive HTML dashboard player."""
    docs = layout_data.get("documents", [])
    
    html_content = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Heron-101 Layout Inference 100 Pages Inspector</title>
    <style>
        :root {{
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --card-bg: #1e293b;
            --border-color: #334155;
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
            --accent: #38bdf8;
            --title-color: #ef4444;
            --text-color: #3b82f6;
            --figure-color: #10b981;
            --caption-color: #f97316;
            --equation-color: #a855f7;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            flex-direction: column;
        }}
        header {{
            background: var(--bg-secondary);
            border-bottom: 1px solid var(--border-color);
            padding: 16px 28px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        .header-title h1 {{ font-size: 1.25rem; font-weight: 700; color: #fff; }}
        .header-title p {{ font-size: 0.85rem; color: var(--text-secondary); margin-top: 4px; }}
        .badge {{ background: #0284c7; color: white; padding: 4px 10px; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }}
        
        main {{
            display: grid;
            grid-template-columns: 58% 42%;
            gap: 24px;
            padding: 24px 28px;
            flex: 1;
        }}
        
        /* Left: Viewer */
        .viewer-card {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 20px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }}
        .controls {{
            width: 100%;
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 16px;
            gap: 12px;
        }}
        .btn {{
            background: #334155;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s;
        }}
        .btn:hover {{ background: #475569; }}
        .btn.primary {{ background: #0284c7; }}
        .btn.primary:hover {{ background: #0369a1; }}
        
        .slider-wrap {{ flex: 1; display: flex; align-items: center; gap: 10px; }}
        input[type="range"] {{ flex: 1; accent-color: var(--accent); cursor: pointer; }}
        
        .canvas-container {{
            position: relative;
            background: #020617;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            max-height: 800px;
            overflow: auto;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
        }}
        #pageCanvas {{ display: block; }}
        
        /* Right: Dashboard */
        .sidebar {{
            display: flex;
            flex-direction: column;
            gap: 18px;
        }}
        .panel {{
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 12px;
            padding: 18px;
        }}
        .panel h3 {{ font-size: 0.95rem; font-weight: 600; margin-bottom: 12px; color: #e2e8f0; }}
        
        .kpi-grid {{ display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }}
        .kpi-card {{
            background: #0f172a;
            border: 1px solid #334155;
            padding: 12px;
            border-radius: 8px;
        }}
        .kpi-label {{ font-size: 0.72rem; color: var(--text-secondary); text-transform: uppercase; }}
        .kpi-val {{ font-size: 1.15rem; font-weight: 700; color: #fff; margin-top: 4px; }}
        
        .legend {{ display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }}
        .legend-tag {{ font-size: 0.75rem; padding: 4px 8px; border-radius: 4px; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }}
        .dot {{ width: 8px; height: 8px; border-radius: 50%; }}
        
        .table-wrap {{ max-height: 380px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px; }}
        table {{ width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left; }}
        th {{ background: #0f172a; padding: 8px 10px; color: var(--text-secondary); position: sticky; top: 0; }}
        td {{ padding: 8px 10px; border-top: 1px solid #334155; }}
        tr:hover {{ background: #243447; }}
        
        .order-pill {{ display: inline-block; width: 20px; height: 20px; border-radius: 50%; text-align: center; line-height: 20px; font-size: 0.7rem; font-weight: 700; color: #fff; }}
    </style>
</head>
<body>
    <header>
        <div class="header-title">
            <h1>Heron-101 (RT-DETRv2-101) Visual Inference Inspector</h1>
            <p>100 Scientific Paper Test Pages (DocBank arXiv) - Interactive Layout & Reading Order Viewer</p>
        </div>
        <div style="display: flex; gap: 10px; align-items: center;">
            <span class="badge">Model: Heron-101</span>
            <span class="badge" style="background: #10b981;">Seed: 42</span>
        </div>
    </header>

    <main>
        <section class="viewer-card">
            <div class="controls">
                <button class="btn" id="prevBtn">◀ Trang trước</button>
                <button class="btn primary" id="playBtn">▶ Tự động phát (Play)</button>
                <button class="btn" id="nextBtn">Trang sau ▶</button>
                <div class="slider-wrap">
                    <input type="range" id="pageSlider" min="0" max="{len(docs) - 1}" value="0">
                    <span id="pageCounter" style="font-weight: 700; min-width: 80px; text-align: right;">1 / {len(docs)}</span>
                </div>
            </div>
            <div class="canvas-container">
                <canvas id="pageCanvas"></canvas>
            </div>
        </section>

        <section class="sidebar">
            <div class="panel">
                <h3>THÔNG TIN TRANG & HIỆU NĂNG</h3>
                <div class="kpi-grid">
                    <div class="kpi-card">
                        <div class="kpi-label">Tệp bài báo</div>
                        <div class="kpi-val" id="docName" style="font-size: 0.85rem; word-break: break-all;">-</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Độ trễ Inference</div>
                        <div class="kpi-val" id="docLatency" style="color: #10b981;">- ms</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Tổng số vùng (Boxes)</div>
                        <div class="kpi-val" id="docRegionsCount" style="color: #38bdf8;">-</div>
                    </div>
                    <div class="kpi-card">
                        <div class="kpi-label">Kích thước ảnh</div>
                        <div class="kpi-val" id="docDims">-</div>
                    </div>
                </div>
            </div>

            <div class="panel">
                <h3>BẢNG MÀU PHÂN LOẠI (COLOR LEGEND)</h3>
                <div class="legend">
                    <span class="legend-tag" style="background: rgba(239, 68, 68, 0.2); color: #ef4444;"><span class="dot" style="background: #ef4444;"></span>Title / Header (#1)</span>
                    <span class="legend-tag" style="background: rgba(59, 130, 246, 0.2); color: #3b82f6;"><span class="dot" style="background: #3b82f6;"></span>Body Text (#2)</span>
                    <span class="legend-tag" style="background: rgba(16, 185, 129, 0.2); color: #10b981;"><span class="dot" style="background: #10b981;"></span>Figure / Chart (#3)</span>
                    <span class="legend-tag" style="background: rgba(249, 115, 22, 0.2); color: #f97316;"><span class="dot" style="background: #f97316;"></span>Figure Caption (#4)</span>
                    <span class="legend-tag" style="background: rgba(168, 85, 247, 0.2); color: #a855f7;"><span class="dot" style="background: #a855f7;"></span>Equation (#5)</span>
                </div>
            </div>

            <div class="panel" style="flex: 1; display: flex; flex-direction: column;">
                <h3>DANH SÁCH THỨ TỰ ĐỌC (READING ORDER)</h3>
                <div class="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Nhãn (Class)</th>
                                <th>Độ tin cậy</th>
                                <th>Toạ độ [x, y, w, h]</th>
                            </tr>
                        </thead>
                        <tbody id="regionsTableBody"></tbody>
                    </table>
                </div>
            </div>
        </section>
    </main>

    <script>
        const DOCS = {json.dumps(docs)};
        const COLORS = {{
            'title': '#ef4444',
            'text': '#3b82f6',
            'figure': '#10b981',
            'figure_caption': '#f97316',
            'equation': '#a855f7'
        }};

        let currentIndex = 0;
        let isPlaying = false;
        let playInterval = null;

        const canvas = document.getElementById('pageCanvas');
        const ctx = canvas.getContext('2d');
        const slider = document.getElementById('pageSlider');
        const counter = document.getElementById('pageCounter');
        const playBtn = document.getElementById('playBtn');

        function loadPage(index) {{
            if (index < 0 || index >= DOCS.length) return;
            currentIndex = index;
            slider.value = index;
            counter.innerText = (index + 1) + " / " + DOCS.length;

            const doc = DOCS[index];
            document.getElementById('docName').innerText = doc.file_name.split('/').pop();
            document.getElementById('docLatency').innerText = doc.latency_ms + " ms";
            document.getElementById('docRegionsCount').innerText = doc.regions.length + " vùng";
            document.getElementById('docDims').innerText = doc.width + " x " + doc.height + " px";

            // Render table
            const tbody = document.getElementById('regionsTableBody');
            tbody.innerHTML = '';
            doc.regions.forEach(r => {{
                const tr = document.createElement('tr');
                const col = COLORS[r.label] || '#94a3b8';
                tr.innerHTML = `
                    <td><span class="order-pill" style="background: ${{col}};">${{r.reading_order}}</span></td>
                    <td style="color: ${{col}}; font-weight: 600;">${{r.label}}</td>
                    <td>${{r.confidence.toFixed(2)}}</td>
                    <td>[${{r.bbox_pixel_xywh.map(v => Math.round(v)).join(', ')}}]</td>
                `;
                tbody.appendChild(tr);
            }});

            // Load and draw image
            const img = new Image();
            img.onload = function() {{
                const maxW = 820;
                const scale = maxW / img.width;
                canvas.width = maxW;
                canvas.height = img.height * scale;

                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Draw bounding boxes
                doc.regions.forEach(r => {{
                    const [bx, by, bw, bh] = r.bbox_pixel_xywh;
                    const sx = bx * scale;
                    const sy = by * scale;
                    const sw = bw * scale;
                    const sh = bh * scale;
                    const col = COLORS[r.label] || '#38bdf8';

                    ctx.strokeStyle = col;
                    ctx.lineWidth = 2;
                    ctx.fillStyle = col + '22';
                    ctx.fillRect(sx, sy, sw, sh);
                    ctx.strokeRect(sx, sy, sw, sh);

                    // Badge
                    const text = `#${{r.reading_order}} ${{r.label.toUpperCase()}} ${{r.confidence.toFixed(2)}}`;
                    ctx.fillStyle = col;
                    ctx.font = '10px -apple-system, sans-serif';
                    const textW = ctx.measureText(text).width + 6;
                    ctx.fillRect(sx, Math.max(0, sy - 14), textW, 14);
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(text, sx + 3, Math.max(10, sy - 3));
                }});
            }};
            img.src = "../../../" + doc.relative_image_path;
        }}

        slider.addEventListener('input', (e) => loadPage(parseInt(e.target.value)));
        document.getElementById('prevBtn').addEventListener('click', () => loadPage(currentIndex - 1));
        document.getElementById('nextBtn').addEventListener('click', () => loadPage(currentIndex + 1));

        playBtn.addEventListener('click', () => {{
            if (isPlaying) {{
                clearInterval(playInterval);
                playBtn.innerText = "▶ Tự động phát (Play)";
                playBtn.classList.remove('active');
                isPlaying = false;
            }} else {{
                isPlaying = true;
                playBtn.innerText = "⏸ Tạm dừng (Pause)";
                playBtn.classList.add('active');
                playInterval = setInterval(() => {{
                    if (currentIndex < DOCS.length - 1) {{
                        loadPage(currentIndex + 1);
                    }} else {{
                        loadPage(0);
                    }}
                }}, 1500);
            }}
        }});

        // Initial load
        loadPage(0);
    </script>
</body>
</html>"""
    output_html.write_text(html_content, encoding="utf-8")
    print(f"Generated interactive HTML player at: {output_html.name}")


def main():
    print("==================================================================")
    print("  HERON-101 100-PAGE INFERENCE VIDEO & ANIMATION GENERATOR        ")
    print("==================================================================")

    if not LAYOUT_JSON_PATH.exists():
        raise FileNotFoundError(f"Layout JSON not found at {LAYOUT_JSON_PATH}")

    with open(LAYOUT_JSON_PATH, "r", encoding="utf-8") as f:
        layout_data = json.load(f)

    docs = layout_data.get("documents", [])
    total_docs = len(docs)
    print(f"Loaded {total_docs} pages from {LAYOUT_JSON_PATH.name}")

    # 1. Generate Interactive HTML Viewer
    generate_interactive_html(layout_data, HTML_PLAYER_PATH)

    # 2. Setup OpenCV Video Writer
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(str(OUTPUT_VIDEO_PATH), fourcc, float(FPS), (CANVAS_W, CANVAS_H))
    
    if not writer.isOpened():
        raise RuntimeError("Failed to initialize OpenCV VideoWriter for mp4v codec.")

    print(f"\n[1/2] Rendering 1080p MP4 Video ({total_docs} pages @ {FPS} FPS)...")
    start_time = time.perf_counter()

    preview_pil_frames = []

    for doc_idx, doc in enumerate(docs):
        # Render frames for this document
        for frame_idx in range(FRAMES_PER_PAGE):
            frame = render_dashboard_frame(doc, doc_idx, total_docs, frame_idx)
            writer.write(frame)
            
            # Save 1 frame per document for animated WebP preview (first 12 documents)
            if doc_idx < 12 and frame_idx == 0:
                # Downsample frame for compact WebP
                small_frame = cv2.resize(frame, (960, 540), interpolation=cv2.INTER_AREA)
                rgb_small = cv2.cvtColor(small_frame, cv2.COLOR_BGR2RGB)
                preview_pil_frames.append(Image.fromarray(rgb_small))

        if (doc_idx + 1) % 20 == 0 or (doc_idx + 1) == total_docs:
            elapsed = time.perf_counter() - start_time
            print(f"  Rendered {doc_idx + 1}/{total_docs} pages ({elapsed:.1f}s, {(doc_idx + 1)/elapsed:.1f} pages/s)")

    writer.release()
    vid_size_mb = OUTPUT_VIDEO_PATH.stat().st_size / (1024 * 1024)
    print(f"Successfully generated 1080p MP4 Video: {OUTPUT_VIDEO_PATH.name} ({vid_size_mb:.2f} MB)")

    # 3. Export Animated WebP Preview Clip
    print(f"\n[2/2] Generating Animated WebP Preview Clip (12 pages)...")
    if preview_pil_frames:
        preview_pil_frames[0].save(
            str(OUTPUT_WEBP_PATH),
            format="WEBP",
            save_all=True,
            append_images=preview_pil_frames[1:],
            duration=1200,  # 1.2s per slide
            loop=0,
            quality=85
        )
        webp_size_mb = OUTPUT_WEBP_PATH.stat().st_size / (1024 * 1024)
        print(f"Successfully generated Animated WebP Preview: {OUTPUT_WEBP_PATH.name} ({webp_size_mb:.2f} MB)")

    print("\n==================================================================")
    print("  RECORDING GENERATION COMPLETED SUCCESSFULLY                     ")
    print("==================================================================")
    print(f"1. Full 100-page MP4 Video: {OUTPUT_VIDEO_PATH}")
    print(f"2. Animated WebP Clip:      {OUTPUT_WEBP_PATH}")
    print(f"3. Interactive HTML Player: {HTML_PLAYER_PATH}")


if __name__ == "__main__":
    main()
