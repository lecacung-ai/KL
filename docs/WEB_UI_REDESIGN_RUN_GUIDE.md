# Tự chạy giao diện FinAI Web mới

Ngày 31/10/2026. Agent chỉ sửa frontend và viết test/docs, chưa chạy các lệnh dưới đây. Không cần build lại backend hoặc Docker để xem source frontend mới qua Vite.

## Cách chạy chính theo yêu cầu: FE và BE cùng cổng 8000

Người dùng yêu cầu giữ địa chỉ localhost:8000. Source backend hiện phục vụ frontend tại `/app/backend/app/frontend` bên trong container. Frontend mới cần được build thành asset và đưa vào đó; Vite 5173 chỉ là cách phát triển riêng, không phải cách chạy chính người dùng yêu cầu.

Không sửa Python/backend, Compose hoặc image. Người dùng tự thực hiện khi container backend đã có và đang hoạt động:

```powershell
cd C:\Users\Dat\Documents\GitHub\KL
npm.cmd run build --workspace frontend -- --outDir dist
```

Chỉ khi build thành công, mới cập nhật asset frontend vào container hiện có:

```powershell
docker compose cp ./frontend/dist/. backend:/app/backend/app/frontend/
```

Mở http://localhost:8000 và nhấn Ctrl+F5. Nếu backend giữ index cũ trong bộ nhớ, người dùng có thể restart riêng service backend; không cần build lại image để cập nhật tạm asset này. Không xóa volume/database/cache.

`--outDir dist` quan trọng vì cấu hình Vite mặc định ghi vào backend/app/frontend trên host. Các lệnh trên giữ output build ở frontend/dist, chỉ chép asset giao diện đã biên dịch vào container, không sửa source backend.

Giới hạn: docker compose cp là cập nhật container hiện tại; tạo lại container từ image cũ sẽ mất bản FE vừa chép. Cập nhật bền vững vào image/deploy là bước riêng cần thống nhất sau; không tự đổi Dockerfile/Compose hoặc build image trong nhiệm vụ UI này. Agent chưa chạy build/copy/restart để xác nhận kết quả.

## Mở bản Vite

### Máy hiện có Node/npm, chưa có Bun

Đã kiểm tra máy có Node 24.11.1 và npm.cmd, chưa tìm thấy Bun trên PATH hoặc vị trí mặc định. Chưa có Vite trong node_modules được kiểm tra. Người dùng có thể dùng npm cho script dev, không cần cài thêm Bun:

```powershell
cd C:\Users\Dat\Documents\GitHub\KL
npm.cmd install --workspace frontend --package-lock=false
npm.cmd run dev --workspace frontend
```

Bước install tải dependency của workspace frontend. Dùng `--package-lock=false` để không tạo/ghi lại lockfile; npm không dùng bun.lock nên không coi đây là kiểm chứng cài đặt chính xác theo Bun lock. Không commit cache/node_modules. Agent chưa chạy install/server. `.cmd` tránh vấn đề PowerShell chặn npm.ps1, không cần đổi ExecutionPolicy.

Trong PowerShell, với Bun và dependency đã cài sẵn:

```powershell
cd C:\Users\Dat\Documents\GitHub\KL\frontend
bun run dev
```

Mở đúng URL terminal in ra. Thường là cổng 5173; nếu cổng bận Vite có thể chọn cổng khác. Không mặc định mở localhost:8000: cổng đó có thể đang phục vụ frontend đã build trong image cũ.

Để tự dùng đăng nhập/dữ liệu thật, backend cần đang chạy theo cấu hình sẵn có; không sửa env/proxy/CORS hoặc rebuild Docker trong nhiệm vụ giao diện này. Nếu Vite bị lỗi API/CORS, gửi log an toàn cho nhóm phụ trách; giao diện agent không tự đổi backend để né lỗi.

Không có dependency mới. Nếu thiếu node_modules/toolchain, dừng để kiểm tra môi trường trước; không chạy cài lại toàn bộ, upgrade package, xóa cache hoặc build no-cache mặc định.

## Kiểm tra build

```powershell
cd C:\Users\Dat\Documents\GitHub\KL\frontend
npm.cmd run build -- --outDir dist
```

Phải giữ `--outDir dist`: vite.config.ts hiện mặc định outDir sang `../backend/app/frontend` và emptyOutDir=true. Không chạy build mặc định vì sẽ ghi vào backend. Override CLI giữ output tại frontend/dist; không cập nhật bản Docker ở cổng 8000 và không xác nhận API/nghiệp vụ đúng. Agent chưa chạy lệnh này. Với npm dùng `npm.cmd run build --workspace frontend -- --outDir dist` từ root KL.

Script `bun run lint` hiện có `--write --unsafe`, không dùng để kiểm tra read-only. Nếu binary cục bộ đã có, có thể chạy Biome không ghi file trên đúng file cần xem, ví dụ:

```powershell
.\node_modules\.bin\biome.cmd check src\components\Common\PageHeading.tsx src\components\Common\WorkspaceHeader.tsx src\components\Common\ResultFigure.tsx
```

Không dùng npx/bunx để tự tải tool khi chưa có. Không auto-fix unsafe toàn repo. Một số file trước đó dùng định dạng dài/không đồng nhất; xử lý format có phạm vi, không thay logic.

## Bộ test UI dùng mock riêng

Giữ Vite chạy ở cửa sổ khác. Nếu Playwright và Chromium đã được cài sẵn:

```powershell
cd C:\Users\Dat\Documents\GitHub\KL\frontend
.\node_modules\.bin\playwright.cmd test --config=tests/ui-redesign.config.ts
```

Config này không chạy auth.setup, không khởi động server/Docker và không đọc dotenv. Mọi URL /api/ được mock/chặn; request ngoài origin Vite cũng bị chặn. Fixture và token đều synthetic. Không chạy `bun run test`/toàn bộ E2E mặc định nếu chỉ muốn kiểm tra UI: config cũ có setup đăng nhập và có thể dùng backend thật.

Nếu Vite dùng cổng khác, chỉ cấu hình URL cho lượt test này trong PowerShell:

```powershell
$env:PLAYWRIGHT_BASE_URL = 'http://localhost:5174'
.\node_modules\.bin\playwright.cmd test --config=tests/ui-redesign.config.ts
Remove-Item Env:\PLAYWRIGHT_BASE_URL
```

Không sửa file .env. Nếu thiếu browser test, ghi Blocked; không tự tải browser lớn. Agent chưa chạy test nên chưa có số lượng pass hay ảnh kiểm chứng.

## Tự xem giao diện

Theo checklist docs/testing/WEB_UI_REDESIGN_ACCEPTANCE.md: xem từng trang, theme sáng/tối, menu mobile, dialog, tên tệp dài, kết quả stdout/code và ảnh. Nút “Mở lớn biểu đồ” chỉ thay kích thước cùng ảnh; không chạy phân tích lại. Chỉ nhấn phân tích/dự báo thật khi bạn chủ động muốn sử dụng backend; việc xem thiết kế không cần phát sinh lượt Gemini.

Các vấn đề business logic được ghi ở cuối docs/WEB_UI_REDESIGN_REPORT.md, không được sửa trong tác vụ này. Không commit/push/merge hoặc deploy tự động.
