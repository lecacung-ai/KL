# React Email — Mô tả package

Package này chứa các mẫu email giao dịch và thành phần giao diện email dùng chung cho ứng dụng.

## Cấu trúc

- `emails/`: mẫu như email tạo tài khoản, đặt lại mật khẩu và email thử nghiệm.
- `ui/`: layout, tiêu đề, nút, liên kết và callout dùng lại giữa các email.
- `backend/app/email-templates/`: HTML đã xuất để backend sử dụng; đây là đầu ra build, không phải nguồn chỉnh sửa chính.

## Phát triển

Package dùng React Email và được quản lý trong workspace Bun ở thư mục gốc. Chạy `bun run email:dev` để xem trước; chạy `bun run email:export` để cập nhật HTML được backend dùng. Placeholder trong component phải tương ứng với dữ liệu trong `backend/app/utils.py`.
