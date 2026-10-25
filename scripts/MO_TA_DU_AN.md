# Scripts — Mô tả thư mục

Thư mục này tập hợp các script tự động hóa tác vụ phát triển và vận hành:

- `generate-client.sh`: lấy schema OpenAPI và sinh client cho frontend.
- `test.sh`, `test-local.sh`: hỗ trợ chạy kiểm thử trong các môi trường dự án.
- `prepare_release.py`, `add_latest_release_date.py`: hỗ trợ chuẩn bị thông tin phát hành.

Kiểm tra nội dung từng script để biết chính xác tham số, điều kiện chạy và tác động trước khi sử dụng. Các script có thể phụ thuộc vào Bash, Python, Docker, Bun hoặc công cụ repo khác. Đọc [development.md](../development.md), [CONTRIBUTING.md](../CONTRIBUTING.md) và README của backend/frontend để biết quy trình liên quan.
