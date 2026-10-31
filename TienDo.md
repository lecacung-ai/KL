# Tiến độ và kiến trúc dự án

> Cập nhật: 25/10/2026

## 1. Kiến trúc backend hiện tại

Backend được tổ chức theo các lớp **Controller → Service → Repository**, kết hợp DTO, Entity, Mapper và Exception. Đây là kiến trúc phân lớp cho ứng dụng FastAPI, không phải MVC thuần: Controller đảm nhiệm vai trò tiếp nhận HTTP request và trả response; phần nghiệp vụ nằm trong Service.

```text
HTTP request
    ↓
Controller ── kiểm tra/nhận DTO, auth dependency, gọi service
    ↓
Service ───── nghiệp vụ, phối hợp các thành phần, xử lý luồng use case
    ├── Repository ── truy vấn và ghi database
    ├── Entity ────── cấu trúc dữ liệu lưu trữ
    ├── Mapper ────── chuyển Entity ↔ DTO/response
    └── Core/Analytics/External service ── hạ tầng, thuật toán, Gemini, sandbox
    ↓
DTO response → HTTP response
```

### Trách nhiệm các thư mục

| Thư mục | Trách nhiệm |
|---|---|
| `backend/app/controllers/` | Định nghĩa endpoint, nhận tham số/request, gọi service và trả response. Đăng ký router tập trung tại `api/main.py`. |
| `backend/app/dto/request/` | Kiểu dữ liệu và validation cho dữ liệu đầu vào của API. |
| `backend/app/dto/response/` | Cấu trúc response công khai của API. |
| `backend/app/entities/` | Entity SQLModel ánh xạ với bảng database và các lớp trường dùng chung. |
| `backend/app/services/` | Use case/nghiệp vụ: dataset, AI analysis, clustering, forecasting, history, user và item. |
| `backend/app/repositories/` | Đóng gói thao tác truy vấn, thêm, cập nhật và xóa dữ liệu database. |
| `backend/app/mappers/` | Chuyển đổi Entity và DTO/response; tránh lặp `model_validate` và dựng danh sách response trong controller. |
| `backend/app/exceptions/` | `ErrorCode`, `AppException` và global exception handler dùng chung. |
| `backend/app/core/` | Cấu hình, database/session, bảo mật và sandbox dùng chung. |
| `backend/app/analytics/` | Thuật toán tính toán clustering, forecasting và metrics; không chứa HTTP hoặc truy vấn database. |
| `backend/app/alembic/` | Migration và cấu hình Alembic cho database. |

## 2. Luồng xử lý chính

### API thông thường

```text
Client → Controller → Service → Repository → Database
                    ← Entity ←───────────────┘
Client ← Response DTO ← Mapper/Controller
```

Ví dụ quản lý dataset: `dataset_controller` nhận request và user hiện tại → `dataset_service` kiểm tra quyền, lưu file và xử lý metadata → `dataset_repository` đọc/ghi entity `Dataset` → mapper tạo response.

### Upload file để hỏi AI

```text
POST /files/upload
  → files_controller
  → ai_analysis_service
      → dataframe_service đọc/chuẩn hóa CSV hoặc Excel, nhận diện cột
      → Gemini sinh mã Python theo câu hỏi và phạm vi cột
      → core.sandbox thực thi mã có giới hạn
      → analysis_history_repository lưu lịch sử
  → response trả mã, kết quả, biểu đồ và trạng thái thực thi
```

`POST /files/inspect-columns` cũng gọi `dataframe_service` để đọc nhanh tên cột, phân loại kiểu dữ liệu và lấy một số giá trị mẫu. Việc nhận diện header/chuẩn hóa tên cột được dùng chung trong [dataframe_service.py](backend/app/services/dataframe_service.py).

### Dự báo và phân cụm

`forecast_controller` và `analytics_controller` chuyển request cho service tương ứng. Service kiểm tra dataset/quyền truy cập, nạp dữ liệu bằng `dataframe_service`, gọi thuật toán trong `analytics/`, sau đó ghi lịch sử qua `analysis_history_repository`.

## 3. Các hạng mục đã thực hiện

| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| Tổ chức endpoint theo `controllers/` | Hoàn thành | Auth, users, datasets, files, analytics, forecast, history, items, utils và private development endpoint đã có controller. |
| Tách nghiệp vụ ra `services/` | Hoàn thành cho các luồng chính | Có service cho user, dataset, file/AI, clustering, forecasting, history và item. |
| Tách database access ra `repositories/` | Hoàn thành cho các entity chính | Có repository user, dataset, item và analysis history. |
| Tách DTO request/response khỏi entity | Đã có cấu trúc | DTO nằm dưới `dto/request` và `dto/response`; entity database nằm dưới `entities/`. |
| Tách mapper | Hoàn thành cho user, dataset, item, analysis history | Mapper response tập trung trong `mappers/`; item mapper cũng tạo entity từ request. |
| Tách loader CSV/Excel và nhận diện cột thành service dùng chung | Hoàn thành | `core/data_loader.py` đã được chuyển thành `services/dataframe_service.py`; các luồng gọi dùng chung service. |
| Tách luồng gọi AI khỏi route | Hoàn thành | Controller nhận request; service điều phối Gemini, sandbox và ghi lịch sử qua repository. |
| Tách thuật toán forecasting/clustering khỏi API | Hoàn thành | Controller/service gọi các thuật toán độc lập trong `analytics/`. |
| Tập trung đăng ký router | Hoàn thành | `backend/app/api/main.py` đăng ký router trực tiếp từ controllers; các route module cũ đã được gỡ. |
| Exception dùng chung | Đã có | Có `ErrorCode`, `AppException`, `global_exception_handler`; cần tiếp tục rà để mọi lỗi nghiệp vụ dùng thống nhất. |
| Xóa thư mục rỗng `backend/app/models.py` | Hoàn thành | Đã xác nhận thư mục rỗng và không có import tham chiếu. |

## 4. Kiểm tra đã thực hiện

- Đã biên dịch cú pháp các file Python vừa thay đổi bằng `compile(...)`.
- `git diff --check` không báo lỗi whitespace; Git có cảnh báo chuẩn hóa LF/CRLF trên Windows.
- Chưa chạy bộ test.
- Chưa xác nhận runtime với môi trường Python local vì môi trường hiện tại thiếu `fastapi` và không nhận lệnh `uv`.

## 5. Việc còn lại / đề xuất tiếp theo

1. Rebuild backend trong Docker để image nhận các thay đổi mới: `docker compose up -d --build backend`.
2. Kiểm tra backend khởi động và thử các endpoint chính: upload/inspect file, hỏi AI, clustering, forecast, history và CRUD dataset/item.
3. Bổ sung hoặc cập nhật test cho các service/repository và kiểm tra quyền truy cập, lỗi file, lỗi Gemini/sandbox.
4. Rà soát import không dùng, format và kiểu dữ liệu; đặc biệt xác nhận import ứng dụng trong môi trường Docker sau khi rebuild.
5. Kiểm tra lại `.env` trước khi commit; `.env` đang có thay đổi local trong workspace và không thuộc nội dung kiến trúc này.

## 6. File đầu mối nên xem

- Router tổng: [backend/app/api/main.py](backend/app/api/main.py)
- Luồng AI/file: [backend/app/controllers/files_controller.py](backend/app/controllers/files_controller.py), [backend/app/services/ai_analysis_service.py](backend/app/services/ai_analysis_service.py)
- Dataset: [backend/app/controllers/dataset_controller.py](backend/app/controllers/dataset_controller.py), [backend/app/services/dataset_service.py](backend/app/services/dataset_service.py), [backend/app/repositories/dataset_repository.py](backend/app/repositories/dataset_repository.py)
- Lịch sử phân tích: [backend/app/controllers/history_controller.py](backend/app/controllers/history_controller.py), [backend/app/services/analysis_history_service.py](backend/app/services/analysis_history_service.py), [backend/app/repositories/analysis_history_repository.py](backend/app/repositories/analysis_history_repository.py)
- Mapper: [backend/app/mappers/](backend/app/mappers/)
- Exception: [backend/app/exceptions/](backend/app/exceptions/)
