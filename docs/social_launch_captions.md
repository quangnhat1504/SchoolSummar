# 📣 Bộ Caption & Kịch Bản Truyền Thông Ra Mắt Sản Phẩm (Social Launch Kit)

> Bộ tài liệu này cung cấp sẵn các mẫu bài viết, caption và nội dung truyền thông đa nền tảng (LinkedIn, Facebook, X/Twitter, GitHub Release) dành cho sản phẩm **SchoolSummar (RAG Research)**.

---

## 📌 Lựa Chọn 1: Bài Viết Chuyên Sâu Kỹ Thuật Trên LinkedIn (Technical Deep-Dive)

**Tiêu đề:** *"Why most PDF RAG systems fail on scientific papers — and how we built a Structure-Aware RAG with 0% table corruption."*

```markdown
🚀 Stop treating scientific PDFs like flat text files.

If you’ve ever tried building a RAG pipeline for research papers (arXiv, Nature, IEEE), you’ve probably hit this wall:
❌ Naive chunking (character/token count) slices through tables, destroying rows and numerical correlations.
❌ Multi-column layouts scramble the reading order.
❌ LLMs hallucinate numbers because context breadcrumbs are lost.
❌ Users can't verify where an answer came from.

Over the past few months, our engineering team at FU-DEVER built **SchoolSummar (RAG Research)** to solve this exact problem. Here is how we engineered it from the ground up:

🏗️ 1. Structure-Aware AST Parsing with Docling
Instead of simple OCR or raw text dumps, we parse PDFs into an Abstract Syntax Tree (Document AST). Bounded regions, LaTeX equations, and multi-row tables are preserved 100% intact as structured Markdown.

🌲 2. Hierarchical Breadcrumb Chunking
Every chunk retains its genealogical hierarchy: `[Paper Title > Methodology > Ablation Study]`. The vector representation now captures not just what the paragraph says, but *where* it sits in the scientific argument.

⚡ 3. Dual-Cloud Hybrid Storage
- Vector Search: Powered by Qdrant Cloud with single-stage payload filtering (sub-20ms P95 latency).
- Relational State: Supabase PostgreSQL for ACID session states, RLS, and JSONB AST nodes.
- Edge Embeddings: Cloudflare Workers AI for global low-latency inference.

🛡️ 4. Zero-Hallucination & Grounded Receipts
We enforce strict "Negative Rejection" prompts: if evidence isn't in the retrieved chunks, the model refuses politely. Every assertion comes with interactive Bounding Box coordinates that highlight the exact passage on the original PDF page.

💻 5. Broadcast-Grade Craft & Taste
Built on React 19 + TypeScript + Vite, featuring typewriter token-by-token streaming, real-time thinking states, and a split-pane ergonomic workspace.

Check out our full technical architecture guide and open-source repository below! 👇

🔗 GitHub: https://github.com/quangnhat1504/SchoolSummar
🎬 Watch the 60fps Product Showcase: [Attached Video]

#MachineLearning #RAG #GenerativeAI #Docling #Qdrant #Supabase #SoftwareEngineering #OpenSource #TechInnovation
```

---

## 📌 Lựa Chọn 2: Bài Đăng Facebook / Fanpage CLB FU-DEVER (Hào Hứng & Truyền Cảm Hứng)

```markdown
🔥 [CHÍNH THỨC RA MẮT] SCHOOLSUMMAR (RAG RESEARCH) — TRỢ LÝ ĐỌC BÁO KHOA HỌC THẾ HỆ MỚI ĐẾN TỪ FU-DEVER! 🔥

Đã bao giờ bạn phải “vò đầu bứt tai” khi đọc những bài báo khoa học dài 30–50 trang trên arXiv với chi chít công thức toán và bảng biểu phức tạp? 
Hỏi ChatGPT thì hay bị ảo giác (chém gió số liệu), còn các tool tóm tắt thông thường thì cắt đứt bảng biểu làm sai lệch kết quả thí nghiệm? 🤯

Đó là lý do **SchoolSummar (RAG Research)** chính thức ra đời! 🚀

Được nghiên cứu và phát triển bởi các kỹ sư trẻ tại CLB Lập trình FU-DEVER (FPT University Da Nang), SchoolSummar là nền tảng RAG Workspace chuyên sâu dành riêng cho nghiên cứu học thuật:

✨ ĐIỂM ĐỘT PHÁ CỦA SCHOOLSUMMAR:
1️⃣ BẢO TỒN NGUYÊN VẸN 100% BẢNG BIỂU: Sử dụng Docling AST Hierarchy Parser — bảng biểu phức tạp không bao giờ bị cắt đôi hay vỡ hàng!
2️⃣ NÓI CÓ SÁCH, MÁCH CÓ CHỨNG: Click vào câu trả lời của AI, giao diện tự động nhảy đến đúng trang PDF và kẻ khung tím Bounding Box phát sáng quanh vùng tài liệu gốc. Không còn nỗi lo ảo giác!
3️⃣ TRUY XUẤT SIÊU TỐC VỚI QDRANT CLOUD: Vector search đạt độ trễ kỷ lục dưới 20ms, kết hợp cơ sở dữ liệu Supabase mạnh mẽ.
4️⃣ GIAO DIỆN STREAMING CHUẨN TASTE: Trải nghiệm gõ chữ từng từ (Typewriter Streaming) mượt mà 60 FPS, thông báo rõ ràng quá trình mô hình đang suy nghĩ và trích xuất dữ liệu.

🎯 Hành trình tạo ra sản phẩm không hề dễ dàng: Từ việc chạy benchmark Layout Models trên cluster 13 tài khoản Kaggle GPU Tesla T4, cho đến việc tự động hóa toàn bộ pipeline quay video showcase chuẩn phát sóng bằng Playwright & FFmpeg.

Mời mọi người cùng trải nghiệm video showcase và ghé thăm repository của dự án nhé! 👇

🌐 GitHub Repository: https://github.com/quangnhat1504/SchoolSummar
🎥 Xem ngay video trailer sản phẩm chuẩn Full HD 60fps kèm intro 3D FU-DEVER cực cháy bên dưới!

#FUDEVER #SchoolSummar #RAG #ResearchWorkspace #AI #FPTUniversity #StudentInnovation #OpenSource
```

---

## 📌 Lựa Chọn 3: Thread 7 Tweets Ngắn Gọn Trên X / Twitter

```text
🧵 1/7: Building RAG for scientific papers is hard. Standard chunking breaks tables, OCR scrambles multi-column layouts, and LLMs hallucinate numbers.

Today, we're open-sourcing SchoolSummar (RAG Research) — an end-to-end grounded research assistant built with craft & taste. 🚀👇

---
🧵 2/7: The Core Breakthrough: Docling AST Hierarchy
Instead of naive character-based splitting, we parse PDFs into an Abstract Syntax Tree.
✅ 100% table preservation (Markdown format).
✅ Breadcrumb lineage: every chunk remembers its exact section header.

---
🧵 3/7: Grounded Receipts & Bounding Boxes
No more guessing where an answer came from. Every claim is cited with page numbers and exact [ymin, xmin, ymax, xmax] coordinates. Click a citation -> instant highlight on the PDF canvas.

---
🧵 4/7: Hybrid Cloud Architecture
🔹 Vector Search: Qdrant Cloud (sub-20ms HNSW Cosine Index).
🔹 Relational Store: Supabase PostgreSQL (RLS, JSONB AST nodes).
🔹 Edge Embeddings: Cloudflare Workers AI (@cf/baai/bge-large-en-v1.5).

---
🧵 5/7: Multi-LLM Resilient Gateway
Designed with zero-downtime fallback:
1. Local Qwen2.5-7B (Bfloat16 CUDA)
2. Groq Llama 3 70B (>250 tok/s)
3. OpenRouter / HF for global reliability.

---
🧵 6/7: Aesthetics Matter:
Built on React 19 + Vite, featuring typewriter token-by-token streaming (30ms per word), pulsing thinking state, and zero-latency cursor synchronization.

---
🧵 7/7: Code, architecture guides, and full benchmark reports are now live on GitHub!

⭐ Star the repo: https://github.com/quangnhat1504/SchoolSummar
Produced with ❤️ by CLB FU-DEVER.
```

---

## 📌 Lựa Chọn 4: GitHub Release Notes (v2.0 Production Release)

```markdown
# SchoolSummar v2.0 — Production-Grade Scientific RAG & Research Workspace

We are thrilled to release **SchoolSummar v2.0**, featuring a complete rewrite of the document ingestion pipeline, dual-cloud vector storage, and an aesthetic research workspace.

### 🌟 Key Highlights
- **Docling AST Ingestion:** Preserves 100% of complex multi-column layouts and Markdown tables.
- **Qdrant Cloud Integration:** Fast vector retrieval with single-stage payload filtering.
- **Supabase Backend:** Scalable session, paper, and audit persistence.
- **Typewriter Token-by-Token Streaming:** Realtime streaming UI with reasoning states.
- **Grounded Citations:** Instant bounding-box highlighting on the original PDF viewer.
- **Automated Showcase Pipeline:** Built-in Playwright + FFmpeg 60fps broadcast video production.

### 📖 Documentation
- [Full Product Technical Guide](docs/full_product_technical_guide.md)
- [Development Journey & Engineering Logbook](docs/development_journey_recap.md)
- [Qdrant Setup Guide](docs/qdrant_guide.md)
- [Cloudflare Embedding Guide](docs/cloudflare_embedding_guide.md)
```
