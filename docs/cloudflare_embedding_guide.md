# Hướng Dẫn Tích Hợp & Sử Dụng Cloudflare Workers AI cho BGE Embeddings

Dự án **SchoolSummar RAG** hỗ trợ sinh dense vector embeddings trực tiếp qua **Cloudflare Workers AI** sử dụng mô hình `@cf/baai/bge-large-en-v1.5` (hoặc `@cf/baai/bge-base-en-v1.5`).

---

## 🌟 Lợi Ích Của Cloudflare Workers AI
1. **Hoàn toàn Serverless**: Không cần card GPU (RTX) cục bộ, không cần cài đặt PyTorch nặng nề.
2. **Miễn phí 10,000 neurons/ngày**: Đủ dùng thoải mái cho hàng ngàn trang tài liệu khoa học mỗi ngày.
3. **Mạng lưới Edge toàn cầu**: Có PoP tại Việt Nam và Singapore, cho độ trễ mạng cực thấp.
4. **Tương thích Qdrant Cloud**: Vector 1024-dim được tự động chuẩn hóa và pad sang 1536-dim tương thích hoàn hảo với collection `schoolsummar_chunks`.

---

## 🚀 Cách 1: Sử Dụng Trực Tiếp REST API (Khuyên Dùng - Nhanh Nhất, Không Cần Cài Đặt)

Bạn chỉ cần lấy **Account ID** và **API Token** từ tài khoản Cloudflare (hoàn toàn miễn phí):

### Bước 1: Lấy Account ID
1. Đăng nhập vào [dash.cloudflare.com](https://dash.cloudflare.com/).
2. Chọn mục **Workers & Pages** ở menu bên trái, hoặc xem ở thanh URL / bảng điều khiển bên phải.
3. Copy chuỗi **Account ID** (dạng một chuỗi hex 32 ký tự, ví dụ: `d8a7c6b5e4f3...`).

### Bước 2: Tạo API Token
1. Truy cập [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens).
2. Bấm **Create Token** -> Chọn template **Workers AI Read / Edit** (hoặc Custom Token với quyền `Account > Workers AI > Read`).
3. Bấm **Create Token** và copy mã token vừa tạo.

### Bước 3: Cấu hình vào file `.env`
Mở file `.env` và thêm:
```env
# Cloudflare Workers AI (BGE Embeddings)
EMBEDDING_PROVIDER=cloudflare
CLOUDFLARE_ACCOUNT_ID=chuỗi_account_id_của_bạn
CLOUDFLARE_API_TOKEN=mã_token_vừa_tạo
CLOUDFLARE_EMBEDDING_MODEL=@cf/baai/bge-large-en-v1.5
```

### Bước 4: Kiểm tra kết nối
Chạy lệnh kiểm thử:
```bash
node --env-file-if-exists=.env tools/test_cloudflare_embedding.mjs
# Hoặc trên Windows:
cloudflare-test.bat
```

---

## 🛠️ Cách 2: Tự Triển Khai Cloudflare Worker Riêng (Tùy Chọn)

Nếu bạn muốn có một URL API riêng (ví dụ: `https://schoolsummar-bge-worker.yourname.workers.dev`):

Dự án đã chuẩn bị sẵn mã nguồn tại thư mục `cloudflare-worker/`:
```bash
cd cloudflare-worker

# 1. Đăng nhập Cloudflare
npx wrangler login

# 2. Deploy Worker lên Cloudflare
npx wrangler deploy
```

Sau khi deploy, Wrangler sẽ cung cấp cho bạn một URL Worker. Bạn chỉ cần cấu hình vào `.env`:
```env
CLOUDFLARE_WORKER_URL=https://schoolsummar-bge-worker.<your-subdomain>.workers.dev
```

---

## 🧪 Kiểm Thử Tự Động
Hệ thống cung cấp sẵn hai bộ adapter kết nối:
1. **Node.js**: `server/embeddings.mjs`
2. **Python**: `rag_engine/embeddings/cloudflare_bge.py`
