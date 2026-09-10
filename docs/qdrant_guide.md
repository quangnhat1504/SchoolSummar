# Hướng dẫn kết nối và cấu hình Qdrant Vector Database cho SchoolSummar RAG

Tài liệu này hướng dẫn chi tiết cách cấu hình, kết nối và sử dụng Qdrant Vector Database với project RAG.

---

## 1. Tổng quan các công cụ đã tích hợp

1. **Qdrant CLI (Node.js)**: [tools/qdrant_cli.mjs](file:///c:/Users/ADMIN/_Project/RAG/tools/qdrant_cli.mjs)
   - Chạy trực tiếp qua file batch: `.\qdrant-cli.bat <command>` hoặc `node tools/qdrant_cli.mjs <command>`
   - Hỗ trợ đầy đủ: test kết nối, liệt kê collections, tạo/xóa collection, kiểm tra points, search vector, test ghi/đọc.
2. **Qdrant Python CLI**: [tools/qdrant_tool.py](file:///c:/Users/ADMIN/_Project/RAG/tools/qdrant_tool.py)
   - Chạy qua: `.venv-cuda\Scripts\python.exe tools/qdrant_tool.py <command>`
   - Phù hợp khi chạy các pipeline OCR/Ingestion Python hoặc benchmark.
3. **Qdrant Server Adapter**: [server/qdrant.mjs](file:///c:/Users/ADMIN/_Project/RAG/server/qdrant.mjs)
   - Tích hợp sẵn sàng vào hệ thống Node.js server của project.
   - Quản lý upsert vector chunks và search chunks theo `ownerId` và `paperId`.

---

## 2. Cấu hình biến môi trường (.env)

Mở file `.env` tại thư mục gốc và thêm / cập nhật các biến sau:

```env
# ==========================================
# Qdrant Vector Database Configuration
# ==========================================

# 1. Nếu dùng Qdrant Cloud (khuyến nghị - miễn phí 1GB RAM cluster):
# Lấy URL và API Key tại https://cloud.qdrant.io
QDRANT_URL=https://<your-cluster-id>.<region>.cloud.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here

# 2. Nếu dùng Qdrant Local (Docker):
# QDRANT_URL=http://localhost:6333
# QDRANT_API_KEY=

# Cấu hình collection mặc định:
QDRANT_COLLECTION_NAME=schoolsummar_chunks
QDRANT_VECTOR_SIZE=1536
QDRANT_DISTANCE=Cosine
```

---

## 3. Cách khởi chạy Qdrant

### Lựa chọn A: Qdrant Cloud (Đơn giản nhất, không cần cài đặt máy)
1. Đăng ký tài khoản miễn phí tại [https://cloud.qdrant.io](https://cloud.qdrant.io).
2. Tạo 1 **Free Cluster** (1GB RAM, 0.5 vCPU miễn phí vĩnh viễn).
3. Copy **Cluster URL** (dạng `https://xyz-xxx.us-east-1-0.aws.cloud.qdrant.io:6333`) và tạo một **API Key**.
4. Dán vào file `.env` như mục 2.

### Lựa chọn B: Docker Local (Chạy trên máy tính cá nhân)
Nếu máy bạn có cài Docker Desktop:
```bash
docker run -d --name qdrant -p 6333:6333 -p 6334:6334 -v "${PWD}/qdrant_storage:/qdrant/storage:z" qdrant/qdrant
```
Sau đó giao diện trực quan Qdrant Web UI sẽ khả dụng tại: `http://localhost:6333/dashboard`.

---

## 4. Sử dụng Qdrant CLI

Project đã có sẵn file script `qdrant-cli.bat` ở thư mục gốc:

### Kiểm tra kết nối
```bash
.\qdrant-cli.bat test
```
*Lệnh này sẽ ping tới Qdrant server, kiểm tra token, phiên bản và đo độ trễ mạng (latency).*

### Liệt kê các Collections
```bash
.\qdrant-cli.bat list
```

### Tạo Collection mới
```bash
.\qdrant-cli.bat create schoolsummar_chunks --dim 1536 --distance Cosine
```
*(Nếu dùng mô hình embedding khác như BGE-M3 thì đổi `--dim 1024`)*

### Xem thông tin chi tiết Collection
```bash
.\qdrant-cli.bat info schoolsummar_chunks
```

### Test ghi thử 1 vector (Upsert test)
```bash
.\qdrant-cli.bat upsert-test schoolsummar_chunks
```

### Test tìm kiếm vector (Search test)
```bash
.\qdrant-cli.bat search-test schoolsummar_chunks
```

---

## 5. Sử dụng qua Python CLI

Nếu bạn đang làm việc với các notebook hoặc script Python trong repo:
```bash
.venv-cuda\Scripts\python.exe tools/qdrant_tool.py test
.venv-cuda\Scripts\python.exe tools/qdrant_tool.py list
.venv-cuda\Scripts\python.exe tools/qdrant_tool.py create --collection schoolsummar_chunks --dim 1536
```
