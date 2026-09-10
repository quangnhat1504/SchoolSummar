# Hướng dẫn kết nối và cấu hình Cloud SQL (PostgreSQL Cloud) cho SchoolSummar RAG

Tài liệu này hướng dẫn chi tiết cách đăng ký, cấu hình và sử dụng **Cloud PostgreSQL** (Neon Serverless hoặc Supabase) thay thế cho cơ sở dữ liệu local.

---

## 1. Dịch vụ Cloud SQL khuyến nghị tốt nhất

### Lựa chọn 1: Neon Serverless PostgreSQL (Khuyến nghị số 1)
* **Website**: [https://neon.tech](https://neon.tech)
* **Chi phí**: Miễn phí vĩnh viễn (Free Tier 0.5 GB, tự động scale to zero khi không dùng).
* **Không yêu cầu thẻ tín dụng**.
* **Ưu điểm**:
  - Hỗ trợ sẵn `pgvector` và `pgcrypto` ngay từ đầu (bắt buộc cho RAG).
  - Tích hợp sẵn Connection Pooling giúp hệ thống Node.js và Python kết nối siêu nhanh mà không bị nghẽn connection.
  - Dự án SchoolSummar RAG đã được cấu hình sẵn biến môi trường tối ưu hóa cho Neon (`DATABASE_URL` và `DATABASE_URL_POOLER`).

### Lựa chọn 2: Supabase (PostgreSQL Cloud)
* **Website**: [https://supabase.com](https://supabase.com)
* **Chi phí**: Miễn phí (500 MB database, 2 projects).
* **Ưu điểm**:
  - Giao diện Table Editor trực quan rất đẹp trên trình duyệt để bạn xem và duyệt bảng `papers`, `document_chunks`.
  - Hỗ trợ `pgvector`.

---

## 2. Các bước đăng ký và lấy chuỗi kết nối (Chỉ mất 1 phút)

1. Truy cập [https://neon.tech](https://neon.tech) và bấm **Sign up with GitHub**.
2. Đặt tên Project (ví dụ: `schoolsummar-rag`) và chọn Region (ví dụ: `Singapore (ap-southeast-1)` để có độ trễ thấp nhất về Việt Nam, hoặc `US East`).
3. Sau khi tạo xong, màn hình sẽ hiển thị **Connection String**.
4. Chọn định dạng **Connection string** (ví dụ: `postgresql://user:password@ep-xyz-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require`).
5. Copy chuỗi kết nối này.

---

## 3. Cấu hình vào file `.env`

Mở file `.env` tại thư mục gốc và cập nhật phần **PostgreSQL / Neon**:

```env
# ==========================================
# PostgreSQL Cloud Configuration (Neon / Supabase)
# ==========================================
STORE_MODE=postgres
DATABASE_URL=postgresql://<username>:<password>@<host>/<database>?sslmode=require
DATABASE_URL_POOLER=postgresql://<username>:<password>@<host-pooler>/<database>?sslmode=require
DATABASE_SSL=true
```

---

## 4. Sử dụng công cụ Cloud SQL CLI

Project đã tích hợp sẵn công cụ [`tools/cloud_sql_tool.mjs`](file:///c:/Users/ADMIN/_Project/RAG/tools/cloud_sql_tool.mjs) và phím tắt [`cloud-sql.bat`](file:///c:/Users/ADMIN/_Project/RAG/cloud-sql.bat) để quản lý:

### 1. Kiểm tra kết nối tới Cloud SQL
```bash
.\cloud-sql.bat test
```
*Lệnh này sẽ ping tới cụm Cloud SQL, đo độ trễ mạng và kiểm tra các tiện ích mở rộng `vector` và `pgcrypto`.*

### 2. Tự động khởi tạo Schema & Migrations lên Cloud
```bash
.\cloud-sql.bat migrate
```
*Lệnh này sẽ tự động đọc toàn bộ file `database/migrations/001_initial_schema.sql` và thực thi trên Cloud SQL, tạo các bảng: `users`, `papers`, `paper_files`, `processing_runs`, `paper_pages`, `layout_blocks`, `ocr_results`, `document_chunks`, `chunk_embeddings`, `embedding_models`.*

### 3. Xem danh sách các bảng và số lượng bản ghi
```bash
.\cloud-sql.bat status
```
