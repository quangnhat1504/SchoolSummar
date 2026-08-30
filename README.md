# Document Layout Detection, OCR & Multi-Document RAG Reproducibility Suite

[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/)
[![PyTorch 2.0+](https://img.shields.io/badge/PyTorch-2.0%2B-ee4c2c.svg)](https://pytorch.org/)
[![CUDA 12.8](https://img.shields.io/badge/CUDA-12.8-76b900.svg)](https://developer.nvidia.com/cuda-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Repository này chứa toàn bộ mã nguồn thực thi, cấu trúc pipeline và bộ script tái hiện kết quả thực nghiệm (**Reproducibility Suite**) cho toàn bộ chu trình xử lý tài liệu thông minh:
1. **Layout Detection**: Đánh giá mô hình phát hiện bố cục bài báo khoa học `docling-project/docling-layout-heron-101` (RT-DETRv2-ResNet101).
2. **Layout-Guided OCR**: Sắp xếp thứ tự đọc 2 cột chuẩn khoa học (`reading_order`) và trích xuất vùng nhận dạng chữ.
3. **5 Chiến Lược Chunking & Vector Retrieval**: Đánh giá 5 thuật toán phân đoạn tài liệu trên kho tri thức 30–50 PDFs kết hợp `BAAI/bge-large-en-v1.5` + FAISS FlatIP (1024-dim).
4. **Small LLM Groundedness & Evaluation**: Đo lường định lượng khả năng thu nhận dữ kiện, chống ảo giác (*Faithfulness*), và biết từ chối (*Negative Rejection*) của `Qwen2.5-1.5B`, `Qwen2.5-3B`, `Qwen2.5-7B`.

---

## 📁 Cấu Trúc Mã Nguồn (Repository Structure)

```text
├── reproduce.py                                 # 🚀 Master CLI tự động tái hiện toàn bộ các bước
├── requirements.txt                             # Danh mục thư viện phụ thuộc
│
├── src/rag_pipeline/                            # 🧠 Kiến trúc Core RAG Pipeline
│   ├── schema.py                                # Data schemas (DocumentNode, Chunk, EvaluationSample)
│   ├── parsers/docling_parser.py                # IBM Docling AST Parser & Markdown Extractor
│   ├── chunkers/                                # 5 Thuật toán phân đoạn độc lập
│   │   ├── recursive_chunker.py                 # 1. Recursive Fixed Length (512t, overlap 64t)
│   │   ├── docling_structure_chunker.py         # 2. Docling Structure-Aware (bảo toàn bảng biểu)
│   │   ├── semantic_chunker.py                  # 3. Semantic Embedding Chunker (BGE Cosine)
│   │   ├── parent_child_chunker.py              # 4. Parent-Child Hierarchical (Child 128t, Parent 512t)
│   │   └── sentence_window_chunker.py           # 5. Sentence Window Chunker (±3 câu context)
│   ├── embeddings/bge_retriever.py              # BAAI/bge-large-en-v1.5 + FAISS Cosine Index
│   ├── models/slm_engine.py                     # Small LLM Engine (Qwen2.5 1.5B/3B/7B bfloat16)
│   ├── evaluation/metrics.py                    # Fact Recall, Groundedness, Negative Rejection, F1
│   └── benchmarks/                              # Benchmark runners
│       ├── multi_doc_benchmark_50.py            # Large-Scale Multi-Doc Runner (30-50 PDFs)
│       └── benchmark_matrix.py                  # Full Matrix Benchmark Runner
│
├── benchmark/reports/                           # 📊 Toàn bộ kết quả và báo cáo khoa học
│   ├── heron101_science_eval/                   # Gói đánh giá Layout Detection & OCR (DocBank 100 pages)
│   │   ├── run_benchmark.py                     # Script chạy lại đánh giá Heron-101
│   │   ├── ocr_inference_example.py             # Script trích xuất bounding box & reading order OCR
│   │   ├── interactive_player.html              # Dashboard tương tác xem trước 100 trang bài báo
│   │   └── heron101_benchmark_metrics.json      # Bảng chỉ số mAP50 (45.2%), mAP50-95 (27.95%), Latency
│   │
│   └── rag_multi_doc_benchmark/                 # Gói đánh giá Multi-Document RAG (30-50 PDFs)
│       ├── README.md                            # Tổng quan chi tiết và ma trận kết quả RAG
│       ├── reports/                             # Báo cáo Markdown chi tiết
│       ├── results/                             # Kết quả JSON & CSV (Task 1 & Task 2)
│       └── scripts/                             # Script thực thi độc lập
│
└── tools/                                       # Công cụ bổ trợ
    ├── run_heron101_science_benchmark.py
    └── generate_inference_video.py
```

---

## ⚡ Cài Đặt Môi Trường (Installation)

```bash
# 1. Tạo và kích hoạt môi trường ảo Python
python -m venv .venv
source .venv/bin/activate  # Trên Linux/macOS
# .\.venv\Scripts\activate   # Trên Windows

# 2. Cài đặt các thư viện phụ thuộc
pip install -r requirements.txt
```

---

## 🚀 Hướng Dẫn Tái Hiện Kết Quả (How to Reproduce)

### 1. Tự Động Chạy Toàn Bộ (Master CLI)
```bash
python reproduce.py --all
```

### 2. Tái Hiện Từng Bước Riêng Biệt

#### Bước 1: Đánh Giá Layout Detection (Heron-101 trên DocBank)
```bash
python reproduce.py --step layout
# Hoặc chạy trực tiếp:
python benchmark/reports/heron101_science_eval/run_benchmark.py --seed 42 --num-samples 100
```

#### Bước 2: Thử Nghiệm Layout-Guided OCR & Sắp Xếp Thứ Tự Đọc
```bash
python reproduce.py --step ocr
# Hoặc chạy trực tiếp:
python benchmark/reports/heron101_science_eval/ocr_inference_example.py
```

#### Bước 3: Benchmark 5 Chiến Lược Chunking & Vector Retrieval (30 PDFs)
```bash
python reproduce.py --step retrieval --num_pdfs 30
```

#### Bước 4: Đánh Giá Năng Lực Small LLMs (1.5B, 3B, 7B)
```bash
python reproduce.py --step llm --num_pdfs 30 --models Qwen/Qwen2.5-1.5B-Instruct Qwen/Qwen2.5-3B-Instruct Qwen/Qwen2.5-7B-Instruct
```

---

## 📈 Tóm Tắt Kết Quả Thực Nghiệm Chính

### 1. Layout Detection Benchmark (Heron-101 trên 100 Trang DocBank)
- **mAP [0.50:0.95]**: `0.2795` (27.95%)
- **mAP @ 0.50**: `0.4520` (45.20%)
- **Độ trễ trung bình**: `55.51 ms / trang` (Peak VRAM: 0.23 GB)

### 2. Task 1: So Sánh 5 Chiến Lược Chunking (30 PDFs)
| Chiến lược Chunking | Tổng Chunks | Avg Tokens | Thời gian Chunk | Đặc tính nổi bật |
| :--- | :---: | :---: | :---: | :--- |
| **Docling Structure-Aware** | **365** | 421.6 | **59.5 ms** | Bảo toàn nguyên vẹn 100% bảng Markdown & Breadcrumbs |
| **Parent-Child Hierarchical**| **2,736** | 84.2 | **884.3 ms** | Vector con 128t định vị chính xác, ngữ cảnh cha 512t cho LLM |

### 3. Task 2: Ma Trận Năng Lực Small LLMs
- **Sweet Spot (Qwen2.5-3B)**: Đạt **76.4% – 85.0%** Entity Groundedness, độ trễ chỉ **1.16s – 1.83s** trên RTX 5070 Ti.
- **Top Accuracy (Qwen2.5-7B)**: Đạt đỉnh **94.1%** Entity Groundedness, Negative Rejection đạt **100%**.

---

## 📄 License
Dự án được phân phối dưới giấy phép [MIT License](LICENSE).
