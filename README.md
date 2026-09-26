# SchoolSummar

> Structure-Aware RAG Platform for Complex Scientific Documents.

SchoolSummar là hệ thống Retrieval-Augmented Generation (RAG) mã nguồn mở chuyên sâu cho việc đọc hiểu, tra cứu và phân tích các bài báo khoa học định dạng PDF phức tạp. Hệ thống khắc phục các hạn chế cố hữu của RAG truyền thống bằng cách kết hợp phân tích cây cú pháp (AST Hierarchy) của Docling, tìm kiếm vector độ trễ thấp trên Qdrant Cloud, lưu trữ quan hệ Supabase và kiểm chứng thông tin trực quan qua Bounding Box citations.

---

## Demo Preview

<p align="center">
  <img src="docs/assets/demo_preview.gif" alt="SchoolSummar Interface Demo" width="100%" style="border-radius: 8px; border: 1px solid #E2E8F0;" />
</p>

- **Video Showcase (Full HD, 60 FPS)**: [docs/assets/rag_showcase_product.mp4](docs/assets/rag_showcase_product.mp4)

---

## Kiến Trúc Hệ Thống (System Architecture)

<p align="center">
  <img src="docs/assets/architecture_diagram.png" alt="SchoolSummar System Architecture" width="100%" style="border-radius: 8px; border: 1px solid #E2E8F0;" />
</p>

Hệ thống được thiết kế theo mô hình phân tầng module hóa:
- **Ingestion Pipeline**: Sử dụng Docling trích xuất cây cú pháp (Document AST), bảo tồn phân cấp tiêu đề (Breadcrumbs) và cấu trúc bảng biểu Markdown nguyên vẹn.
- **Hybrid Storage**: Kết hợp Qdrant Cloud (Cosine Similarity 1536-dim) cho tìm kiếm vector và Supabase PostgreSQL cho quản lý phiên làm việc, người dùng và dữ liệu có cấu trúc.
- **Serving & Verification**: Node.js REST/SSE Gateway hỗ trợ streaming token thời gian thực và tương tác trực tiếp với tọa độ Bounding Box trên PDF gốc.

---

## Tính Năng Chính (Key Features)

- **Structure-Aware Document Chunking**: Phân đoạn dựa trên ranh giới ngữ nghĩa và cây AST, bảo toàn cấu trúc bảng biểu phức tạp và cây phân cấp tiêu đề.
- **Grounded Verification (Bounding Box Receipts)**: Mỗi luận điểm trích xuất đều liên kết trực tiếp với tọa độ không gian `[ymin, xmin, ymax, xmax]` trên trang PDF, cho phép kiểm chứng nguồn gốc tức thì.
- **Realtime Token Streaming**: Phản hồi dạng typewriter thông qua Server-Sent Events với độ trễ phản hồi token đầu (TTFT) tối ưu (< 450ms).
- **Multi-Provider LLM Gateway**: Hỗ trợ chuyển đổi linh hoạt giữa các nhà cung cấp mô hình (Groq, OpenRouter) và mô hình cục bộ.

---

## Cấu Trúc Thư Mục (Directory Structure)

```text
SchoolSummar/
├── src/                        # Frontend Application (React 19, TypeScript, Vite)
│   ├── App.tsx                 # Giao diện chính RAG Workspace
│   ├── LandingPage.tsx         # Trang giới thiệu
│   ├── components/             # UI Components, PDF Canvas & Citation Overlays
│   └── styles.css              # Giao diện & animation hệ thống
├── server/                     # Backend Orchestrator (Node.js ESM)
│   ├── app.mjs                 # REST API & SSE streaming handler
│   ├── llm.mjs                 # Gateway điều phối các provider LLM
│   ├── qdrant.mjs              # Client tương tác với Qdrant Cloud
│   └── docling.mjs             # Adapter tích hợp parser Docling
├── rag_engine/                 # Python RAG Engine
│   ├── chunkers/               # Structure-Aware Chunker (AST & Tables)
│   ├── models/                 # Model runner
│   └── parsers/                # Bộ xử lý trích xuất văn bản & OCR
├── docs/                       # Tài liệu kỹ thuật & assets
│   ├── full_product_technical_guide.md  # Cẩm nang kỹ thuật chi tiết
│   ├── development_journey_recap.md     # Nhật ký quá trình phát triển
│   └── assets/                          # Sơ đồ kiến trúc, demo video & ảnh
└── dev.mjs                     # Script khởi chạy môi trường phát triển
```

---

## Hướng Dẫn Cài Đặt & Chạy (Quick Start)

### 1. Yêu cầu môi trường
- Node.js >= 20.x
- Python >= 3.10 (khuyến nghị có GPU hỗ trợ CUDA)

### 2. Cài đặt dependencies
```bash
git clone https://github.com/quangnhat1504/SchoolSummar.git
cd SchoolSummar
npm install
```

### 3. Cấu hình biến môi trường
Tạo file `.env` tại thư mục gốc với các thông số:
```env
PORT=6100
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
QDRANT_URL=https://[CLUSTER_ID].[REGION].cloud.qdrant.io:6333
QDRANT_API_KEY=[YOUR_QDRANT_API_KEY]
QDRANT_COLLECTION_NAME=schoolsummar_chunks
GROQ_API_KEY=[YOUR_GROQ_API_KEY]
OPENROUTER_API_KEY=[YOUR_OPENROUTER_API_KEY]
```

### 4. Khởi chạy ứng dụng
```bash
node dev.mjs
```
Truy cập giao diện tại: `http://localhost:6100`.

---

## Tài Liệu Kỹ Thuật (Documentation)

- [Cẩm Nang Kỹ Thuật Toàn Diện](docs/full_product_technical_guide.md): Chi tiết kiến trúc, API contracts, schema cơ sở dữ liệu và vận hành production.
- [Nhật Ký Quá Trình Phát Triển](docs/development_journey_recap.md): Tổng hợp quá trình nghiên cứu, benchmark mô hình và xây dựng hệ thống.

---

## Thành Viên Phát Triển (Project Team)

Dự án được nghiên cứu và phát triển bởi các thành viên thuộc **CLB Lập Trình FU-DEVER (FPT University Da Nang)**:

1. **Đặng Quang Nhật**
2. **Phạm Minh Tiến**
3. **Nguyễn Thái Hưng**
4. **Trương Công Phúc**
5. **Phan Tuấn Hưng**

---

## License

Dự án được phân phối theo giấy phép [MIT License](LICENSE).
