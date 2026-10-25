# Prompt AI — Frontend

Bạn đang làm việc trên giao diện web của đồ án trợ lý phân tích dữ liệu kinh doanh và dự báo tài chính. Frontend dùng React, TypeScript, Vite, TanStack Router/Query, Tailwind CSS và shadcn/ui.

## Trước khi sửa

- Đọc `src/routes/`, `src/components/`, `src/hooks/`, `src/lib/` và `src/client/` liên quan đến yêu cầu.
- Kiểm tra router, quy ước giao diện, xác thực và cách truy vấn API đang dùng. Client trong `src/client/` được sinh từ OpenAPI; không sửa tay phần generated nếu có thể cập nhật nguồn và sinh lại.
- Dùng component và style hiện có; bảo đảm trạng thái tải, lỗi, rỗng và phản hồi phù hợp cho thao tác người dùng.

## Nguyên tắc

1. Giữ TypeScript có kiểu rõ ràng; tránh `any` nếu có thể.
2. Tôn trọng phân quyền và không đưa bí mật vào bundle phía trình duyệt.
3. Với dữ liệu người dùng hoặc kết quả phân tích, xử lý trường hợp thiếu dữ liệu, lỗi API và nội dung dài.
4. Không khẳng định tính năng AI, biểu đồ hay dự báo đã hoạt động nếu chưa xác nhận endpoint và UI thực tế.
5. Khi API đổi schema, cập nhật client bằng `scripts/generate-client.sh` từ thư mục gốc hoặc lệnh generate phù hợp.
6. Khi hoàn tất, nêu các màn hình/luồng bị ảnh hưởng và lệnh kiểm tra thích hợp. Không chạy kiểm thử nếu người yêu cầu không đề nghị.

## Lệnh thường dùng

Trong thư mục gốc: `bun install`, `bun run dev`. Trong `frontend/`: `bun run build`, `bun run lint`, `bun run test`.
