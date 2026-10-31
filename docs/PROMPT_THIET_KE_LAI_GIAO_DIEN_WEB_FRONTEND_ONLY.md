# Prompt thiết kế lại giao diện FinAI Web chỉ sửa frontend

Ngày đối chiếu: 31/10/2026. Đã đọc cấu trúc frontend của checkout KL hiện tại; chưa triển khai thay đổi giao diện trong lượt soạn prompt này.

Sao chép phần từ BẮT ĐẦU PROMPT đến KẾT THÚC PROMPT vào agent làm việc trong repository KL.

## BẮT ĐẦU PROMPT

Hãy trực tiếp thiết kế lại toàn bộ giao diện FinAI Web để sản phẩm sinh động, bắt mắt, chỉn chu và thân thiện với người dùng phổ thông. Giao diện hiện tại tạo cảm giác được ghép từ một mẫu dashboard AI: nhiều biểu tượng lấp lánh, tiêu đề kỹ thuật, màu nhấn lặp lại và các khối dày đặc. Cần thay đổi rõ rệt về trải nghiệm nhìn và thao tác, không chỉ đổi vài màu hoặc thêm gradient.

Đây là yêu cầu triển khai mã giao diện. Giữ tất cả chức năng thật đang có. Không dừng ở bản mô tả thiết kế hoặc ảnh mockup.

### 1. Phạm vi bất biến: tuyệt đối không đụng backend

Repository: `C:\Users\Dat\Documents\GitHub\KL`.

Chỉ được sửa lớp trình bày của frontend React và tạo tài liệu trong `docs/`:

- Có thể sửa JSX/TSX trình bày, CSS/Tailwind, theme tokens, component giao diện, bố cục, typography, icon, asset trang trí và nội dung hướng dẫn không làm đổi ý nghĩa nghiệp vụ.
- Không tạo/sửa/xóa/di chuyển bất kỳ file nào trong `backend/`, kể cả comment, import, test, uploads và script.
- Không sửa `.env` hoặc biến môi trường ở bất kỳ vị trí nào; không đọc/in secret, API key, mật khẩu hoặc token.
- Không sửa Dockerfile, Compose, volume, database, migration, cấu hình proxy, CORS, scripts khởi động/deploy, CI, dependency hoặc lockfile. Không chạy Docker hoặc build lại image.
- Không sửa `frontend/src/services/`, `frontend/src/client/`, `frontend/src/hooks/` hoặc mã client sinh tự động; giữ nguyên contract, endpoint, request/response, headers, token và cơ chế auth.
- Trong route/component có cả UI và xử lý dữ liệu, chỉ đổi phần trình bày và state UI cục bộ thật sự cần thiết. Giữ nguyên hàm submit, request payload, upload/download, useEffect gọi API, query keys, validation, parser, phép tính nghiệp vụ, thứ tự xử lý và side effect mạng.
- Không sửa `beforeLoad`, route path, auth guard, kiểm tra role/quyền; không regenerate router/client. Đổi nhãn menu không được đổi URL.
- Không bổ sung request hoặc tự gọi API khi hover, mở tooltip/dialog/ảnh, chuyển tab kết quả hay chạy animation. Nút gửi vẫn chỉ gửi đúng một yêu cầu khi người dùng chủ động xác nhận.
- State mới chỉ phục vụ giao diện như mở sidebar, accordion hoặc ảnh toàn màn hình. Không thêm state làm thay đổi lựa chọn dataset/cột, reset kết quả hoặc phát sinh request ngoài ý muốn. Không remount component phân tích bằng key thay đổi khi trang trí UI.
- Không tự sửa lỗi backend hay frontend business logic được phát hiện. Ghi dependency rõ trong báo cáo, giữ nguyên hành vi và không che lỗi bằng số liệu/màu thành công giả.
- Không sửa Flutter trong nhiệm vụ này.

Nếu một yêu cầu thiết kế cần sửa backend, giữ phần đó nguyên trạng và báo rõ giới hạn. Không coi yêu cầu làm đẹp là quyền thay đổi nghiệp vụ.

### 2. Bảo toàn công việc và cách thực hiện

Đọc `AGENTS.md` áp dụng, kiểm tra `git status` và diff trước khi sửa. Ghi nhận những file đã thay đổi sẵn; không ghi đè công việc của người dùng. Nhánh quan sát khi soạn là `tri`, nhưng phải kiểm tra lại; không tự switch/tạo nhánh, commit, push, merge hoặc PR.

Được đọc source để xác nhận binding và hành vi cần giữ. Không cần chạy backend để làm giao diện. Không tự đăng nhập tài khoản thật, gọi API live/Gemini hoặc thực hiện upload, phân tích, dự báo, xóa dữ liệu để thử.

Theo lựa chọn của người dùng, lượt này chỉ sửa source, viết test phù hợp và hướng dẫn tự chạy. Không tự chạy dev server, cài package, test, build, browser/emulator hoặc Docker. Không tải thêm font, chart library, icon library, ảnh stock hay dependency lớn. Tái sử dụng thư viện đã có. Không tạo screenshot/log/biên bản Pass giả.

Mọi Markdown, prompt, kế hoạch, báo cáo, checklist, bằng chứng mới phải nằm trong `docs/` của KL. Mã giao diện và test đặt đúng cấu trúc frontend. Không tạo README/PLAN/REPORT ở root.

### 3. Nền tảng và các file phải đọc

Frontend hiện dùng React/TypeScript, Tailwind CSS, Radix UI, TanStack Router/Query/Table, React Hook Form/Zod, Lucide, Sonner. Giữ các nền tảng này; không chuyển framework hoặc viết lại app từ đầu.

Đọc tối thiểu:

- `frontend/src/index.css`, `frontend/src/components/theme-provider.tsx`.
- `frontend/src/routes/_layout.tsx`, `frontend/src/routes/__root.tsx`.
- `frontend/src/components/Sidebar/{AppSidebar,Main,User}.tsx`.
- `frontend/src/components/Common/{Logo,Footer,AuthLayout,DataTable,Appearance,ErrorComponent,NotFound}.tsx`.
- `frontend/src/routes/_layout/{index,datasets,forecast,history,admin,settings,items}.tsx` và route auth hiện có.
- `frontend/src/components/DataAnalyzer.tsx`.
- `frontend/src/components/Datasets/{DatasetPreviewModal,UploadDatasetDialog}.tsx`.
- Component Admin, UserSettings và `frontend/src/components/ui/` có liên quan.
- `frontend/package.json`, cấu hình TypeScript/Biome và test frontend hiện có.

Kiểm kê các màn hình/nhánh UI thật trước khi sửa. Trang forecast hiện có cả dự báo và phân tích định lượng/clustering: giữ nguyên các tab, control, response binding và tính năng đang có. Route template `items` nếu đang được sử dụng vẫn phải hoạt động; không thêm nó vào navigation mới chỉ để lấp chỗ trống.

### 4. Hướng thiết kế cần theo

Thiết kế như một sản phẩm quản lý dữ liệu doanh nghiệp dễ sử dụng, có cá tính, không giống trang quảng cáo AI hoặc terminal của lập trình viên.

Định hướng cụ thể:

- Light mode chủ đạo: nền giấy xám ấm rất nhạt, bề mặt trắng, chữ mực xanh đậm, màu xanh ngọc làm nhận diện. Có thể tham khảo nền `#F7F8FA`, chữ `#183044`, primary `#0F766E`. Đây là điểm khởi đầu; kiểm tra tương phản khi chọn màu chữ/nền cụ thể.
- Dùng hổ phách hoặc san hô làm điểm nhấn nhỏ ở lời hướng dẫn hoặc empty state. Không dùng một màu cho mọi thẻ; cũng không mỗi thẻ một màu bão hòa.
- Giảm tím/xanh neon, nền gradient lớn, glow, icon Sparkles/Brain/robot lặp lại, badge “AI powered”, chữ IN HOA dày đặc và câu quảng cáo phóng đại. Giữ tên FinAI, không xóa bản sắc hoặc nguồn bản quyền hiện có.
- Typography rõ cấp bậc: tiêu đề vừa phải, nội dung dễ đọc, nhãn nhỏ nhưng đủ tương phản. Dùng font hiện có hoặc system stack hỗ trợ tiếng Việt; không cần tải Google Fonts mới.
- Khoảng cách có nhịp, căn hàng/cột gọn, bo góc khoảng 12–20 px, viền nhẹ; bóng chỉ ở lớp nổi cần thiết. Không bọc mọi dòng trong card và không lồng quá nhiều card.
- Có thể dùng hình khối SVG/CSS nhỏ trong empty state hoặc phần chào; không dùng số liệu/đồ thị tài chính trang trí dễ bị hiểu là kết quả thật.
- Chuyển động ngắn, nhẹ ở hover/focus/dialog; tôn trọng `prefers-reduced-motion`. Không hiệu ứng gõ chữ giả, loading stage giả, skeleton chạy vô hạn khi đã có lỗi hoặc delay giả.
- Giữ dark mode đang có và thiết kế token sáng/tối tương ứng. Không ép đổi theme của người dùng về light mỗi lần mở trang.

Tạo một hệ thống token/component dùng chung để mọi trang thống nhất. Không dùng một vài đoạn CSS global mạnh tay làm hỏng dialog, Radix focus, bảng hoặc trạng thái disabled.

### 5. Bố cục và yêu cầu từng màn hình

**Khung ứng dụng:** sidebar gọn, nhóm navigation hợp lý, trạng thái active rõ ngoài màu, thu gọn desktop và drawer mobile. Header có tên trang/ngữ cảnh hoặc breadcrumb phù hợp; không để một dải trống chỉ có nút menu. Khu tài khoản và đổi theme dễ tìm. Giữ menu Admin theo quyền hiện có. Bỏ link mạng xã hội/trang trí vô nghĩa nếu chỉ là placeholder; không bỏ link chức năng đang dùng.

**Đăng nhập và các trang auth đang tồn tại:** thiết kế chào đón, gọn, form rõ, label thật, show/hide password có tên truy cập, validation/error dễ đọc, submit có trạng thái đang xử lý. Trên desktop có thể có một mảng giới thiệu vừa phải; mobile ưu tiên form. Không thêm tài khoản demo, auto-login, social login, OTP hay nút thành công giả. Không thay đổi luồng đăng ký/quên/đổi mật khẩu hiện có.

**Tổng quan:** lời chào ngắn, thông tin có ích, thao tác chính đi vào phân tích/kho dữ liệu. Giữ số liệu lấy từ nguồn thật và cách tính hiện tại; không tự thêm doanh thu/lợi nhuận/phần trăm tăng trưởng. Nếu thấy chỉ số đang có cách tính thiếu căn cứ như schema lỗi lại mặc định sức khỏe 100%, không sửa công thức trong nhiệm vụ UI: ghi rõ trong dependency và không đổi nhãn thành “đã kiểm chứng”. Không tạo thêm request để làm đầy dashboard.

**Phân tích dữ liệu / DataAnalyzer:** giữ đủ mọi nguồn dữ liệu và chế độ hiện có. Sắp xếp rõ: nguồn dữ liệu → chọn cột → câu hỏi → kết quả. Mỗi bước có tiêu đề ngắn và chỉ dẫn đúng mức. Dataset đang chọn phải dễ nhận biết; không đổi tên cột hoặc giá trị scope. Tối ưu danh sách chip dài, thao tác chọn tất cả và ô câu hỏi. Gợi ý câu hỏi giữ nguyên nội dung gửi hiện có; không tự gửi khi click để xem thiết kế.

Kết quả tách rõ diễn giải/số liệu, ảnh và Python/chi tiết kỹ thuật. Mã để trong vùng có thể mở; không che trạng thái lỗi. Bảng/stdout/code có cuộn ngang cục bộ và copy khi chức năng đó đã có; không dùng CSS làm mất hàng/cột. Biểu đồ giữ nguyên ảnh/nguồn server trả, đúng tỷ lệ, có thể mở lớn bằng state UI local. Không vẽ lại, recolor, crop mất trục/chú giải hoặc nội suy số liệu của ảnh backend.

**Kho dữ liệu:** toolbar rõ, nút upload nổi bật, danh sách/bảng dễ quét với tên, định dạng, dòng/cột, phiên bản và trạng thái thật. Có thể đổi cách trình bày mobile thành thẻ nếu dùng cùng nguồn dữ liệu và handler. Giữ search/filter/pagination/sort hiện có, không tự đổi từ server-side sang client-side. Dialog upload có vùng chọn file thân thiện nhưng giữ extension, size, validation và multipart hiện có. Preview/schema dùng không gian hợp lý, tên cột dài xuống dòng, bảng cuộn riêng.

Dataset thiếu file/không có quyền/phân tích lỗi vẫn phải hiển thị đúng. Không đổi badge lỗi thành màu xanh hoặc bật nút đang bị khóa. Không bổ sung request download để kiểm tra file khi render danh sách.

**Dự báo và các tab định lượng hiện có:** nhóm form dữ liệu/cột/kỳ/mô hình rõ ràng, giữ enum/giới hạn/request chính xác. Bảng, ảnh và metrics dễ đọc; không đổi nhãn fitted thành kiểm thử ngoài mẫu hoặc biến null thành 0. Không thêm ý nghĩa “đảm bảo 95%”, “chính xác tuyệt đối” hay nhãn giải thích trái với source. Nếu thiếu mô tả metric, ghi đề nghị riêng; UI không tự thay thuật toán.

**Lịch sử và giám sát:** filter, bảng/list, badge trạng thái, thời gian và detail dễ sử dụng. Giữ search, pagination, xem/copy/tải/xóa và dialog xác nhận hiện có. Không gọi lại phân tích khi mở lịch sử. Giữ đúng đơn vị; không quảng bá memory cố định thành đo RAM thật.

**Quản trị, cài đặt, form thêm/sửa/xóa:** đồng bộ cùng hệ thiết kế. Giữ trường, validation, quyền và handler. Nút nguy hiểm phải phân biệt; giữ bước xác nhận đang có, không di chuyển nút xóa sát nút chính dễ bấm nhầm. Không thêm popup xác nhận cho mọi thao tác bình thường.

**Loading/empty/error/404:** thiết kế đầy đủ bằng nội dung tiếng Việt ngắn, icon vừa đủ và thao tác thật. Có dữ liệu rỗng thì hướng dẫn bước tiếp theo; có lỗi thì giữ thông báo an toàn đang có, không đổi thành “chưa có dữ liệu”. Không giả progress hoặc trạng thái nội bộ Gemini/sandbox.

### 6. Khả năng sử dụng và responsive

- Thiết kế cho 360/390/768/1024/1440 px. Không tràn ngang toàn trang; chỉ bảng/code/chart có vùng cuộn hoặc zoom riêng.
- Form, dialog/sheet có scroll và giới hạn chiều cao theo viewport. Bàn phím trên mobile không che nút cuối; không dùng chiều cao cứng khiến mất nội dung.
- Click target đủ lớn, focus bàn phím rõ, tab order hợp lý, label/aria cho nút icon, dialog giữ focus/đóng bằng Escape đúng Radix.
- Không truyền trạng thái chỉ bằng màu; có chữ/icon. Đảm bảo disabled/loading thật sự không bấm được và không vô tình submit form từ nút phụ.
- Không dùng `dangerouslySetInnerHTML` để làm đẹp stdout/Markdown hoặc render dữ liệu chưa tin cậy. Giữ cơ chế escape hiện có, không đưa secret/traceback nhạy cảm ra UI.
- Dùng tiếng Việt tự nhiên: “Chọn dữ liệu”, “Đặt câu hỏi”, “Xem kết quả”. Không rải thuật ngữ kỹ thuật ở các bước người dùng không cần biết.
- Tôn trọng chữ lớn/zoom 200%, dark mode và giảm chuyển động. Chưa đo tương phản/kiểm thử thì không ghi đã đạt WCAG.

### 7. Trình tự triển khai

1. Kiểm tra Git, kiểm kê trang/component/handler cần bảo toàn. Xác định token màu/typography/spacing dùng chung.
2. Làm theme và shell trước, rồi auth và tổng quan.
3. Làm kho dữ liệu và toàn bộ luồng phân tích, tiếp theo forecast/history và admin/settings/dialog/error.
4. Rà responsive và trạng thái thật; kiểm tra source để bảo đảm không thay URL, handler, request, guard, parser hoặc công thức. Không sửa business logic để tiện chia component.
5. Viết/chỉnh test UI mock có giá trị khi cấu trúc DOM thay đổi; giữ assertion quyền, disabled, lỗi, payload và chống request lặp. Không xóa test/ẩn lỗi TypeScript để bàn giao.
6. Rà diff cuối để xác nhận backend, services/hooks/client, env, Docker và dependency không bị thay đổi bởi lượt này. Dirty file có sẵn của người khác phải được ghi tách biệt.

Không cần xin duyệt từng màu/nút nhỏ. Tự đưa ra lựa chọn nhất quán, hoàn thành bản UI có thể review qua source và hướng dẫn người dùng tự chạy.

### 8. Bàn giao và giới hạn kiểm chứng

Tạo/cập nhật:

- `docs/WEB_UI_REDESIGN_REPORT.md`: lý do thiết kế, màn hình đã sửa, file thay đổi, phần giữ nguyên, dependency nghiệp vụ phát hiện, trạng thái chưa chạy.
- `docs/testing/WEB_UI_REDESIGN_ACCEPTANCE.md`: checklist từng trang, viewport, theme, bàn phím, loading/empty/error và bảo toàn chức năng. Ghi “Chưa chạy” cho kiểm tra chưa thực hiện.
- `docs/WEB_UI_REDESIGN_RUN_GUIDE.md`: hướng dẫn tự chạy bằng tool/package manager sẵn có, không tải dependency/Docker image mặc định.

Không tạo screenshot trước/sau giả. Nếu người dùng tự chạy và cung cấp ảnh sau đó, mới ghi bằng chứng tương ứng vào `docs/evidence/web-ui/`.

Đọc package.json trước khi đưa lệnh. Source lúc soạn có script `lint` dùng `biome check --write --unsafe`, vì vậy không khuyên chạy script này toàn repo để kiểm tra đơn thuần. Đưa lệnh Biome read-only nếu binary hiện có, và build frontend khi người dùng muốn xác minh; không khuyên tự động sửa unsafe.

Ví dụ người dùng tự chạy, chỉ khi dependency đã có sẵn và máy đang dùng Bun:

```powershell
cd C:\Users\Dat\Documents\GitHub\KL\frontend
bun run dev
```

Mở URL Vite thực sự in trong terminal, không mặc định đó là localhost:8000. Bản giao diện ở cổng 8000 có thể thuộc image Docker cũ, nên không kết luận sửa chưa có tác dụng chỉ vì xem nhầm bản đang phục vụ. Không rebuild backend/image trong nhiệm vụ này. Backend đang chạy được dùng cho người dùng kiểm tra sau; frontend agent không tự thao tác dữ liệu thật.

Lệnh xác minh người dùng có thể tự chạy, theo package hiện tại:

```powershell
bun run build
```

Không tự chạy theo giới hạn đã nêu. Unit/visual test phải dùng mock; không tự chạy E2E đang gọi backend hoặc Gemini thật.

Trả lời cuối bằng tiếng Việt: mô tả diện mạo mới, màn hình/file đã sửa, chỉ rõ chỉ sửa frontend, phần nào chưa chạy kiểm tra và cách tự mở đúng bản mới. Không tuyên bố backend được sửa hoặc mọi luồng đã pass chỉ vì viết xong JSX.

## KẾT THÚC PROMPT
