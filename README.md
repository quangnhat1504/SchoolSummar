# SchoolSummar — Scientific Research RAG Workspace

<p align="center">
  <img src="docs/assets/fudever_logo.png" alt="FU-DEVER Logo" width="64" height="64" />
</p>

<p align="center">
  <strong>Trợ lý Nghiên cứu Khoa học Đột phá — Phân tích Cấu trúc Đa tầng (Structure-Aware AST), Bảo tồn 100% Bảng biểu và Triệt tiêu Ảo giác bằng Bounding Box Receipts.</strong>
</p>

<p align="center">
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19.0-61dafb?logo=react&logoColor=black" alt="React 19" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.7+-3178c6?logo=typescript&logoColor=white" alt="TypeScript" /></a>
  <a href="https://qdrant.tech/"><img src="https://img.shields.io/badge/Qdrant-Cloud_Vector_DB-dc2626?logo=qdrant&logoColor=white" alt="Qdrant Cloud" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-PostgreSQL_15+-3ecf8e?logo=supabase&logoColor=white" alt="Supabase" /></a>
  <a href="https://github.com/DS4SD/docling"><img src="https://img.shields.io/badge/Parser-Docling_IBM_AST-052FAD?logo=ibm&logoColor=white" alt="Docling" /></a>
  <a href="https://vitejs.dev/"><img src="https://img.shields.io/badge/Vite-Latest-646cff?logo=vite&logoColor=white" alt="Vite" /></a>
  <a href="https://fudever.com"><img src="https://img.shields.io/badge/Developed_by-FU--DEVER-6554df?logo=fpt&logoColor=white" alt="FU-DEVER" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License MIT" /></a>
</p>

---

## 🎬 Video Showcase Sản Phẩm (Product Demo)

> Được tự động hóa ghi hình ở **60 FPS Full HD** bằng Playwright, biên tập âm thanh DSP và master qua FFmpeg kết hợp Intro 3D thương hiệu **FU-DEVER Hyperframes**.

<p align="center">
  <img src="docs/assets/demo_preview.gif" alt="SchoolSummar Interactive Demo" width="100%" style="border-radius: 10px; border: 1px solid rgba(18, 34, 59, 0.15); box-shadow: 0 10px 30px rgba(0,0,0,0.1);" />
</p>

<p align="center">
  📥 <strong><a href="docs/assets/rag_showcase_product.mp4">Xem / Tải Video Full HD 60fps Bản Gốc (12 MB .mp4)</a></strong> • 
  <a href="docs/development_journey_recap.md#giai-đoạn-6-tự-động-hóa-sản-xuất-media-showcase--ghép-brand-intro">Xem quy trình sản xuất video</a>
</p>

---

## 📚 Trung Tâm Tài Liệu & Cẩm Nang Kỹ Thuật (Documentation Hub)

Hệ thống tài liệu chuyên sâu được chuẩn hóa cho nhà phát triển và cộng đồng nghiên cứu:

| Tài liệu | Mô tả chi tiết |
| :--- | :--- |
| 📘 [**Cẩm Nang Kỹ Thuật Toàn Diện (Full Product Guide)**](docs/full_product_technical_guide.md) | Kiến trúc 4 tầng, Data Schemas, REST/SSE API Contracts, Ingestion Pipeline, và hướng dẫn triển khai Production. |
| 🚀 [**Hành Trình Phát Triển Sản Phẩm (Engineering Logbook)**](docs/development_journey_recap.md) | Lộ trình 6 giai đoạn: từ huấn luyện Kaggle Cluster 13 GPUs, chuyển dịch sang Docling, tích hợp Vector Hybrid đến UI 60fps. |
| 📣 [**Bộ Caption & Kịch Bản Ra Mắt (Social Launch Kit)**](docs/social_launch_captions.md) | Mẫu bài viết học thuật chuyên sâu cho LinkedIn, bài truyền thông Fanpage FU-DEVER, Twitter thread 7-parts và GitHub Release. |
| 🔴 [**Hướng Dẫn Cấu Hình Qdrant Vector DB**](docs/qdrant_guide.md) | Quản lý Collections, HNSW Cosine Index, Payload Filter, và công cụ CLI. |
| ☁️ [**Hướng Dẫn Cloudflare Workers AI Embeddings**](docs/cloudflare_embedding_guide.md) | Triển khai mô hình nhúng `bge-large` trên mạng lưới Edge Network. |
| 📊 [**Báo Cáo Benchmark Layout Models**](docs/reports/multi_doc_50_pdf_benchmark_report.md) | Kết quả kiểm thử trích xuất trên 50 tài liệu khoa học đa dạng. |

---

## ⚡ Điểm Khác Biệt: Traditional RAG vs. SchoolSummar

| Tiêu chí | Hệ thống RAG Truyền Thống | SchoolSummar (RAG Research) |
| :--- | :--- | :--- |
| **Xử lý Bố cục PDF** | OCR phẳng hoặc cắt chuỗi cố định (Fixed 500-1000 tokens) | **Cây Cú Pháp Tài Liệu (Docling AST Hierarchy)** đa cột thông minh |
| **Bảo tồn Bảng biểu** | Bị cắt vụn ngang giữa các hàng, mất liên kết dữ liệu | **100% nguyên vẹn cấu trúc Markdown Tables**, không bao giờ bị cắt đôi |
| **Ngữ cảnh Tiêu đề** | Đoạn văn bản bị tách rời, không rõ thuộc mục nào | **Breadcrumb Lineage** đính kèm (`# Title > ## Methods > ### Setup`) |
| **Xác thực Nguồn** | Chỉ ghi chung chung *"theo tài liệu"* hoặc số trang | **Biên lai Bounding Box `[ymin, xmin, ymax, xmax]`** tương tác trực tiếp |
| **Kiểm soát Ảo giác** | LLM tự phỏng đoán số liệu khi thiếu thông tin | **Cơ chế Negative Rejection** (từ chối thẳng thắn nếu thiếu căn cứ) |
| **Tốc độ Phản hồi** | Chờ tải xong cả đoạn text mới hiển thị | **Typewriter Token-by-Token Streaming (30ms/từ)** kèm con trỏ `▋` |

---

## 🏛️ Kiến Trúc Hệ Thống (System Architecture)

<p align="center">
  <img src="docs/assets/architecture_diagram.png" alt="SchoolSummar Full System Architecture" width="100%" style="border-radius: 12px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); border: 1px solid #E2E8F0;" />
</p>
<p align="center">
  <em>Sơ đồ kiến trúc toàn luồng hệ thống SchoolSummar — Thiết kế theo chuẩn ấn phẩm hội nghị quốc tế, phân tách 3 phân vùng xử lý (Ingestion, Hybrid Storage, Realtime Streaming Serving) với giao thức truyền thông khép kín.</em>
</p>

---

## ✨ Các Tính Năng Đột Phá (Key Features)

### 1. Phân Tích Cú Pháp Bậc Cao (Docling AST & Table Preservation)
Hệ thống không chia đoạn theo số ký tự cứng nhắc mà phân tích cấu trúc cây phả hệ tài liệu:
- Nhận diện chính xác bố cục 2 cột, 3 cột, khối trích dẫn và chú thích hình ảnh.
- Bảng biểu được số hóa sang Markdown hoàn chỉnh, bảo đảm LLM đọc hiểu trọn vẹn từng cột, hàng và số liệu thống kê.

### 2. Biên Lai Xác Thực Tương Tác (Grounded Receipts & Bounding Boxes)
Mỗi khẳng định số liệu hoặc luận điểm trong câu trả lời đều đính kèm thẻ trích dẫn. Người dùng chỉ cần click vào thẻ:
- Màn hình tự động cuộn đến đúng trang PDF gốc.
- Hệ thống vẽ khung chữ nhật tím phát sáng quanh tọa độ Bounding Box của dữ liệu, minh bạch 100% nguồn gốc thông tin.

### 3. Trải Nghiệm Thời Gian Thực Chuẩn Taste (Realtime Streaming UI)
- **Typewriter Token-by-Token Streaming:** Đẩy từng từ ra màn hình với con trỏ nhấp nháy `▋` theo nhịp gõ 30ms tự nhiên.
- **Thinking & Retrieval State:** Hiển thị rõ ràng trạng thái `Model đang truy xuất vector chunks & suy luận...` cùng hiệu ứng sóng lượn.
- **Split-Pane Ergonomics:** Màn hình chia đôi: bên trái hỏi đáp với AI, bên phải đối chiếu tài liệu gốc song song.

### 4. Hạ Tầng Hybrid Cloud Bền Vững (Qdrant Cloud + Supabase)
- **Qdrant Cloud:** Tìm kiếm tương đồng Cosine siêu tốc với Payload Filtering đa tiêu chí (`paperId`, `pageIndex`).
- **Supabase PostgreSQL:** Quản lý phiên làm việc, phân quyền Row Level Security (RLS) và lưu trữ cây AST dạng `jsonb`.
- **Multi-LLM Gateway:** Tự động chuyển đổi mượt mà giữa mô hình bảo mật cục bộ (Qwen2.5-7B) và siêu tốc đám mây (Groq Llama 3 70B với >250 tokens/giây).

---

## 📊 Kết Quả Benchmark Thực Nghiệm (Empirical Benchmark)

Dựa trên báo cáo thử nghiệm trên 50 tài liệu khoa học phức tạp ([Xem báo cáo chi tiết](docs/reports/multi_doc_50_pdf_benchmark_report.md)):

| Chỉ Số Đánh Giá | Mục Tiêu Kỹ Thuật | Kết Quả Thực Tế | Đánh Giá |
| :--- | :--- | :--- | :--- |
| **Độ toàn vẹn bảng biểu (Table Integrity)** | $> 95\%$ | **$100\%$** | Không một bảng dữ liệu nào bị cắt đứt hàng |
| **Tỷ lệ ảo giác (Hallucination Rate)** | $< 3\%$ | **$0.4\%$** | Nhờ cơ chế Negative Rejection bắt buộc |
| **Thời gian phản hồi Token đầu (TTFT)** | $< 800\text{ ms}$ | **$380 - 450\text{ ms}$** | Siêu tốc (Groq Llama 3) |
| **Độ trễ tìm kiếm Vector Qdrant (P95)** | $< 50\text{ ms}$ | **$18\text{ ms}$** | HNSW Cosine Index |
| **Tần số hiển thị tương tác giao diện** | $60\text{ FPS}$ | **$60\text{ FPS}$** | Zero-latency Native Mouse Cursor |

---

## 📁 Cấu Trúc Thư Mục Chuẩn (Project Layout)

```text
SchoolSummar/
├── src/                        # 🎨 Frontend Webapp (React 19 + TypeScript + Vite)
│   ├── App.tsx                 # Giao diện Workspace (Split-Pane, Typewriter Streaming)
│   ├── LandingPage.tsx         # Landing Page giới thiệu sản phẩm & Brand FU-DEVER
│   ├── components/             # Thư viện UI Components, PDF Canvas & Citations
│   └── styles.css              # Hệ thống Design Tokens & CSS Animations 60fps
│
├── server/                     # 🚀 Backend Orchestrator (Node.js ESM)
│   ├── app.mjs                 # REST API Express, SSE Hub & Session Management
│   ├── llm.mjs                 # Multi-Provider LLM Gateway Router & Failover
│   ├── qdrant.mjs              # Qdrant Cloud Client & Vector Search Adapter
│   └── docling.mjs             # Adapter điều phối Ingestion Docling
│
├── rag_engine/                 # 🧠 Core Python RAG Engine
│   ├── chunkers/               # Docling Structure-Aware Chunker (AST & Tables)
│   ├── models/                 # Qwen2.5-7B-Instruct SLM Runner
│   └── parsers/                # Parser trích xuất cây AST từ PDF
│
├── docs/                       # 📚 Documentation Hub
│   ├── full_product_technical_guide.md  # Cẩm nang kỹ thuật toàn diện
│   ├── development_journey_recap.md     # Nhật ký hành trình phát triển từ A-Z
│   ├── social_launch_captions.md        # Bộ caption truyền thông đa nền tảng
│   ├── qdrant_guide.md                  # Hướng dẫn Qdrant Cloud
│   ├── cloudflare_embedding_guide.md    # Hướng dẫn Cloudflare Workers AI
│   └── assets/                          # Demo GIF preview, Full HD Video, Brand Logos
│
├── tools/                      # 🛠️ CLI Utilities & Production Tools
│   ├── produce_showcase_video.mjs       # Pipeline tự động quay & xuất bản video showcase
│   ├── stitch_intro_showcase.mjs        # Script ghép nối Brand Intro FU-DEVER
│   └── qdrant_cli.mjs                   # CLI quản lý Qdrant Vector DB
│
└── dev.mjs                     # Script khởi chạy đồng thời Frontend & Backend
```

---

## 🚀 Hướng Dẫn Cài Đặt & Khởi Chạy (Quick Start)

### 1. Yêu Cầu Môi Trường
- **Node.js:** v20.x trở lên
- **Python:** 3.10+ (khuyến nghị có GPU CUDA nếu chạy local embedding)
- **FFmpeg:** 7.0+ (nếu chạy công cụ sản xuất video tự động)

### 2. Cài Đặt Thư Viện
```bash
git clone https://github.com/quangnhat1504/SchoolSummar.git
cd SchoolSummar
npm install
```

### 3. Cấu Hình Biến Môi Trường (`.env`)
Tạo file `.env` tại thư mục gốc với các thông số:
```env
PORT=6100
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
QDRANT_URL=https://[CLUSTER_ID].[REGION].cloud.qdrant.io:6333
QDRANT_API_KEY=[YOUR_QDRANT_API_KEY]
QDRANT_COLLECTION_NAME=schoolsummar_chunks
GROQ_API_KEY=[YOUR_GROQ_API_KEY]
OPENROUTER_API_KEY=[YOUR_OPENROUTER_API_KEY]
CLOUDFLARE_ACCOUNT_ID=[YOUR_CF_ID]
CLOUDFLARE_API_TOKEN=[YOUR_CF_TOKEN]
```

### 4. Khởi Chạy Hệ Thống
```bash
# Khởi chạy toàn bộ hệ thống (Frontend Vite + Backend Express)
node dev.mjs
```
Mở trình duyệt tại: **`http://localhost:6100`** để bắt đầu trải nghiệm!

---

## 👥 Đội Ngũ Phát Triển & Bản Quyền (Credits & License)

- **Đơn vị phát triển:** **CLB Lập Trình FU-DEVER** (FPT University Da Nang)  
  *Website:* [https://fudever.com](https://fudever.com)
- **Tác giả & Kiến trúc trưởng:** **Đặng Quang Nhật** ([@quangnhat1504](https://github.com/quangnhat1504)) cùng đội ngũ kỹ sư FU-DEVER.
- **Giấy phép:** Phát hành theo giấy phép [MIT License](LICENSE). Mọi đóng góp (Pull Request) từ cộng đồng đều được chào đón!

<p align="center">
  <sub>Built with precision, craft & quiet confidence by FU-DEVER.</sub>
</p>
