# Prompt AI — GitHub

`.github/` chứa cấu hình GitHub repository như workflow CI/CD, Dependabot và metadata pull request. Trước khi sửa, đọc workflow đầy đủ và xác định trigger, permission, secret, artifact và môi trường deploy có liên quan.

- Áp dụng quyền tối thiểu cần thiết cho `GITHUB_TOKEN`.
- Không in secret ra log hoặc đưa credential vào YAML.
- Giữ các bước CI nhất quán với lệnh phát triển đã được tài liệu hóa trong repo.
- Khi đổi tên script hoặc lệnh, tìm mọi workflow đang gọi chúng và cập nhật cùng lúc.
- Mô tả rõ workflow nào chạy theo sự kiện nào và tác động của thay đổi. Không kích hoạt release/deploy nếu người yêu cầu không đề nghị.
