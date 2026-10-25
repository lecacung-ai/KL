# Prompt AI — Packages

Thư mục `packages/` chứa các package JavaScript dùng chung trong monorepo. Hiện có `react-email`, package chứa component và email template viết bằng React Email.

- Trước khi sửa, đọc `package.json` của workspace và package con để hiểu script, dependency, đầu ra được sinh và cách tích hợp.
- Giữ API/component dùng chung ổn định; tránh thêm dependency nếu không cần thiết.
- Không sửa trực tiếp artifact được sinh tự động nếu nguồn tạo ra nó còn tồn tại.
- Sau khi chỉnh email, kiểm tra preview và xuất lại HTML theo quy trình trong `backend/README.md` (`bun run email:dev`, `bun run email:export`).
- Chỉ kết luận email đã được backend sử dụng sau khi xác nhận đường dẫn xuất và luồng gửi tương ứng.

Khi hoàn tất, nêu package và đầu ra bị ảnh hưởng cùng lệnh kiểm tra phù hợp. Không chạy kiểm thử nếu người yêu cầu không đề nghị.
