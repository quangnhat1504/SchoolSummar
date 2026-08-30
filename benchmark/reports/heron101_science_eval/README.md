# Thư Mục Tổng Hợp Đánh Giá Layout Heron-101 (Pretrained Gốc) Trên 100 Mẫu Bài Báo Khoa Học (DocBank)

Thư mục này chứa toàn bộ mã nguồn thực thi, dữ liệu mẫu, dự đoán COCO, cấu trúc định dạng OCR và kết quả benchmark của mô hình **Heron-101 (docling-project/docling-layout-heron-101)** trên **100 trang bài báo khoa học (DocBank arXiv)**.

---

## 📁 Danh Sách Tập Tin Trong Thư Mục

| Tên File | Mô Tả Chi Tiết |
|---|---|
| [`heron101_inference_100_pages.mp4`](./heron101_inference_100_pages.mp4) | **Video 1080p hoàn chỉnh ghi lại toàn bộ quá trình inference trên 100 trang bài báo khoa học** (kèm HUD Dashboard thống kê, toạ độ, nhãn, confidence và quét laser visual). |
| [`heron101_inference_preview.webp`](./heron101_inference_preview.webp) | Clip ảnh động WebP tóm tắt 12 trang đầu để xem nhanh. |
| [`interactive_player.html`](./interactive_player.html) | **Trình phát Dashboard tương tác trên trình duyệt** (kèm thanh trượt duyệt 100 trang, nút Play/Pause tự động phát, bảng danh sách toạ độ và thứ tự đọc thời gian thực). |
| [`sample_reproducibility_manifest.json`](./sample_reproducibility_manifest.json) | Manifest chứa danh sách 100 file ảnh bài báo khoa học, ID, kích thước pixel (`width`, `height`), SHA256 và số lượng ground-truth annotations (Seed 42). |
| [`heron101_ocr_ready_layout.json`](./heron101_ocr_ready_layout.json) | Định dạng kết quả layout trích xuất chuyên dụng cho OCR **đã sắp xếp chuẩn thứ tự đọc bài báo khoa học 2 cột** (`reading_order: 1, 2, 3...`, toạ độ pixel `[xmin, ymin, xmax, ymax]`, toạ độ chuẩn hoá `[0-1]`, và cờ `should_ocr`). |
| [`heron101_benchmark_metrics.json`](./heron101_benchmark_metrics.json) | Toàn bộ chỉ số định lượng: mAP50 (45.20%), mAP50-95 (27.95%), AP/AR từng lớp, Latency (58ms/trang), Throughput (14.2 trang/s), Peak VRAM (0.23 GB). |
| [`heron101_docbank_100_predictions.json`](./heron101_docbank_100_predictions.json) | Toàn bộ 7.956 bounding box dự đoán xuất theo chuẩn format COCO (`image_id`, `category_id`, `bbox`, `score`). |
| [`docbank_100_gt.json`](./docbank_100_gt.json) | 1.316 nhãn ground-truth của 100 trang bài báo khoa học chuẩn COCO. |
| [`heron101_sample_inference_outputs.json`](./heron101_sample_inference_outputs.json) | Mẫu JSON chi tiết các vùng phát hiện trên từng trang riêng biệt. |
| [`run_benchmark.py`](./run_benchmark.py) | Script độc lập để chạy lại toàn bộ quá trình inference và đánh giá benchmark với seed tuỳ chỉnh. |
| [`ocr_inference_example.py`](./ocr_inference_example.py) | Script mẫu Python minh hoạ cách đọc layout JSON và crop ROI phục vụ cho PaddleOCR / PyMuPDF. |
| [`preview_sample_*.jpg`](./preview_sample_1_img1.jpg) | Các ảnh xem trước được vẽ sẵn bounding box dự đoán của mô hình Heron-101. |

---

## 🚀 Cách Chạy Lại Đánh Giá (Reproduce)

```powershell
# Chạy với seed 42 và 100 mẫu
.\.venv-cuda\Scripts\python.exe benchmark\reports\heron101_science_eval\run_benchmark.py --seed 42 --num-samples 100

# Chạy thử nghiệm crop vùng để nạp cho OCR
.\.venv-cuda\Scripts\python.exe benchmark\reports\heron101_science_eval\ocr_inference_example.py
```

---

## 📊 Tóm Tắt Chỉ Số Benchmark Chính

- **Mô hình**: `docling-project/docling-layout-heron-101` (RT-DETRv2-ResNet101 FP16)
- **Tập dữ liệu**: DocBank Test Split (100 Sample Pages, arXiv Papers)
- **mAP [0.50:0.95]**: `0.2795` (27.95%)
- **mAP @ 0.50**: `0.4520` (45.20%)
- **mAP @ 0.75**: `0.2615` (26.15%)
- **Độ trễ trung bình**: `55.51 ms / trang` (~15 trang/giây)
- **Peak VRAM**: `0.23 GB`

### Chỉ số từng lớp layout (IoU = 0.50):
- **Chú thích hình (`figure_caption`)**: mAP50 = `0.8365` | F1 = `0.7586`
- **Hình vẽ / Biểu đồ (`figure`)**: mAP50 = `0.7496` | Recall = `88.89%`
- **Tiêu đề / Heading (`title`)**: mAP50 = `0.5047` | Recall = `63.16%`
- **Đoạn văn bản (`text`)**: mAP50 = `0.1379` | F1 = `0.2149`
- **Công thức toán (`equation`)**: mAP50 = `0.0313` | F1 = `0.1198`
