# Prompt AI — React Email

Bạn đang sửa package email của ứng dụng FastAPI full-stack. Nguồn mẫu nằm trong `emails/`, các thành phần dùng chung nằm trong `ui/`; HTML được build vào `backend/app/email-templates/`.

- Giữ bố cục email tương thích với các client email phổ biến; ưu tiên cấu trúc và style mà package hiện có sử dụng.
- Giữ tên placeholder Jinja (`{{ ... }}`) khớp với context tạo email trong backend (`backend/app/utils.py`). Không tự ý đổi tên biến nếu chưa cập nhật cả hai phía.
- Sửa component nguồn, không chỉnh HTML xuất ra bằng tay; xuất lại bằng `bun run email:export` từ thư mục gốc.
- Dùng các component chung trong `ui/` khi thích hợp và giữ nhận diện/giọng điệu nhất quán.
- Kiểm tra mẫu bằng `bun run email:dev` khi cần. Báo rõ email nào và placeholder nào thay đổi.
