"""Script tự động hóa Thực nghiệm Đối sánh 5 Phiên bản Prompt Trực quan hóa Biểu đồ
(Chart Visualization Prompt Ablation Benchmark)
cho Khóa Luận Tốt Nghiệp: Trợ Lý AI Phân Tích Dữ Liệu Doanh Nghiệp (FinAI).

Nội dung:
- 5 phiên bản Prompt đều là PROMPT VẼ BIỂU ĐỒ (P1 -> P5) với mức độ ràng buộc tăng dần.
- Đánh giá khả năng sinh mã Python vẽ biểu đồ (Matplotlib/Seaborn) thực thi được trong Sandbox.
- Bắt lỗi: Treo GUI (plt.show), Sai tên cột (KeyError), Thiếu ảnh (Missing Chart), Thư viện cấm.
- Xuất báo cáo Excel 2 sheet: Tổng hợp Chương 5 + Chi tiết thực nghiệm đánh nhãn.
"""

import asyncio
import os
import sys
import time
import glob
from pathlib import Path
import pandas as pd

# Nạp các module cốt lõi của dự án
sys.path.append(str(Path(__file__).parent.parent))
from app.core.config import settings
from app.core.sandbox import execute_in_sandbox, clean_python_code
from app.services.ai_analysis_service import AiAnalysisService
from app.services.dataframe_service import dataframe_service

# ==============================================================================
# 1. ĐỊNH NGHĨA 5 PHIÊN BẢN PROMPT THEO 5 CHIẾN LƯỢC KHOA HỌC KHÁC NHAU
# ==============================================================================

def build_prompt_1_zeroshot(query: str, df: pd.DataFrame) -> str:
    """Chiến lược 1: Zero-Shot Direct - Tiếp cận trực diện cơ bản, không hướng dẫn, không ví dụ."""
    cols_str = ", ".join([str(c) for c in df.columns])
    return f"""Dữ liệu được nạp trong biến DataFrame `df` với các cột: {cols_str}.
Hãy viết mã nguồn Python để vẽ biểu đồ cho yêu cầu sau:
"{query}"

Chỉ trả về mã nguồn Python."""


def build_prompt_2_fewshot(query: str, df: pd.DataFrame) -> str:
    """Chiến lược 2: Few-Shot Demonstration - Tiếp cận bằng việc cung cấp ví dụ mẫu chuẩn (In-Context Learning)."""
    cols_str = ", ".join([str(c) for c in df.columns])
    sample_str = df.head(2).to_string()
    return f"""Dưới đây là một ví dụ mẫu chuẩn về cách viết mã Python vẽ biểu đồ trên máy chủ:

[VÍ DỤ MẪU]
Yêu cầu: "Vẽ biểu đồ phân bố doanh số theo chi nhánh"
Mã nguồn mẫu:
```python
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

# Xử lý tổng hợp số liệu
sub_df = df.groupby('Chi_Nhanh')['Doanh_So'].sum().reset_index()
sub_df = sub_df.sort_values(by='Doanh_So', ascending=False).head(10)

# Trực quan hóa
plt.figure(figsize=(10, 5))
plt.bar(sub_df['Chi_Nhanh'], sub_df['Doanh_So'], color='royalblue')
plt.title('Top 10 Chi nhánh có Doanh số cao nhất')
plt.xticks(rotation=45, ha='right')
plt.tight_layout()
plt.savefig('output.png')
plt.close()
```

[BÀI TOÁN CẦN XỬ LÝ]
Bảng dữ liệu `df` của người dùng có các cột: {cols_str}
Dữ liệu mẫu:
{sample_str}

Hãy học theo cấu trúc và phong cách của ví dụ mẫu trên để viết mã Python vẽ biểu đồ cho yêu cầu:
"{query}" """


def build_prompt_3_cot(query: str, df: pd.DataFrame) -> str:
    """Chiến lược 3: Chain-of-Thought (CoT) - Tiếp cận ép mô hình suy luận từng bước (Step-by-step reasoning)."""
    cols_str = ", ".join([str(c) for c in df.columns])
    sample_str = df.head(2).to_string()
    return f"""Bảng dữ liệu `df` có các cột: {cols_str}
Mẫu dữ liệu:
{sample_str}

Hãy thực hiện suy luận từng bước (Chain-of-Thought) để tạo mã Python vẽ biểu đồ cho yêu cầu: "{query}"

QUY TRÌNH SUY LUẬN TỪNG BƯỚC BẮT BUỘC:
- Bước 1 (Phân tích cột): Xác định cột nào phù hợp nhất làm trục hoành (trục X - danh mục) và cột nào làm trục tung (trục Y - giá trị số).
- Bước 2 (Làm sạch số liệu): Kiểm tra ô trống và ép kiểu dữ liệu cột trục Y về dạng số (`pd.to_numeric`).
- Bước 3 (Lựa chọn biểu đồ & Bố cục): Chọn loại biểu đồ trực quan nhất (cột/đường), giới hạn Top 10 để tránh đè chữ.
- Bước 4 (Sinh mã thực thi): Viết mã Python hoàn chỉnh, sử dụng backend `matplotlib.use('Agg')` và lưu file `plt.savefig('output.png')`.

Hãy tư duy và trả về mã nguồn Python theo quy trình trên."""


def build_prompt_4_persona(query: str, df: pd.DataFrame) -> str:
    """Chiến lược 4: Role-Based Persona - Tiếp cận định hình nhân cách Chuyên gia BI & Data Storytelling."""
    cols_str = ", ".join([str(c) for c in df.columns])
    sample_str = df.head(2).to_string()
    return f"""Bạn là một Chuyên gia Cao cấp về Trực quan hóa Dữ liệu Doanh nghiệp (Senior Business Intelligence & Data Storytelling Specialist).
Mục tiêu của bạn là tạo ra một biểu đồ trực quan, thẩm mỹ, có độ tương phản cao và truyền tải rõ ràng thông điệp số liệu kinh doanh cho Ban Giám Đốc.

Ngữ cảnh dữ liệu: Biến `df` có các cột: {cols_str}
Mẫu dữ liệu:
{sample_str}

Yêu cầu của Giám đốc: "{query}"

Với tư cách là chuyên gia BI, hãy thiết kế một biểu đồ chuyên nghiệp bằng Python với phong cách chuẩn báo cáo quản trị:
- Màu sắc trang nhã, phân biệt rõ các nhóm dữ liệu.
- Có tiêu đề giàu tính thông tin, ghi rõ đơn vị tiền tệ/số lượng trên nhãn các trục.
- Bố cục gọn gàng, dùng `matplotlib.use('Agg')`, lưu biểu đồ thành công vào tệp ảnh `output.png` để đưa vào slide báo cáo."""


def build_prompt_5_guardrails(query: str, df: pd.DataFrame) -> str:
    """Chiến lược 5: Constraint-Driven Guardrails - Tiếp cận bằng hệ thống luật và ràng buộc kỹ thuật nghiêm ngặt."""
    cols_str = ", ".join([str(c) for c in df.columns])
    sample_str = df.head(2).to_string()
    return f"""HỆ THỐNG KIỂM SOÁT THỰC THI MÃ TỰ ĐỘNG - PYTHON SANDBOX GUARDRAILS
Đầu vào: DataFrame `df` gồm các cột: {cols_str}
Dữ liệu mẫu:
{sample_str}

MÃ NGUỒN CỦA BẠN PHẢI TUÂN THỦ TUYỆT ĐỐI HỆ THỐNG 5 ĐIỀU LUẬT SAU:
[ĐIỀU LUẬT 1 - BẢO MẬT]: Chỉ được dùng `pandas`, `numpy`, `matplotlib`, `seaborn`. CẤM MỌI THƯ VIỆN KHÁC.
[ĐIỀU LUẬT 2 - HEADLESS]: Bắt buộc dùng `matplotlib.use('Agg')` ngay dòng đầu tiên. CẤM gọi `plt.show()`.
[ĐIỀU LUẬT 3 - TÍNH TOÀN VẸN DỮ LIỆU]: Luôn ép kiểu `pd.to_numeric(..., errors='coerce')` trước khi vẽ để tránh crash do lỗi kiểu dữ liệu chuỗi.
[ĐIỀU LUẬT 4 - ĐẦU RA ẢNH]: Bắt buộc lưu biểu đồ bằng `plt.savefig('output.png', bbox_inches='tight')` và giải phóng bộ nhớ `plt.close('all')`.
[ĐIỀU LUẬT 5 - ĐỊNH DẠNG]: CHỈ trả về đúng 1 khối mã duy nhất nằm trong ```python ... ```, không có bất kỳ văn bản giải thích nào ngoài khối mã.

Yêu cầu thực thi: "{query}" """


PROMPT_BUILDERS = [
    ("P1", "P1: Zero-Shot (Trực diện)", build_prompt_1_zeroshot),
    ("P2", "P2: Few-Shot (Học qua ví dụ mẫu)", build_prompt_2_fewshot),
    ("P3", "P3: Chain-of-Thought (Suy luận từng bước)", build_prompt_3_cot),
    ("P4", "P4: Role-Based (Chuyên gia BI & Storytelling)", build_prompt_4_persona),
    ("P5", "P5: Guardrails (Ràng buộc luật kỹ thuật)", build_prompt_5_guardrails),
]

# Các câu hỏi nghiệp vụ tiêu chuẩn về trực quan hóa biểu đồ
BENCHMARK_QUERIES = [
    "Vẽ biểu đồ cột (Bar chart) thể hiện Top 10 đối tượng có giá trị (doanh thu/tiền/số lượng) cao nhất và ghi rõ nhãn trên các cột",
    "Vẽ biểu đồ xu hướng (Line chart hoặc Bar chart) phân bố các khoản giá trị theo thời gian hoặc danh mục trong bảng dữ liệu",
]


# ==============================================================================
# 2. HÀM SAO LƯU EXCEL CHECKPOINT
# ==============================================================================

def _save_excel_file(results_data: list, output_excel: str):
    if not results_data:
        return None, None
    df_results = pd.DataFrame(results_data)
    summary_rows = []
    for p_code, p_name, _ in PROMPT_BUILDERS:
        sub = df_results[df_results["Mã_Prompt"] == p_code]
        total = len(sub)
        success_cnt = len(sub[sub["Trạng_Thái_Sandbox"] == "Thành công (Đã tạo ảnh biểu đồ)"])
        timeout_cnt = len(sub[sub["Loại_Lỗi"].str.contains("Timeout", na=False)])
        key_err_cnt = len(sub[sub["Loại_Lỗi"].str.contains("KeyError", na=False)])
        missing_chart_cnt = len(sub[sub["Loại_Lỗi"].str.contains("Missing_Chart", na=False)])
        sec_err_cnt = len(sub[sub["Loại_Lỗi"].str.contains("Security|Module", na=False)])
        avg_llm_time = round(sub["Thời_Gian_LLM_ms"].mean() / 1000, 2) if total > 0 else 0

        success_rate = f"{(success_cnt / total * 100):.1f}%" if total > 0 else "0%"
        summary_rows.append({
            "Mã Prompt": p_code,
            "Tên Cấu Hình Thử Nghiệm": p_name,
            "Tổng Số Lượt Chạy": total,
            "Số Lần Xuất Biểu Đồ Thành Công": success_cnt,
            "Tỷ Lệ Thành Công (%)": success_rate,
            "Lỗi Treo GUI / Timeout (plt.show)": timeout_cnt,
            "Lỗi Sai Tên Cột (KeyError)": key_err_cnt,
            "Lỗi Không Tạo File Ảnh": missing_chart_cnt,
            "Lỗi Thư Viện Cấm / Bảo Mật": sec_err_cnt,
            "Thời Gian LLM Trung Bình (giây)": avg_llm_time,
        })

    df_summary = pd.DataFrame(summary_rows)
    os.makedirs(os.path.dirname(output_excel), exist_ok=True)
    with pd.ExcelWriter(output_excel, engine="openpyxl") as writer:
        df_summary.to_excel(writer, sheet_name="Bảng_Tổng_Hợp_Chương_5", index=False)
        df_results.to_excel(writer, sheet_name="Chi_Tiết_Thực_Nghiệm", index=False)
    return df_summary, df_results


# ==============================================================================
# 3. CHƯƠNG TRÌNH THỰC THI THỰC NGHIỆM TỰ ĐỘNG
# ==============================================================================

async def run_benchmark(files_dir: str, output_excel: str, max_files: int = 10):
    print("=" * 80)
    print("   BẮT ĐẦU THỰC NGHIỆM ĐỐI SÁNH 5 BIẾN THỂ PROMPT VẼ BIỂU ĐỒ (FINAI BENCHMARK)")
    print("=" * 80)

    api_key = settings.GEMINI_API_KEY
    if not api_key:
        print("❌ LỖI: Chưa cấu hình GEMINI_API_KEY trong tệp .env.")
        return

    # Quét danh sách tệp
    all_files = sorted(glob.glob(os.path.join(files_dir, "*.xlsx")))
    if not all_files:
        print(f"❌ Không tìm thấy tệp .xlsx nào trong thư mục: {files_dir}")
        return

    selected_files = all_files[:max_files]
    print(f"📁 Tìm thấy {len(all_files)} tệp. Tiến hành kiểm thử trên {len(selected_files)} tệp đại diện.")
    print(f"🎨 Đề bài kiểm thử: 5 biến thể Prompt ĐỀU LÀ PROMPT VẼ BIỂU ĐỒ.")
    print(f"🎯 Số câu hỏi mỗi tệp: {len(BENCHMARK_QUERIES)} câu trực quan hóa.")
    print(f"⚙️  Số phiên bản Prompt: {len(PROMPT_BUILDERS)} phiên bản (P1 đến P5).")
    total_runs = len(selected_files) * len(BENCHMARK_QUERIES) * len(PROMPT_BUILDERS)
    print(f"📊 Tổng số lượt chạy thí nghiệm: {total_runs} lượt.")
    print("-" * 80)

    charts_dir = os.path.join(os.path.dirname(output_excel), "Ket_Qua_Bieu_Do")
    os.makedirs(charts_dir, exist_ok=True)

    results_data = []
    current_run = 0

    for file_idx, f_path in enumerate(selected_files, start=1):
        filename = os.path.basename(f_path)
        file_stem = Path(filename).stem
        print(f"\n[{file_idx}/{len(selected_files)}] Đang nạp tệp: {filename}")

        try:
            df = dataframe_service.load_dataframe(f_path)
            # Lưu bản chuẩn hóa header để sandbox đọc đúng cấu trúc cột mà prompt đã cung cấp
            clean_dir = os.path.join(os.path.dirname(f_path), ".clean_sandbox_cache")
            os.makedirs(clean_dir, exist_ok=True)
            clean_file_path = os.path.join(clean_dir, filename)
            df.to_excel(clean_file_path, index=False)
        except Exception as e:
            print(f"⚠️ Không thể đọc tệp {filename}: {e}. Bỏ qua.")
            continue

        for q_idx, query in enumerate(BENCHMARK_QUERIES, start=1):
            print(f"   ▶ Yêu cầu biểu đồ {q_idx}: \"{query}\"")

            for p_code, p_name, builder_func in PROMPT_BUILDERS:
                current_run += 1
                prompt_text = builder_func(query, df)

                # 1. Gọi mô hình LLM với cơ chế tự động chờ và thử lại nếu chạm Rate Limit
                llm_ok = False
                raw_response = ""
                llm_time_ms = 0.0
                max_retries = 3
                for attempt in range(max_retries):
                    t0 = time.perf_counter()
                    llm_ok, raw_response = await AiAnalysisService._call_gemini(prompt_text, api_key)
                    llm_time_ms = round((time.perf_counter() - t0) * 1000, 1)
                    if llm_ok:
                        break
                    if any(k in raw_response.lower() for k in ["429", "resource_exhausted", "quota", "rate limit"]):
                        wait_sec = 12 * (attempt + 1)
                        print(f"      ⏳ Chạm giới hạn Rate Limit API, tạm nghỉ {wait_sec}s rồi thử lại (lần {attempt + 1}/{max_retries})...")
                        await asyncio.sleep(wait_sec)
                    else:
                        break

                cleaned_code = clean_python_code(raw_response) if llm_ok else ""

                # 2. Thực thi qua Sandbox
                sandbox_status = "Lỗi LLM"
                error_type = ""
                error_detail = ""
                stdout = ""
                exec_time_ms = 0.0
                has_chart = False

                if not llm_ok:
                    error_type = "API_Error"
                    error_detail = raw_response
                elif not cleaned_code:
                    sandbox_status = "Lỗi rỗng (No Code)"
                    error_type = "Empty_Code"
                    error_detail = "AI không sinh mã Python hợp lệ."
                else:
                    code_to_run = cleaned_code
                    if "df" in cleaned_code and not any(k in cleaned_code for k in ["read_excel", "read_csv", "load_dataframe"]):
                        base_fname = os.path.basename(f_path)
                        code_to_run = f"""import pandas as pd
import numpy as np
try:
    df = pd.read_excel({base_fname!r})
except Exception:
    df = pd.read_excel({f_path!r})

{cleaned_code}
"""
                    exec_res = execute_in_sandbox(code_to_run, clean_file_path, timeout=15)
                    exec_time_ms = exec_res.get("execution_time_ms", 0.0)
                    stdout = (exec_res.get("stdout") or "").strip()
                    stderr = (exec_res.get("stderr") or "").strip()
                    has_chart = bool(exec_res.get("chart_image"))

                    saved_img_path = ""
                    if exec_res.get("success"):
                        if has_chart:
                            sandbox_status = "Thành công (Đã tạo ảnh biểu đồ)"
                            error_type = "None"
                            # Lưu file ảnh thực tế ra thư mục Ket_Qua_Bieu_Do/<Ten_File>/
                            try:
                                import base64
                                chart_b64 = exec_res.get("chart_image") or ""
                                if chart_b64:
                                    if "," in chart_b64:
                                        chart_b64 = chart_b64.split(",", 1)[1]
                                    img_data = base64.b64decode(chart_b64)
                                    file_charts_dir = os.path.join(charts_dir, file_stem)
                                    os.makedirs(file_charts_dir, exist_ok=True)
                                    img_name = f"Cau_{q_idx}_{p_code}.png"
                                    img_full_path = os.path.join(file_charts_dir, img_name)
                                    with open(img_full_path, "wb") as f_img:
                                        f_img.write(img_data)
                                    saved_img_path = os.path.join("Ket_Qua_Bieu_Do", file_stem, img_name)
                            except Exception as img_err:
                                print(f"      ⚠️ Lỗi lưu file ảnh: {img_err}")
                        else:
                            sandbox_status = "Lỗi thiếu ảnh (Missing Chart)"
                            error_type = "Missing_Chart_File"
                            error_detail = "Code chạy thành công nhưng không tạo file ảnh output.png (có thể do gọi plt.show() bị chặn hoặc không gọi savefig)."
                    else:
                        sandbox_status = "Lỗi thực thi (Crash)"
                        error_detail = stderr
                        if "timeout" in stderr.lower() or "quá thời gian" in stderr.lower():
                            error_type = "Timeout (Treo GUI do plt.show)"
                        elif "KeyError" in stderr:
                            error_type = "KeyError (Sai tên cột)"
                        elif "SyntaxError" in stderr:
                            error_type = "SyntaxError (Cú pháp)"
                        elif "ModuleNotFoundError" in stderr or "No module named" in stderr:
                            error_type = "ModuleNotFoundError (Thư viện lạ)"
                        elif "Cảnh báo Sandbox" in stderr or "bị cấm" in stderr:
                            error_type = "Security_Violation (Lệnh cấm)"
                        elif "NameError" in stderr:
                            error_type = "NameError (Biến không xác định)"
                        else:
                            error_type = "Runtime_Exception"

                # Tự động gán nhãn sơ bộ
                if sandbox_status == "Thành công (Đã tạo ảnh biểu đồ)":
                    auto_label = "✅ Đúng (Có ảnh biểu đồ)"
                else:
                    auto_label = "❌ Sai (Lỗi code / Không có ảnh)"

                results_data.append({
                    "STT": current_run,
                    "Tệp_Dữ_Liệu": filename,
                    "Yêu_Cầu_Biểu_Đồ": query,
                    "Mã_Prompt": p_code,
                    "Tên_Phiên_Bản": p_name,
                    "Trạng_Thái_Sandbox": sandbox_status,
                    "Tạo_Được_Ảnh_Chart": "Có" if has_chart else "Không",
                    "Đường_Dẫn_Ảnh": saved_img_path,
                    "Loại_Lỗi": error_type,
                    "Chi_Tiết_Lỗi": error_detail[:300] if error_detail else "",
                    "Thời_Gian_LLM_ms": llm_time_ms,
                    "Thời_Gian_Sandbox_ms": exec_time_ms,
                    "Đánh_Nhãn_Bằng_Mắt": auto_label,
                    "Mã_Code_Sinh_Ra": cleaned_code[:500],
                })

                status_icon = "🎨✅" if has_chart else "❌"
                print(f"      [{current_run}/{total_runs}] {p_code}: {status_icon} {sandbox_status} ({error_type or 'Chart OK'})")

                # Nghỉ ngắn giữa các request để tôn trọng rate limit của API
                await asyncio.sleep(1.2)

        # Lưu checkpoint kết quả sau mỗi tệp hoàn thành để không bao giờ mất dữ liệu
        _save_excel_file(results_data, output_excel)
        print(f"   💾 Đã tự động sao lưu checkpoint kết quả ({file_idx}/{len(selected_files)} tệp) vào Excel.")

    # ==============================================================================
    # 4. XUẤT BẢNG TỔNG HỢP CUỐI CÙNG
    # ==============================================================================
    df_summary, df_results = _save_excel_file(results_data, output_excel)

    print("\n" + "=" * 80)
    print("🎉 HOÀN THÀNH THỰC NGHIỆM BENCHMARK 5 PROMPT VẼ BIỂU ĐỒ!")
    print(f"📊 Tệp Excel kết quả đã xuất tại: {output_excel}")
    print("=" * 80)
    if df_summary is not None:
        print("\nBẢNG TỔNG HỢP KẾT QUẢ CHO CHƯƠNG 5 KHÓA LUẬN:")
        print(df_summary.to_string(index=False))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="FinAI Chart Visualization Prompt Benchmark")
    parser.add_argument("--dir", default="/app/uploads/benchmark_files", help="Thư mục chứa file excel")
    parser.add_argument("--output", default="/app/uploads/Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx", help="Đường dẫn file kết quả")
    parser.add_argument("--max", type=int, default=10, help="Số file tối đa cần test")
    args = parser.parse_args()

    asyncio.run(run_benchmark(args.dir, args.output, args.max))
