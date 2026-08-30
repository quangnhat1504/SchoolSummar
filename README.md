# SchoolSummar

> **Hệ Thống Phân Tích Bố Cục Tài Liệu Thông Minh & Pipeline RAG Đa Tài Liệu với Mô Hình Ngôn Ngữ Nhỏ (Small LLMs)**

---

## 📖 Tổng Quan Dự Án (Project Overview)

**SchoolSummar** là dự án nghiên cứu và phát triển giải pháp xử lý, tóm tắt và truy vấn tài liệu học thuật/khoa học quy mô lớn. Hệ thống kết hợp các kỹ thuật thị giác máy tính và xử lý ngôn ngữ tự nhiên hiện đại nhằm giải quyết toàn diện bài toán từ khâu bóc tách tài liệu phức tạp đến khâu hỏi đáp dữ kiện chính xác:

1. **Phát Hiện Bố Cục & Cấu Trúc (Document Layout Analysis)**:
   - Ứng dụng mô hình nhận diện bố cục chuyên sâu (`Heron-101` RT-DETRv2) và trình phân tích AST nâng cao (`IBM Docling`) để bóc tách cấu trúc bài báo khoa học, bảo toàn nguyên vẹn khối bảng biểu Markdown, công thức toán và tiêu đề phân cấp.
2. **Layout-Guided OCR & Thứ Tự Đọc**:
   - Sắp xếp chuẩn hóa luồng đọc 2 cột (`reading_order`) của các bài báo học thuật trước khi trích xuất văn bản phục vụ nạp ngữ cảnh.
3. **Chiến Lược Phân Đoạn & Vector Retrieval**:
   - Đánh giá và tích hợp 5 phương pháp phân đoạn tài liệu (*Recursive Fixed, Docling Structure-Aware, Semantic Embedding, Parent-Child Hierarchical, Sentence Window*) kết hợp với mô hình embedding chuyên dụng `BAAI/bge-large-en-v1.5` trên không gian vector FAISS Cosine FlatIP 1024-dim.
4. **Đánh Giá & Tối Ưu Năng Lực Small LLMs**:
   - Khảo sát và tối ưu hóa khả năng suy luận, chống ảo giác (*Faithfulness/Groundedness*) và biết từ chối câu hỏi thiếu dữ kiện (*Negative Rejection*) của các mô hình ngôn ngữ nhỏ (`Qwen2.5-1.5B`, `Qwen2.5-3B`, `Qwen2.5-7B`) trên môi trường cục bộ GPU.

---

## 👥 Thành Viên Tham Gia Dự Án (Project Members)

1. **Đặng Quang Nhật**
2. **Phạm Minh Tiến**
3. **Nguyễn Thái Hưng**
4. **Trương Công Phúc**
5. **Phan Tuấn Hưng**

---

## 📄 License
Dự án được phân phối dưới giấy phép [MIT License](LICENSE).
