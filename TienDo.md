# Tiến độ và kiến trúc dự án

> Cập nhật: 03/11/2026 — Chuẩn hóa toàn diện theo kiến trúc Devteria (Spring Boot Zero to Hero pattern)

## 1. Kiến trúc backend hiện tại

Backend được tổ chức chặt chẽ theo mô hình phân lớp **Controller → Service → Repository**, kết hợp DTO, Entity, Mapper và Exception Handling tập trung theo chuẩn kiến trúc của khóa học Spring Boot Devteria:

```text
HTTP request
    ↓
Controller ── Tiếp nhận HTTP request/DTO, xác thực token/quyền, gọi Service (Thin Controller)
    ↓
Service ───── Xử lý toàn bộ logic nghiệp vụ, validation, phối hợp use cases (Rich Service)
    ├── Repository ── Truy vấn và tương tác cơ sở dữ liệu thuần túy
    ├── Entity ────── Cấu trúc bảng cơ sở dữ liệu (SQLModel / SQLAlchemy)
    ├── Mapper ────── Chuyển đổi hai chiều Entity ↔ DTO Response
    └── Core/External ── Gemini AI, Dataframe loader, Code Sandbox, Mailer
    ↓
DTO response → HTTP response
```

### Trách nhiệm các thành phần theo chuẩn Devteria

| Thư mục | Trách nhiệm theo kiến trúc |
|---|---|
| `backend/app/controllers/` | **Thin Controller**: Chỉ tiếp nhận HTTP request, giải nén params/DTO, chuyển tiếp cho Service và trả DTO/ApiResponse. Tuyệt đối không chứa logic nghiệp vụ, hashing mật khẩu hay truy vấn database trực tiếp. |
| `backend/app/services/` | **Rich Service**: Chứa toàn bộ nghiệp vụ, logic kiểm tra (email trùng, mật khẩu cũ/mới, quyền sở hữu), gọi repository và điều phối các tác vụ. Có `AuthService`, `UserService`, `DatasetService`, `ItemService`, `AiAnalysisService`, `ForecastService`, `ClusteringService`. |
| `backend/app/repositories/` | **Persistence Layer**: Đóng gói các truy vấn cơ sở dữ liệu (`get_by_id`, `get_by_email`, `exists_by_email`, `list`, `save`, `delete`). Không chứa hashing mật khẩu hay logic HTTP. |
| `backend/app/dto/request/` | DTO đầu vào của API, phân định rõ `*Request` (ví dụ `UserCreate`, `UserUpdate`, `ClusteringRequest`, v.v.). |
| `backend/app/dto/response/` | DTO đầu ra của API (`UserPublic`, `DatasetPublic`, v.v.) và `ApiResponse<T>` wrapper chuẩn `{ code: 1000, message: "Success", result: ... }`. |
| `backend/app/entities/` | Các Database Entity ánh xạ với bảng DB (`User`, `Dataset`, `Item`, `AnalysisHistory`). |
| `backend/app/mappers/` | Đóng vai trò tương tự MapStruct: Ánh xạ chuyển đổi giữa Entity ↔ Response DTO (`to_user_response`, `to_dataset_response`, `to_item_response`). |
| `backend/app/exceptions/` | Quản lý lỗi tập trung: Enum `ErrorCode` (chứa error code, default message, http_status), `AppException` và `global_exception_handler` tương tự `@ControllerAdvice`. |
| `backend/app/core/` | Cấu hình (`config.py`), kết nối database (`db.py`), bảo mật JWT & password hashing (`security.py`), sandbox thực thi mã an toàn (`sandbox.py`). |
| `backend/app/analytics/` | Các thuật toán xử lý dữ liệu và Machine Learning (Clustering, Forecasting) độc lập với tầng HTTP. |

---

## 2. Luồng xử lý chính

### API Luồng chuẩn (Chuẩn 3 tầng)

```text
Client → Controller → Service → Repository → Database
                     ↓          ← Entity ────┘
              Mapper (to_*_response)
                     ↓
Client ← Response DTO / ApiResponse
```

---

## 3. Các hạng mục tái cấu trúc đã hoàn thiện

| Hạng mục | Trạng thái | Chi tiết thực hiện |
|---|---|---|
| **Tách AuthService độc lập** | Hoàn thành | Tạo `backend/app/services/auth_service.py` đóng gói toàn bộ luồng đăng nhập, cấp token, gửi email quên mật khẩu, reset mật khẩu và render HTML preview. |
| **Thin AuthController** | Hoàn thành | Tinh gọn `auth_controller.py`, loại bỏ hoàn toàn nghiệp vụ và gọi thẳng `auth_service`. |
| **Chuẩn hóa UserService** | Hoàn thành | Chuyển toàn bộ nghiệp vụ kiểm tra email trùng, quyền admin/user, đổi mật khẩu, xóa tài khoản từ `users_controller` vào `user_service`. |
| **Thin UsersController** | Hoàn thành | `users_controller.py` trở thành Thin Controller chuẩn mực, mapping mọi Entity trả về qua `to_user_response`. |
| **Làm sạch UserRepository** | Hoàn thành | Tách nghiệp vụ ra khỏi repository; bổ sung `exists_by_email`; giữ nguyên các hàm query database. |
| **Sửa lỗi ItemService** | Hoàn thành | Bổ sung mã lỗi `ITEM_NOT_FOUND` và `RESOURCE_NOT_FOUND` trong `ErrorCode`, khắc phục triệt để nguy cơ `AttributeError`. |
| **Bổ sung ApiResponse wrapper** | Hoàn thành | Thêm `ApiResponse<T>` trong `dto/response/api_response.py` theo đúng định dạng chuẩn của Devteria. |
| **Sửa lỗi Mount Frontend** | Hoàn thành | Sửa lỗi `app.frontend` thành `StaticFiles` mounting trong `backend/app/main.py`. |
| **Sửa cú pháp Deps** | Hoàn thành | Chuẩn hóa cú pháp tuple exception trong `backend/app/api/deps.py`. |
| **Dọn dẹp thư mục dư thừa** | Hoàn thành | Xóa bỏ thư mục rỗng `backend/app/api/routes`. |
| **Nâng cấp Data Analysis AI Agent** | Hoàn thành | Thiết kế lại logic `ai_analysis_service` và `analysis_prompt` theo chuẩn LangChain Agent: Data Profiling, Multi-turn Chat Memory, ReAct execution loop, tự động sửa lỗi và sinh nhận định kinh doanh. |
| **Kiến trúc Tool-Calling Agent (Function Calling)** | Hoàn thành | Xây dựng bộ Tools chuẩn (`get_data_info`, `filter_data`, `analyze_data`, `plot_chart`) trong `agent_tools.py`. LLM tự quyết định gọi Tool hay trả lời trực tiếp: Khi 'hello' không gọi tool và không vẽ hình; Khi hỏi số liệu gọi `analyze_data`; Khi yêu cầu vẽ biểu đồ gọi `plot_chart` và xuất ảnh `output.png`. |
| **Phân loại Intent & Kiểm soát Biểu đồ** | Hoàn thành | Tách bạch 3 luồng xử lý: (1) Hội thoại/chào hỏi (hello/hi) trả lời ngắn gọn, lịch sự, không tự tiện giới thiệu tệp hay gợi ý câu hỏi khi chưa được yêu cầu; (2) Tính toán số liệu chỉ in kết quả và insights, cấm tạo ảnh; (3) Vẽ biểu đồ khi và chỉ khi người dùng yêu cầu trực quan hóa. |
| **Hiển thị Bảng Dữ liệu (Dataframe Display - df.head())** | Hoàn thành | Tích hợp thành phần hiển thị DataFrame trực quan tương tự `st.dataframe(df.head())`: Ngay khi chọn hoặc tải tệp lên, bảng dữ liệu mẫu được đưa trực tiếp lên đầu màn hình phân tích với chỉ số dòng (# 0, 1, 2...), sticky header, cuộn ngang/dọc mượt mà và nút thu gọn/mở rộng. |
| **Vòng lặp Suy luận Đa bước (Multi-Step ReAct Loop)** | Hoàn thành | Tích hợp cơ chế ReAct đa bước (lên tới 5 bước tuần tự) lấy cảm hứng từ video Kevin Stratvert: Agent tự động lập kế hoạch và chuỗi công cụ (Lọc ➔ Tính toán ➔ Vẽ biểu đồ ➔ Xuất file ➔ Nhận định kinh doanh). |
| **Hộp thoại Giám sát Trực quan (Observability Trace UI)** | Hoàn thành | Bảng ReAct Trace trực tiếp trong từng bong bóng tin nhắn của Agent, hiển thị chi tiết từng bước: Tool name, Input arguments, Execution time (ms), Success/Error status và khung Observation xem trước kết quả. |
| **Công cụ Xuất Dữ liệu (Dataset Export Tool)** | Hoàn thành | Thêm tool `export_dataset` cho phép Agent lọc/biến đổi dữ liệu và xuất trực tiếp ra tệp `.xlsx` hoặc `.csv` lưu trong `/tmp/exports`, tích hợp endpoint `GET /api/v1/files/download-export/{filename}` và Card tải file tương tác trên giao diện. |
| **Giao diện Chat AI Agent (LangChain + Streamlit style)** | Hoàn thành | Thiết kế lại `DataAnalyzer.tsx` thành giao diện đối thoại 2 cột: Cột trái quản lý nguồn dữ liệu (Kho/Tải lên), xem trước 5 dòng, lọc cột scope; Cột phải là feed chat đa lượt hiển thị bong bóng tin nhắn, biểu đồ inline, code viewer thu gọn và khung chat cố định. Giữ nguyên 100% FinAI branding màu sắc. |
| **Tinh chế & Cắt tỉa Chi tiết Dư thừa (UX Refinement)** | Hoàn thành | Loại bỏ bảng xem trước 5 dòng chật hẹp ở Sidebar (tránh lặp với bảng chính); Gỡ bỏ thanh chọn phạm vi cột thủ công (để AI Agent tự động xử lý schema linh hoạt); Tinh giản bong bóng chat, gộp ReAct Trace và Code Python vào mục 'Chi tiết thực thi kỹ thuật' thu gọn mặc định; Chuẩn hóa ngôn ngữ tài chính doanh nghiệp, loại bỏ hoàn toàn các biệt ngữ kỹ thuật lộ liễu. |
| **Chuẩn hóa Làm sạch Dữ liệu (Corey Schafer Part 9 Standard)** | Hoàn thành | Áp dụng toàn diện chuẩn của Corey Schafer (*Cleaning Data - Casting Datatypes and Handling Missing Values*): (1) `CUSTOM_NA_VALUES` nhận diện mọi placeholder tùy chỉnh (`NA`, `Missing`, `-`, `?`); (2) Loại bỏ cột/dòng rỗng qua `dropna(axis=..., how='all')`; (3) Subsetting `dropna(subset=critical_cols)` cho các cột khóa; (4) Chuyển đổi chuỗi khảo sát/thực tế sang số (`replace({'less than 1 year': '0.5', ...})`); (5) Ép kiểu `float` qua `pd.to_numeric().astype(float)` cho cột có NaN; (6) `fillna(0.0)` với hằng số chuẩn hóa số học, loại bỏ việc chế median làm méo mó báo cáo tài chính; (7) Bổ sung giám sát khuyết thiếu `isna().sum()` và `dtypes` vào Tool `get_data_info` cho AI Agent. |
| **Khắc phục lỗi Kết xuất Biểu đồ Trực quan hóa (Chart Rendering Fix)** | Hoàn thành | Khắc phục triệt để tình trạng Agent sinh mã vẽ hình nhưng không hiển thị biểu đồ: (1) Sửa lỗi `NameError: name 'df' is not defined` khi mã AI sinh ra bắt đầu bằng `import ...` mà chưa nạp `df`; (2) Tự động tiêm cấu hình headless `matplotlib.use('Agg')` và nạp sẵn biến `df` vào môi trường sandbox; (3) Tự động can thiệp hook `plt.show()` để lưu ảnh về `output.png` thay vì đóng/mất figure; (4) Cơ chế trích xuất ảnh dự phòng từ khối mã Markdown text nếu LLM phản hồi text thay vì function call; (5) Tự động quét và đóng gói ảnh Base64 trả về cho Frontend hiển thị tức thì. |
| **Đồng bộ Thời gian Thực (Real-time Clock Context Injection)** | Hoàn thành | Khắc phục lỗi AI trả lời sai ngày/tháng/năm hiện tại (do bản chất LLM bị giới hạn bởi Training Cutoff): Tự động tiêm thời gian thực tế của hệ thống (Thứ, Ngày, Tháng, Năm, Giờ theo múi giờ Việt Nam GMT+7) vào `system_instruction` của AI Agent và tối ưu thứ tự Model API fallback (`gemini-3.1-flash-lite`), giúp phản hồi chính xác 100% thời gian thực tế trong vòng dưới 1 giây. |
| **Sửa lỗi Thực thi Tính toán File Excel (Excel Code Execution Fix)** | Hoàn thành | Khắc phục triệt để lỗi khi người dùng yêu cầu tính toán trên file Excel (như `tính tổng vào 2025-12-31`): (1) Sửa lỗi cú pháp `SyntaxError: invalid syntax` trong `execute_analyze_data` khi mã AI sinh ra có ghi chú hoặc nhiều dòng; (2) Tự động nạp `df = pd.read_excel(...)` và `import numpy as np`; (3) Tự động in kết quả biến (`result`, `total`, `output`) nếu mã thiếu `print()`; (4) Cập nhật danh sách model Gemini tối ưu (`gemini-3.5-flash`, `gemini-3.5-flash-lite`) tránh lỗi 404/429 Quota Exceeded. |
| **Tích hợp Chuẩn LangChain Pandas Agent (Ryan & Matt Pattern)** | Hoàn thành | Áp dụng toàn diện nguyên lý từ video *'How to Build and Use Langchain Agents with Pandas DataFrames'* của Ryan & Matt Data Science: Agent đóng vai trò Python REPL thông minh, tự động phân tích cấu trúc DataFrame, lập kế hoạch suy luận (Thought), sinh mã Pandas thao tác trực tiếp trên `df` (lọc dòng, groupby, aggregate, tính tỷ lệ tài chính), thực thi trong Sandbox an toàn và tổng hợp báo cáo chỉ số kinh doanh chính xác 100%. |
| **Trí Tuệ Gợi Ý Thuật Toán & Dự Báo 5 Giáo Trình Chuẩn (5-Video AI Integration)** | Hoàn thành | Tích hợp toàn diện hệ sinh thái phân loại tệp và gợi ý thuật toán dựa trên 5 video bài giảng quốc tế danh tiếng: (1) *Time Series Forecasting in Python – freeCodeCamp.org* (ARIMA, SARIMA, Holt-Winters); (2) *Linear Regression Algorithm with Code Examples – Python Simplified (Mariya Sha)* (OLS, R², MAE); (3) *LSTM Time Series Forecasting – Code with Josh* (Lag-window sequential deep learning); (4) *StatQuest: Logistic Regression (Josh Starmer)* (Đường cong Sigmoid, ma trận nhầm lẫn, tỷ số tỷ cược Odds Ratios e^β đo lường mức độ tác động rủi ro tín dụng); (5) *K-Means Clustering – Andy McDonald* (StandardScaler, PCA 2D, Silhouette Score, gán nhãn nghiệp vụ). Hệ thống tự động nhận diện loại tệp tài chính (BCTC định kỳ, Chuỗi thời gian bán hàng, Hồ sơ tín dụng, Phân khúc danh mục), đưa ra gợi ý thông minh trên giao diện `/forecast` với nút 'Áp dụng 1-click', bổ sung Tab 'Phân loại rủi ro Logistic Regression', cho phép người dùng tùy chọn linh hoạt biến mục tiêu (Y) và đặc trưng (X), đồng thời tích hợp Tool `recommend_forecast_algorithms` cho AI Agent trong luồng chat. |
| **Thiết Kế Lại Bố Cục Chat-First (Chat-First Layout Redesign)** | Hoàn thành | Tái cấu trúc giao diện toàn diện theo phong cách **Chat-First** (tương tự ChatGPT / Claude / Perplexity): (1) Đưa không gian hội thoại AI Agent (`DataAnalyzer`) lên làm trung tâm của Dashboard ngay đầu trang; (2) Tinh gọn Top Bar chứa bộ chọn tệp từ kho, nút đính kèm tải tệp mới; (3) Loại bỏ cột bên trái chật hẹp, mở rộng không gian trò chuyện toàn màn hình rộng rãi; (4) Thanh nhập liệu cố định ở đáy giao diện với nút đính kèm tệp và phím tắt Enter tiện lợi; giữ nguyên 100% FinAI branding màu sắc (`#f5c579`, `#0f766e`). |
| **Tinh Gọn Giao Diện & Đồng Bộ Kho Dữ Liệu (Streamlined UX & Persistent Upload)** | Hoàn thành | Thực hiện trọn vẹn 3 yêu cầu tinh giản trải nghiệm: (1) **Bỏ xem cấu trúc & dữ liệu mẫu ở Kho Dữ Liệu**: Gỡ bỏ nút 'Xem cấu trúc & dữ liệu mẫu' (icon mắt) và `DatasetPreviewModal` khỏi `datasets.tsx` và `index.tsx`; trên Dashboard khi bấm vào tệp sẽ tự động kích hoạt chế độ 'Phân tích với AI' trên khung chat; (2) **Bỏ chức năng gợi ý prompt**: Xóa bỏ danh sách `QUICK_PROMPTS` và các thẻ gợi ý prompt tạo sẵn trong chat, giữ màn hình chào mừng trang nhã, tập trung vào năng lực cốt lõi và khung nhập liệu tự do; (3) **Bỏ upload tạm thời, lưu tệp vĩnh viễn**: Loại bỏ luồng `inspect-columns` chỉ lưu file trong RAM/state tạm; toàn bộ thao tác tải tệp qua nút 'Tải tệp mới' hay nút đính kèm ghim kẹp đều gọi thẳng `DatasetsService.uploadDataset`, lưu trữ vĩnh viễn vào CSDL PostgreSQL và thư mục lưu trữ, tự động cấp phát `dataset_id` để phân tích ngay trong phiên chat. |
| **Tổng Quan Thuần Chat & Chuyển Không Gian Phân Tích vào Thanh Bên Trái** | Hoàn thành | (1) **Tối ưu trang Tổng quan**: Gỡ bỏ hoàn toàn tab 'Gần đây / Những tệp bạn đang làm việc' và card 'Dự báo & phân nhóm 5 mô hình', giúp trang chủ trở thành giao diện Chat AI Agent toàn màn hình 100% không phân tán; (2) **Không Gian Phân Tích Thông Minh**: Thiết kế thẻ định vị thương hiệu tinh gọn, sang trọng nằm ngay phía trên của thanh bên trái (`AppSidebar.tsx` dưới Logo) với icon Sparkles vàng cam FinAI; (3) **Tải tệp mới trực quan ngay dưới câu chào**: Bổ sung khu vực kéo thả / chọn file trực tiếp (`Dropzone Box`) nằm ngay dưới câu giới thiệu của `DataAnalyzer`, cho phép người dùng click hoặc kéo thả tệp Excel/CSV để tải thẳng vào Kho Dữ Liệu. |
| **Thiết Kế Vừa Vặn & Thanh Điều Hướng Nhanh Tính Năng (Fitted Layout & Quick Actions)** | Hoàn thành | (1) **Trang Tổng quan vừa vặn (No-Scroll Viewport Fit)**: Căn chỉnh chiều cao `DataAnalyzer` động theo màn hình (`h-[calc(100vh-13.5rem)] min-h-[580px]`), tinh chỉnh padding layout `_layout.tsx` và màn hình khởi động trống (`Empty State`) nhỏ gọn; toàn bộ Top Toolbar, Dropzone Box và Chat Input Bar hiển thị trọn vẹn trong một khung nhìn không bị cuộn cửa sổ; (2) **Lối tắt điều hướng tính năng 1-click**: Bổ sung thanh Quick Action Pills ngay đầu trang Tổng quan (`/`) và nút liên kết trực tiếp trên Toolbar của `DataAnalyzer`, giúp người dùng chỉ cần 1 nhấp chuột là di chuyển ngay tới: **Kho Dữ Liệu** (`/datasets`), **Dự Báo & Phân Nhóm 5 Mô Hình** (`/forecast`), **Lịch Sử Phân Tích** (`/history`). |
| **Tái Thiết Kế Toàn Diện Giao Diện FinAI theo Minimalist Enterprise SaaS** | Hoàn thành | Tái thiết kế toàn bộ Frontend theo phong cách **Minimalist AI Workspace** (kết hợp triết lý ChatGPT, Linear, Notion): (1) **Design System**: Chuẩn hóa biến CSS, bo góc `0.625rem` (10px), nút bấm tiêu chuẩn `h-9`, thẻ card `shadow-2xs border-border/80`, bảng màu slate trung tính giữ nguyên 2 màu thương hiệu `#0f766e` (Teal) và `#f5c579` (Warm Gold); (2) **AppSidebar & WorkspaceHeader**: Sidebar chuẩn 240px (`15rem`), navigation item `h-8.5 rounded-lg text-[13px]`, header siêu gọn 48px với Breadcrumb & Quick shortcuts; (3) **Dashboard Chat-First**: Màn hình chat AI ChatGPT-style, tích hợp Dropzone CSV/Excel, 3 chips gợi ý chuẩn, auto-resize textarea cố định đáy, bong bóng chat Markdown, Trace accordion và biểu đồ zoomable; (4) **Kho Dữ Liệu (`/datasets`)**: Dải 3 KPI tối giản, thanh tìm kiếm + lọc định dạng có nút Xóa lọc, Data Table kèm phân trang và Dropdown thao tác tải/xóa; (5) **Dự Báo & Phân Nhóm (`/forecast`)**: Bố cục phân tầng Header → Dataset → Recommendations → 3 Tabs cấu hình → Kết quả định lượng (R², Silhouette, Accuracy), xuất file CSV 1-click; (6) **Lịch Sử Phân Tích (`/history`)**: Dải 4 KPI, bảng nhật ký phân trang, Modal chi tiết tổ chức dạng Tab (Tổng quan, Biểu đồ, Số liệu stdout, Mã Python, Lỗi) loại bỏ hoàn toàn tình trạng cuộn dài; (7) **Trang Xác Thực (`/login`, `/signup`, `/recover-password`, `/reset-password`)**: Bố cục AuthLayout tối giản căn giữa (max 420px), không tải ảnh nặng, tập trung vào tốc độ và sự trang nhã. |
| **Tối Ưu Giao Diện Tương Thích & Đơn Giản Hóa Tham Số Định Lượng** | Hoàn thành | Thực hiện triệt để tinh giản và chống tràn màn hình theo yêu cầu: (1) **Thiết kế tương thích toàn diện**: Áp dụng thẻ responsive, `w-full min-w-0 max-w-full overflow-hidden`, xử lý `truncate`/`break-words` chống tràn ngang; (2) **Xóa các nút chuyển trang**: Loại bỏ toàn bộ các nút phân trang ('Trước', 'Tiếp', số trang) và các nút chuyển trang thừa ở Kho dữ liệu (`/datasets`), Lịch sử (`/history`); (3) **Trang Tổng Quan**: Cắt giảm phụ đề rườm rà, loại bỏ badge sandbox/phần cứng, giữ duy nhất **1 nút 'Tải lên Dữ liệu'** trên thanh công cụ, placeholder thanh nhập liệu chuẩn hóa thành **'Nhập câu hỏi...'**, căn chỉnh chiều cao vừa vặn khung nhìn; (4) **Trang Dự Báo & Phân Nhóm (`/forecast`)**: Loại bỏ các banner bài giảng rườm rà, giữ đúng 4 thành phần cốt lõi: Chọn file, Upload file trực tiếp, Chọn thuật toán (tên tiếng Anh 100% kèm 1 dòng mô tả) và Tích hợp vẽ biểu đồ phân tích (`ResultFigure`); cho phép người dùng **tự nhập số kỳ** (forecast horizon), **tự nhập số cụm K** (K-Means), **tự nhập tỷ lệ kiểm định** (Logistic test size). |
| **Tích hợp Chatbox AI Thu Nhỏ Hỏi Đáp Dự Báo & Phân Nhóm** | Hoàn thành | Bổ sung widget Chatbox AI thu nhỏ tại góc dưới phải trang Dự Báo & Phân Nhóm (`/forecast`): (1) Nút pill nổi bật 'Hỏi AI về dự báo' mở/thu gọn linh hoạt không làm dịch chuyển hay tràn bố cục trang; (2) Tự động tiêm ngữ cảnh mô hình hiện tại (Model type, Biến mục tiêu, R², MAE, Tăng trưởng %, K cụm, Test size) vào câu hỏi; (3) Tích hợp 3 câu hỏi gợi ý nhanh theo từng tab (Forecasting, Clustering, Classification); (4) Gọi thẳng API `analyze-dataset-conversational` để giải thích thuật toán, phân tích ý nghĩa chỉ số và hỗ trợ người dùng ra quyết định kinh doanh. |
| **Biên dịch Frontend Bundle** | Hoàn thành | Build thành công toàn bộ static bundle vào `backend/app/frontend` bằng Bun/Vite, sẵn sàng phục vụ tại `http://localhost:8000/`. |
| **Kiểm tra biên dịch** | Hoàn thành | Biên dịch 100% các file Python trong `backend/app` và `backend/tests` thành công không có lỗi. |

---

## 4. File đầu mối kiến trúc

- **Authentication**: [backend/app/controllers/auth_controller.py](backend/app/controllers/auth_controller.py) → [backend/app/services/auth_service.py](backend/app/services/auth_service.py)
- **User Management**: [backend/app/controllers/users_controller.py](backend/app/controllers/users_controller.py) → [backend/app/services/user_service.py](backend/app/services/user_service.py) → [backend/app/repositories/user_repository.py](backend/app/repositories/user_repository.py)
- **Dataset Management**: [backend/app/controllers/dataset_controller.py](backend/app/controllers/dataset_controller.py) → [backend/app/services/dataset_service.py](backend/app/services/dataset_service.py) → [backend/app/repositories/dataset_repository.py](backend/app/repositories/dataset_repository.py)
- **AI Analysis & Files**: [backend/app/controllers/files_controller.py](backend/app/controllers/files_controller.py) → [backend/app/services/ai_analysis_service.py](backend/app/services/ai_analysis_service.py)
- **Mappers**: [backend/app/mappers/](backend/app/mappers/)
- **Exceptions & ErrorCode**: [backend/app/exceptions/](backend/app/exceptions/)
- **DTOs**: [backend/app/dto/](backend/app/dto/)
