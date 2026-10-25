# Hooks — Mô tả thư mục

`hooks/` chứa hook khởi tạo project. Hiện có `post_gen_project.py`, một script nhỏ được gọi sau khi tạo project từ mẫu để thực hiện bước hậu khởi tạo.

Đây là phần hỗ trợ scaffold, không phải runtime của ứng dụng. Trước khi thay đổi, hãy kiểm tra hook được gọi bởi công cụ tạo project nào và xem nội dung script để xác định thao tác cụ thể.
