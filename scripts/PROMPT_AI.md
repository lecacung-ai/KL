# Prompt AI — Scripts

`scripts/` chứa công cụ hỗ trợ phát triển, kiểm thử và phát hành của repository. Trước khi sửa script, hãy đọc toàn bộ script, các lệnh gọi nó và workflow liên quan.

- Giữ script tương thích với môi trường mà dự án đang dùng (Bash/Python, Bun, uv, Docker Compose).
- Không làm lộ giá trị `.env`, token hay thông tin xác thực trong stdout/stderr.
- Với script sinh mã, phát hành hoặc thay đổi trạng thái repo, nêu rõ đầu vào, đầu ra và tác động trước khi thực thi.
- Giữ thao tác có thể lặp lại an toàn khi phù hợp; xử lý mã thoát và lỗi rõ ràng.
- Nếu cập nhật quy trình CI/release, đồng bộ tài liệu và `.github/workflows/` liên quan.

Khi hoàn tất, tóm tắt cách chạy và các ảnh hưởng. Không chạy kiểm thử hoặc script có tác động nếu người yêu cầu không đề nghị.
