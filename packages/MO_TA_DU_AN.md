# Packages — Mô tả thư mục

## Mục đích

`packages/` là khu vực chứa các workspace package dùng chung của monorepo. Cấu hình workspace ở `package.json` tại thư mục gốc bao gồm `packages/*`.

## Package hiện có

- [`react-email/`](react-email/): component giao diện email và các mẫu email React Email. Thư mục `emails/` chứa từng mẫu; `ui/` chứa component dùng chung. HTML được xuất sang `backend/app/email-templates/` để backend gửi.

## Quy trình thay đổi email

Chạy `bun run email:dev` từ thư mục gốc để xem trước mẫu. Sau khi chỉnh, dùng `bun run email:export` để tạo lại HTML. Nội dung placeholder cần khớp với context mà backend cung cấp; xem phần Email Templates trong [backend README](../backend/README.md).
