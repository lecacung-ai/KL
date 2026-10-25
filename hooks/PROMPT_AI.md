# Prompt AI — Hooks

Thư mục `hooks/` chứa hook chạy sau khi tạo project, hiện có `post_gen_project.py`. Trước khi sửa, xác nhận công cụ nào gọi hook, thư mục làm việc hiện tại và các file có thể bị tác động.

- Giữ hook ngắn, có thể chạy lặp lại và an toàn khi một tùy chọn chưa tồn tại.
- Không xóa hoặc ghi đè dữ liệu người dùng ngoài mục tiêu rõ ràng.
- Kiểm tra lỗi đường dẫn và hệ điều hành; nếu chỉ hỗ trợ một nền tảng, ghi rõ điều đó.
- Không đưa bí mật vào hook hoặc log.

Khi hoàn tất, mô tả thời điểm hook chạy và thay đổi mà nó tạo ra. Không thực thi hook nếu người yêu cầu không yêu cầu.
