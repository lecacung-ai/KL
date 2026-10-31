# Thiết kế lại giao diện FinAI Web

Ngày cập nhật: 31/10/2026. Phạm vi: lớp trình bày frontend React trong KL, nhánh `tri`. Trước lượt triển khai chỉ có file prompt trong docs chưa theo dõi; không có dirty source khác.

## Diện mạo mới

Giao diện dùng nền giấy sáng, bề mặt trắng, chữ mực xanh và màu xanh ngọc. Hổ phách tạo điểm nhấn ở phần hướng dẫn; dark mode có token riêng và giữ lựa chọn qua ThemeProvider cũ. Không tải font/dependency mới. Một minh họa thương hiệu riêng, không có chữ/số hoặc dữ liệu tài chính giả, được tạo cho FinAI và lưu tại `frontend/public/images/finai-data-story.png`. Bỏ neon, biểu tượng lấp lánh và nhãn AI trang trí lặp lại.

Thay đổi đáng kể về bố cục:

| Khu vực | Thay đổi trình bày |
|---|---|
| Khung ứng dụng | Sidebar rõ mục đang chọn, header có ngữ cảnh trang, lối tắt cài đặt và skip link. Giữ drawer/thu gọn Radix và quyền Admin. |
| Auth | Bố cục editorial hai phần mới: minh họa dữ liệu toàn khung, thông điệp thương hiệu, hành trình ba bước và form nổi riêng; mobile ưu tiên form. Giữ submit/schema/validation/cơ chế auth. |
| Tổng quan | Hero hai mảng có minh họa và lời chào, dải chỉ số liền mạch, “kệ” tệp dạng lưới và khối hành động dự báo tương phản. Bỏ thanh tiến độ thiếu căn cứ; giữ giá trị/tính toán hiện có. |
| Kho dữ liệu | Tiêu đề/thao tác rõ, hệ màu và typography thống nhất. Giữ search, filter, download, preview, upload, xóa và mọi handler. |
| Phân tích | Trở thành một “studio” có phần mở đầu nền mực, quy trình ba bước theo trục dọc, nhóm nguồn dữ liệu/chọn cột/câu hỏi và vùng kết quả riêng. Giữ nội dung quick prompt và payload. |
| Dự báo/phân nhóm | Giữ cả hai tab và control hiện có; bỏ header kỹ thuật dài, nhóm form/kết quả theo cùng hệ thiết kế. Không đổi mô hình/enum/metrics/giá trị. |
| Lịch sử | Bộ lọc, bảng, detail và trạng thái giữ binding cũ, trình bày đồng bộ; không chạy lại phân tích khi mở kết quả. |
| Quản trị/cài đặt/items | Tiêu đề và form có bề mặt riêng; các dialog/thành phần dùng chung nhận theme mới. Items không được thêm vào menu chính. |
| Kết quả ảnh | ResultFigure mở lớn cùng phần tử img bằng state UI local; không nhân đôi ảnh, đổi src, fetch lại dữ liệu hoặc gọi lại phân tích. Escape/Tab và focus được xử lý trong vùng mở lớn. |
| Error/404 | Ngôn ngữ dễ hiểu, hành động về tổng quan; giữ test ID và liên kết cũ. |

## File chính

- `frontend/src/index.css`: token màu sáng/tối, nhịp chữ, layout và reduced motion.
- `frontend/public/images/finai-data-story.png`: minh họa editorial do công cụ tạo ảnh dựng riêng cho FinAI; không chứa chữ, số hay số liệu giả.
- `frontend/src/components/Common/PageHeading.tsx`, `WorkspaceHeader.tsx`, `ResultFigure.tsx`: component trình bày mới; không có query/mutation.
- `frontend/src/components/Common/{AuthLayout,Logo,Footer,Appearance,ErrorComponent,NotFound,DataTable}.tsx`.
- `frontend/src/components/Sidebar/{AppSidebar,Main,User}.tsx`.
- `frontend/src/components/ui/{button,card,input,password-input,dialog,table,tabs}.tsx`: kích thước, bo góc, scroll, focus và bề mặt; giữ primitive Radix và callbacks.
- `frontend/src/routes/_layout.tsx`, các trang `index/datasets/forecast/history/admin/settings/items`, các trang auth và `DataAnalyzer.tsx`.
- `frontend/src/components/Datasets/{DatasetPreviewModal,UploadDatasetDialog}.tsx` và một số component UserSettings/Admin: đổi class/nội dung trình bày.
- Test cũ chỉ điều chỉnh selector/nhãn giao diện có đổi; bộ mock riêng: `frontend/tests/ui-redesign.spec.ts`, `ui-redesign.config.ts`.

Footer bỏ các link mạng xã hội FastAPI không thuộc sản phẩm; không bỏ chức năng tài khoản/dữ liệu hoặc xóa thông tin giấy phép source. Không tạo KPI/ảnh/đồ thị tài chính demo trong runtime.

## Phạm vi giữ nguyên

Không sửa backend, services, client, hooks, env, Docker/Compose, database, migration, uploads, proxy/CORS, CI, dependency hoặc lockfile. Không sửa Flutter. Route path, beforeLoad/guard, kiểm tra role, hàm gọi API, validation/schema, query keys, phép tính và handler nghiệp vụ giữ nguyên. Thay đổi ảnh chỉ là state hiển thị cục bộ; không thêm endpoint.

Không chạy dev server, browser, build, test, package install, Docker hoặc API live. Không gọi Gemini cho nghiệp vụ phân tích, không thao tác dữ liệu thật; không commit/push/merge/switch nhánh. Công cụ tạo ảnh chỉ được dùng để tạo asset trình bày tĩnh nêu trên, không liên quan API/backend FinAI.

## Những điểm nghiệp vụ hiện có cần xử lý riêng

Các điểm sau quan sát từ source frontend, không sửa trong nhiệm vụ UI:

1. Tổng quan mặc định health score 100 khi schema thiếu/lỗi. Giá trị và công thức giữ nguyên; nhãn mới chỉ nói thông tin cấu trúc đã lưu, không khẳng định kiểm chứng.
2. Một số `.catch(() => {})` của tải dataset không lưu trạng thái lỗi riêng; giao diện có thể nhìn giống danh sách trống khi request thất bại. Cần tác vụ logic riêng, không giả báo đã sửa.
3. DataAnalyzer gắn badge “Sandbox an toàn” từ thời gian > 0, và cách hiển thị thành công/lỗi phụ thuộc các trường hiện có. Không xem badge này là kiểm chứng bảo mật/tính đúng; điều kiện cũ không bị đổi.
4. Selection mặc định rỗng nghĩa là toàn bộ dữ liệu trong web hiện tại, khác thiết kế mobile; giữ semantics/payload đang có.
5. Preview có health score/recommendations fallback từ metadata; forecast và history có cách tính/diễn giải số liệu cần backend/nhóm xác minh. Không đổi null, fitted, khoảng dự báo hay memory thành một ý nghĩa mới.
6. Branch hiện đọc có nút download dùng window.open và URL dịch vụ, cùng một số URL localhost viết trực tiếp. Những điểm auth/storage/network cần xử lý riêng; UI không sửa service/request hoặc cam kết file thiếu đã được chặn nếu source hiện tại chưa làm.
7. Validation/toast do tầng logic trả vẫn có thể bằng tiếng Anh. Lượt này chỉ dịch nội dung trình bày, không đổi schema/error handler để tránh thay nghiệp vụ.

## Kiểm chứng

Đã đọc source và diff để rà phạm vi. Chưa chạy TypeScript/Biome/Playwright/build hoặc kiểm tra hình ảnh trong trình duyệt. Các test mới là mã kiểm tra chưa thực thi; không ghi Pass hoặc đã đạt WCAG. Cần người dùng chạy theo `docs/WEB_UI_REDESIGN_RUN_GUIDE.md` và checklist `docs/testing/WEB_UI_REDESIGN_ACCEPTANCE.md`.
