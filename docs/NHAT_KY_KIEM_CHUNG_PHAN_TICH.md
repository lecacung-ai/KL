# Nhật ký kiểm chứng phân tích dữ liệu

Ngày bắt đầu: 01/11/2026. Chỉ ghi thành công khi kết quả đã đối chiếu nguồn. Việc Python chạy được hoặc có ảnh không chứng minh phân tích đúng.

## Nguồn đối chiếu

Workbook người dùng cung cấp: `D:\a2494a8cdf834a4eac7a2be08ea1b969_Mẫu Theo Dõi Tài Chính.xlsx`, sheet `Sheet1`. Đã đọc giá trị lưu trong workbook ở lượt đối chiếu trước, không chỉnh sửa workbook. Header tại dòng 1; tháng 1–12 tại D:O.

- Thu: A2, tổng năm C2 = 340.000.000; D2 = 45.000.000. Chi tiết tháng 1: lương D3 = 25.000.000, thưởng D4 = 20.000.000.
- Chi tiêu: A6, đơn vị B6 = VNĐ, tổng năm C6 = 203.500.000.
- D6:O6 = 24.500.000; 14.000.000; 14.000.000; 17.500.000; 18.000.000; 17.000.000; 14.000.000; 14.000.000; 21.000.000; 16.000.000; 19.000.000; 14.500.000.
- Dòng 7 có đơn vị `%`: tỷ lệ chi tiêu trên thu, không phải số tiền hoặc thành phần được cộng vào chi tiêu. D7 xấp xỉ 0,5444444444 = 24.500.000 / 45.000.000.

## Ca 01 — Cộng toàn bộ dòng thành doanh thu tháng

Trạng thái: Fail, chưa sửa và chưa chạy lại để nghiệm thu.

Quan sát từ ảnh người dùng: biểu đồ “Tổng Doanh Thu Theo 12 Tháng” cho tháng 1 hơn 200 triệu, trong khi tổng Thu D2 chỉ 45 triệu. Người dùng xác nhận mã cộng toàn bộ dòng. Chưa lưu mã Python của lượt đó nên chưa khẳng định câu lệnh cụ thể.

Nguyên nhân nghiệp vụ: trộn dòng tổng, chi tiết, thu, chi và tỷ lệ; đếm trùng nếu cộng tổng Thu với lương/thưởng. Cách xử lý đề xuất: nhận diện vai trò dòng và đơn vị, chọn dòng tổng hoặc chi tiết theo một quy tắc rõ ràng, không cộng cả hai. Không áp dụng quy tắc vị trí dòng cố định cho mọi file.

## Ca 02 — Yêu cầu Chi tiêu nhưng dùng dữ liệu Thu

Yêu cầu nguyên văn người dùng: “vẽ biểu đồ tròn Chi tiêu: dòng Chi tiêu. Thời gian: Tháng 1–12. Không cộng các dòng % vì đã nằm trong chi tiêu”.

Trạng thái: Fail, chưa sửa backend và chưa kiểm thử lại.

Bằng chứng: ảnh người dùng gửi ngày 01/11/2026. Output ghi “Dữ liệu chi tiêu từng tháng” nhưng tháng 1 và 4 là 45 triệu, các tháng khác 25 triệu; tổng “chi tiêu” là 340 triệu. Đây là dãy Thu tại D2:O2, không phải Chi tiêu tại D6:O6. Việc chọn sai chỉ tiêu đã được xác nhận từ số liệu; chưa có mã Python/response của lượt này để xác nhận cơ chế chọn sai (vị trí dòng, fallback hay mapping).

Kỳ vọng: lấy duy nhất dòng A6 có nhãn Chi tiêu và B6 là VNĐ; 12 tháng lấy D6:O6; tổng 203,5 triệu. Tháng 1 chiếm khoảng 12,04% tổng chi tiêu năm. Không dùng C6 như một lát bổ sung, không lấy dòng Thu và không cộng các dòng phần trăm hoặc tổng nhóm bên dưới.

Cách xử lý đề xuất:

1. Lập kế hoạch phân tích thể hiện chỉ tiêu yêu cầu, dòng/cột nguồn, đơn vị, phép tổng hợp và loại biểu đồ trước khi thực thi.
2. Tìm nhãn chỉ tiêu bằng tên/ý nghĩa cột và đơn vị; file này có chữ Chi tiêu ở cả A6 và B10, nên không tìm từ khóa trên toàn bảng rồi lấy kết quả đầu tiên tùy ý.
3. Không xác định duy nhất được nguồn thì báo cần người dùng xác nhận; không fallback sang dòng đầu hoặc sang Thu.
4. Kiểm tra sự nhất quán giữa kế hoạch, nhãn kết quả và dữ liệu nguồn bằng kiểm tra xác định; không chỉ hỏi lại LLM xem kết quả đúng hay không.
5. Đối chiếu tổng và điểm đại diện: tháng 1 = 24,5 triệu, tháng 4 = 17,5 triệu, tổng = 203,5 triệu. Kiểm tra tổng đúng thôi chưa đủ nếu phân bổ tháng bị sai.
6. Phần trăm trên biểu đồ tròn phải được tính từ các giá trị Chi tiêu đã chọn; khác với tỷ lệ chi/thu ở dòng 7.

## Quy tắc cập nhật các lượt sau

### Bản cải thiện backend — 01/11/2026

Được người dùng yêu cầu trực tiếp triển khai sau khi xác nhận nguyên nhân ca 02.

Các thay đổi:

- `backend/app/services/analysis_prompt.py`: tách xây dựng ngữ cảnh và prompt thành hàm có thể kiểm thử. Bảng không quá 40 dòng được lấy đầy đủ nếu nằm trong giới hạn 40 cột/24.000 ký tự; bảng lớn lấy đầu/cuối và tối đa 20 vị trí có nhãn liên quan câu hỏi. Tìm nhãn có giới hạn 10.000 dòng đầu/40 cột để tránh chi phí không giới hạn; không coi kết quả tìm này là quyết định chọn nguồn. Ngữ cảnh có dtype, số dòng/cột và cờ mẫu bị cắt, có cắt chuỗi ô. Chỉ gửi cột thuộc phạm vi lựa chọn.
- Prompt bỏ khẳng định dữ liệu đã chuẩn hóa nghiệp vụ; yêu cầu kiểm tra nguồn, chọn bằng nhãn/đơn vị, không đoán vị trí hoặc cộng tổng–chi tiết, phân biệt tỷ lệ/tiền và kỳ báo cáo, không tự thay ô lỗi thành 0. Mã phải in nguồn và bảng giá trị trước khi vẽ. Thiếu nguồn phải báo cần xác nhận.
- Prompt sửa mã giữ nguyên prompt gốc (câu hỏi, phạm vi, ngữ cảnh, quy tắc), thêm mã lần trước và lỗi có giới hạn. Không nhận lượt sửa chỉ vì có ảnh nếu sandbox vẫn thất bại.
- `ai_analysis_service.py`: dùng các hàm trên, lịch sử giữ `idle` thay vì đổi sang `success`; message không khẳng định xử lý thành công khi chưa thực thi. Thêm trường `validation_status`: `unverified` khi thực thi thành công, `not_run` khi chưa thành công. Không thay đổi execution_status cũ hoặc schema database.

Kiểm tra thực sự đã chạy: `python -m unittest discover -s tests/services -p test_analysis_prompt.py` trong backend. Kết quả: 4 test pass, offline, không DB/Gemini/Docker. Bao phủ dòng Chi tiêu nằm ngoài 5 dòng đầu, nhãn ở giữa bảng lớn/đổi vị trí, giới hạn context và phạm vi cột, ngữ cảnh sửa mã. `git diff --check` không báo lỗi whitespace.

Giới hạn: các test này chứng minh xây dựng prompt/context, chưa chứng minh AI sinh đúng mã hoặc số liệu workbook thực tế. Chưa gọi Gemini và chưa nghiệm thu ca 01/02; cả hai vẫn Fail/chờ chạy lại. Chưa có bộ phân tích kế hoạch và kiểm chứng nghiệp vụ xác định phía server. Frontend hiện chưa hiển thị validation_status; cần nhiệm vụ tích hợp riêng nếu muốn hiển thị trạng thái mới. Cơ chế trả lỗi/ghi history khi provider thất bại còn cần cải thiện thêm, không coi bản này hoàn tất toàn bộ luồng AI.

Để kiểm tra trên ứng dụng: dịch vụ được bind mount từ source trong Compose development hiện tại; kiểm tra server đã reload trước khi gửi một yêu cầu AI có chủ đích. Không build lại image hoặc đổi env cho thay đổi Python này. Dùng câu hỏi ca 02 và đối chiếu D6:O6 cùng tổng 203,5 triệu; lưu mã sinh ra và output thật vào ca tương ứng trước khi chuyển trạng thái Pass.

### Bổ sung bằng chứng mã Python cho ca 02 — 01/11/2026

Người dùng đã cung cấp mã thực tế. Nguyên nhân xác nhận: mã gán `row_idx = 0`, sau đó lấy `df.loc[row_idx, months]`. Với `pd.read_excel` mặc định và file này, index 0 là dòng Excel 2, nhãn Thu; dòng Chi tiêu ở Excel 6 tương ứng index 4. Mã không tìm nhãn Chi tiêu hoặc kiểm tra đơn vị trước khi lấy số liệu. Các chuỗi in và tiêu đề gắn chữ Chi tiêu lên dãy Thu, tạo kết quả sai dù thực thi thành công.

Vấn đề bổ sung: `errors='coerce').fillna(0)` che dữ liệu không hợp lệ; lọc `> 0` tự loại giá trị âm mà không giải thích. Sửa đề xuất: chọn duy nhất nhãn Chi tiêu ở cột đầu và đơn vị VNĐ ở cột thứ hai, kiểm tra đủ 12 tháng và số hợp lệ, dừng nếu âm/thiếu hoặc có nhiều dòng khớp. Chưa triển khai vào backend và chưa chạy lại. Ca 02 vẫn Fail.

Mỗi ca ghi: ngày, phiên bản/nhánh nếu xác minh được, file/sheet, câu hỏi nguyên văn, phạm vi chọn, output thực nhận, số liệu kỳ vọng, mã Python hoặc bằng chứng khi có, nguyên nhân đã xác nhận so với giả thuyết, cách sửa, kiểm thử đã chạy, kết quả và hạn chế.

- Chưa chạy / Fail / Pass / Blocked phải phân biệt rõ.
- Không ghi Pass chỉ vì đổi prompt, viết xong mã hoặc sandbox chạy thành công.
- Không gọi Gemini thật hoặc sửa backend chỉ để ghi nhật ký; cần yêu cầu triển khai/kiểm thử tương ứng.
- Không lưu key, token, mật khẩu hoặc dữ liệu cá nhân không cần thiết. Mọi tài liệu và bằng chứng mới đặt trong docs/.
- Nhật ký hiện chỉ gồm các ca có thông tin trong trao đổi này, không tuyên bố bao phủ mọi lượt phân tích đã diễn ra.
