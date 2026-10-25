# Frontend — Mô tả dự án

## Vai trò

Frontend là ứng dụng web cho người dùng đăng nhập và làm việc với các chức năng của hệ thống. Ứng dụng được phát triển bằng React và TypeScript, chạy độc lập qua Vite khi phát triển và có thể được build để phục vụ cùng backend FastAPI.

## Công nghệ và cấu trúc

- Vite, React, TypeScript.
- TanStack Router quản lý trang; TanStack Query quản lý truy vấn dữ liệu.
- Tailwind CSS và shadcn/ui xây dựng giao diện.
- `src/routes/`: trang và định tuyến.
- `src/components/`: component dùng chung và UI.
- `src/hooks/`, `src/lib/`: hook và tiện ích.
- `src/client/`: client API được tạo từ schema OpenAPI.
- `tests/`: kiểm thử end-to-end bằng Playwright.

## Chạy ứng dụng

Từ thư mục gốc, chạy `bun install` rồi `bun run dev`; Vite mặc định phục vụ tại `http://localhost:5173`. Backend và PostgreSQL cần chạy để các luồng dữ liệu hoạt động. Xem [README.md](README.md) và [hướng dẫn phát triển ở thư mục gốc](../development.md).

Build production bằng `bun run build` trong thư mục này. Khi schema backend thay đổi, sinh lại API client theo hướng dẫn trong README.

## Phạm vi nghiệp vụ

Đồ án hướng tới các luồng đăng nhập, quản lý dữ liệu kinh doanh, xem thông tin dataset và tương tác phân tích. Mức độ hoàn thiện của từng trang cần được xác minh từ mã nguồn hiện tại; tài liệu đặc tả gốc không thay thế trạng thái triển khai.
