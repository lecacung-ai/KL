# Checklist giao diện FinAI Web

Ngày 31/10/2026. Tất cả hàng dưới đây chưa được thực thi trong lượt triển khai; chỉ đã viết source và test. Không sử dụng kết quả test của phiên bản trước để kết luận bản này đạt.

| Kiểm tra | Kỳ vọng | Kết quả thực tế |
|---|---|---|
| TypeScript/Vite | Build frontend không lỗi | Chưa chạy |
| Phạm vi diff | Không có thay đổi backend/services/client/hooks/env/Docker/lockfile | Rà danh sách diff source, chưa kiểm thử runtime |
| Tổng quan | Giá trị từ binding hiện có, không KPI/đồ thị giả | Chưa chạy |
| Sidebar desktop/mobile | Thu gọn, drawer, mục active, điều hướng hoạt động | Chưa chạy |
| Quyền người dùng | User thường không có menu Admin; admin vẫn có | Đã viết test mock, chưa chạy |
| Auth | Form/validation/login/signup/recovery/reset giữ luồng cũ | Chưa chạy |
| Minh họa thương hiệu | Ảnh tải từ `/images/finai-data-story.png`, không có chữ/số/số liệu giả, không che form | Chưa chạy |
| Kho dữ liệu | Tên tệp dài, số dòng/cột, phiên bản, trạng thái | Đã viết test mock viewport, chưa chạy |
| Bộ lọc và phân trang | Giữ hành vi hiện có | Chưa chạy |
| Upload dialog | Mở/đóng bằng Escape không upload; submit giữ validation cũ | Đã viết test mock mở/đóng, chưa chạy |
| Preview và xóa | Bảng scroll riêng, giữ xác nhận và handler | Chưa chạy |
| Phân tích | Hai nguồn, cột, query, quick prompt, submit đúng một lần | Đã viết test mock multipart/query/file và một POST, chưa chạy |
| Kết quả/stdout/code | Giữ toàn bộ nội dung, cuộn ngang cục bộ | Chưa chạy |
| Ảnh | Đúng tỷ lệ, mở lớn/thu gọn/Escape, không đổi src hoặc gọi API | Đã viết test mock mở lớn/Escape không POST lại, chưa chạy |
| Forecast/clustering | Cả hai tab còn dùng được, không POST khi chỉ chuyển tab | Đã viết test mock, chưa chạy |
| History | Filter/detail/copy/download/xóa như trước | Chưa chạy |
| Admin/settings/items | Form, validation, disabled và quyền giữ nguyên | Chưa chạy |
| Loading/empty/error/404 | Nội dung không bị che, không đổi lỗi thành thành công | Chưa chạy; xem dependency lỗi nuốt trong báo cáo |
| 360/390/768/1024/1440 px | Không tràn ngang toàn trang, bảng có scroll riêng | Đã viết test mock, chưa chạy |
| Theme sáng/tối | Giữ lựa chọn khi điều hướng, đủ tương phản | Test mock giữ theme đã viết; chưa chạy/đo tương phản |
| Keyboard/zoom 200% | Focus thấy rõ, dialog Escape, label nút icon, chữ lớn không mất nội dung | Chưa chạy |
| Reduced motion | Tôn trọng lựa chọn giảm chuyển động | Chưa chạy |

`frontend/tests/ui-redesign.config.ts` không dùng auth.setup hoặc webServer config của bộ cũ. Test chặn mọi API, trả fixture synthetic; không có credential thật, Gemini hoặc mutation live. Thông tin test failures nếu có được cấu hình đặt trong docs/evidence/web-ui, không ghi screenshot/trace/video mặc định.

Khi người dùng cung cấp log/ảnh thật, bổ sung ngày, viewport, theme và kết quả từng hàng. Không tạo ảnh trước/sau giả để điền checklist.
