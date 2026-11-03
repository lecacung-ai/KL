"""Tool-Calling Agent tools for tabular data analysis inspired by LangChain + Streamlit patterns."""

import os
from typing import Any

import pandas as pd

from app.core.sandbox import clean_python_code, execute_in_sandbox

# --- SCHEMA DEFINITION FOR GEMINI / LLM FUNCTION CALLING ---
TOOL_DECLARATIONS = [
    {
        "name": "get_data_info",
        "description": "Lấy thông tin tổng quan về tập dữ liệu CSV/Excel: kích thước (shape: số dòng, số cột), kiểu dữ liệu từng cột (dtypes), số lượng và tỷ lệ ô khuyết thiếu (isna().sum()) và 5 dòng đầu tiên (head). Sử dụng khi người dùng muốn biết tập dữ liệu gồm những gì, kiểm tra độ khuyết thiếu hoặc khi bắt đầu phân tích.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "filter_data",
        "description": "Lọc các dòng trong tập dữ liệu dựa trên điều kiện truy vấn pandas query (ví dụ: `DoanhThu > 1000000`, `KhuVuc == 'Hà Nội'`). Sử dụng khi người dùng muốn lọc, tìm các bản ghi thỏa mãn điều kiện cụ thể.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "condition": {
                    "type": "STRING",
                    "description": "Biểu thức điều kiện lọc hợp lệ cho pandas df.query(), ví dụ: `Tuoi > 25 and PhongBan == 'IT'`",
                }
            },
            "required": ["condition"],
        },
    },
    {
        "name": "analyze_data",
        "description": "Chạy biểu thức hoặc đoạn mã tính toán pandas trên dataframe `df` (ví dụ: tính tổng, trung bình, min, max, nhóm groupby, lọc điều kiện phức tạp). Sử dụng khi người dùng yêu cầu tính toán, thống kê, so sánh hoặc tổng hợp số liệu. Biến `df` đã nạp sẵn.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "expression": {
                    "type": "STRING",
                    "description": "Mã Python pandas thao tác trên biến `df` để tính toán và in kết quả bằng lệnh print(), ví dụ: `print(pd.to_numeric(df['2025-12-31 00:00:00'], errors='coerce').sum())`",
                }
            },
            "required": ["expression"],
        },
    },
    {
        "name": "plot_chart",
        "description": "BẮT BUỘC GỌI CÔNG CỤ NÀY khi người dùng yêu cầu vẽ biểu đồ, đồ thị, vẽ hình hoặc trực quan hóa dữ liệu (cột, đường, tròn, miền, phân tán, heatmap...). Không được chỉ in mã ra text mà PHẢI gọi công cụ này để hệ thống tạo và hiển thị ảnh biểu đồ thật cho người dùng.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "chart_code": {
                    "type": "STRING",
                    "description": "Mã Python matplotlib/seaborn thao tác trực tiếp trên biến DataFrame `df` để vẽ biểu đồ và lưu bằng `plt.savefig('output.png', bbox_inches='tight')`. Biến `df` đã có sẵn trong môi trường.",
                },
                "chart_type": {
                    "type": "STRING",
                    "description": "Loại biểu đồ (bar, line, pie, area, scatter, histogram, heatmap)",
                },
            },
            "required": ["chart_code"],
        },
    },
    {
        "name": "recommend_forecast_algorithms",
        "description": "Phân tích cấu trúc tệp dữ liệu để xác định loại tệp tài chính (Báo cáo tài chính định kỳ, Chuỗi thời gian bán hàng/giao dịch, Hồ sơ rủi ro tín dụng/phân loại nhị phân, hoặc Phân khúc danh mục đa biến) và gợi ý các thuật toán máy học chuyên sâu phù hợp nhất (Linear Regression - Mariya Sha, Time Series ARIMA / Holt-Winters - freeCodeCamp, LSTM Deep Learning - Code with Josh, Logistic Regression - Josh Starmer StatQuest, K-Means Clustering - Andy McDonald). Đưa ra gợi ý cụ thể về các trường mục tiêu Y và biến đặc trưng X để người dùng tùy chọn.",
        "parameters": {
            "type": "OBJECT",
            "properties": {},
        },
    },
    {
        "name": "export_dataset",
        "description": "Lọc hoặc biến đổi dữ liệu DataFrame và xuất ra file mới (.xlsx hoặc .csv) để người dùng tải về máy. Sử dụng khi người dùng yêu cầu xuất file, lưu kết quả ra file mới hoặc tải về bảng dữ liệu đã xử lý.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "condition": {
                    "type": "STRING",
                    "description": "Biểu thức điều kiện lọc df.query() (nếu có, để trống nếu xuất nguyên vẹn)",
                },
                "output_filename": {
                    "type": "STRING",
                    "description": "Tên file xuất mong muốn (ví dụ: `ket_qua_loc.xlsx`, `doanh_thu_thang5.csv`)",
                },
                "file_format": {
                    "type": "STRING",
                    "description": "Định dạng file xuất: 'xlsx' hoặc 'csv'",
                },
            },
            "required": ["output_filename"],
        },
    },
]


def execute_get_data_info(df: pd.DataFrame) -> str:
    """Tool: Lấy thông tin cấu trúc DataFrame theo chuẩn Corey Schafer:
    - Kích thước dòng, cột
    - Kiểm tra khuyết thiếu bằng isna().sum() (12:37)
    - Nhận diện kiểu dữ liệu dtypes (15:27)
    - Trích xuất 5 dòng mẫu (head)
    """
    if df is None or df.empty:
        return "Không có dữ liệu trong DataFrame."

    total_rows = len(df)
    missing_series = df.isna().sum()

    col_details = []
    for col, dtype in df.dtypes.items():
        missing_count = int(missing_series.get(col, 0))
        if missing_count > 0:
            pct = round((missing_count / total_rows) * 100, 1) if total_rows > 0 else 0
            col_details.append(f"  - {col} ({dtype}): {missing_count:,} ô khuyết thiếu ({pct}%)")
        else:
            col_details.append(f"  - {col} ({dtype}): đầy đủ (0 khuyết)")

    cols_str = "\n".join(col_details)
    head_str = df.head(5).to_string()
    total_missing = int(missing_series.sum())

    return (
        f"Kích thước DataFrame (Shape): {total_rows:,} dòng, {len(df.columns)} cột\n"
        f"Tổng số ô khuyết thiếu (Missing cells): {total_missing:,}\n\n"
        f"Danh sách các cột, Kiểu dữ liệu (dtypes) & Tình trạng khuyết thiếu (isna):\n{cols_str}\n\n"
        f"5 dòng dữ liệu mẫu đầu tiên:\n{head_str}"
    )


def execute_filter_data(df: pd.DataFrame, condition: str) -> str:
    """Tool: Lọc dữ liệu dựa trên điều kiện pandas query."""
    if df is None or df.empty:
        return "Không có dữ liệu để lọc."
    try:
        res = df.query(condition)
        total = len(res)
        if total == 0:
            return f"Không tìm thấy dòng nào thỏa mãn điều kiện: {condition}"
        if total > 20:
            return (
                f"Tìm thấy tổng cộng {total:,} dòng thỏa mãn điều kiện `{condition}`.\n"
                f"Hiển thị 20 dòng đầu tiên:\n{res.head(20).to_string()}"
            )
        return f"Tìm thấy {total} dòng thỏa mãn điều kiện `{condition}`:\n{res.to_string()}"
    except Exception as e:
        return f"Lỗi khi lọc dữ liệu: {str(e)}"


def execute_analyze_data(
    df: pd.DataFrame, expression: str, file_path: str
) -> tuple[str, str, bool, int]:
    """Tool: Chạy biểu thức tính toán hoặc script phân tích pandas trong Sandbox an toàn."""
    reader = "pd.read_csv" if file_path.endswith(".csv") else "pd.read_excel"
    expr_clean = clean_python_code(expression.strip())

    lines = [line.strip() for line in expr_clean.splitlines() if line.strip()]
    if not lines:
        return "Biểu thức tính toán rỗng.", "", False, 0

    first_line = lines[0]
    is_multi_line = len(lines) > 1 or "\n" in expr_clean or any(k in expr_clean for k in ["for ", "def ", "if ", "import "])
    has_print = "print(" in expr_clean
    is_assignment = "=" in first_line and not any(op in first_line for op in ["==", "!=", "<=", ">="])

    if not is_multi_line and not has_print and not is_assignment:
        exec_script = f"""__calc_result = ({expr_clean})
print(__calc_result)"""
    elif is_assignment and not is_multi_line and not has_print:
        var_name = first_line.split("=")[0].strip()
        exec_script = f"""{expr_clean}
print({var_name})"""
    elif is_multi_line and not has_print:
        last_line = lines[-1]
        if "=" in last_line and not any(op in last_line for op in ["==", "!=", "<=", ">="]):
            var_name = last_line.split("=")[0].strip()
            exec_script = f"""{expr_clean}
print({var_name})"""
        else:
            exec_script = f"""{expr_clean}
if 'result' in locals():
    print(result)
elif 'res' in locals():
    print(res)
elif 'output' in locals():
    print(output)
"""
    else:
        exec_script = expr_clean

    full_code = f"""import pandas as pd
import numpy as np

df = {reader}({file_path!r})

{exec_script}
"""
    sandbox_res = execute_in_sandbox(full_code, file_path, timeout=10)
    stdout = sandbox_res.get("stdout") or ""
    stderr = sandbox_res.get("stderr") or ""
    success = bool(sandbox_res.get("success", False))
    elapsed = int(sandbox_res.get("execution_time_ms", 0))

    if success:
        tool_output = stdout.strip() if stdout.strip() else "(Đoạn mã thực thi thành công nhưng không in kết quả ra màn hình)"
    else:
        tool_output = f"Lỗi khi thực thi mã: {stderr.strip()}"

    return tool_output, full_code, success, elapsed


def execute_recommend_forecast_algorithms(df: pd.DataFrame, filename: str = "") -> str:
    """Tool: Phân tích tệp dữ liệu và đưa ra gợi ý các thuật toán máy học theo 5 video chuyên sâu."""
    from app.analytics.dataset_recommender import analyze_and_recommend

    rec = analyze_and_recommend(df, filename)
    detected_type = rec["type_label"]
    desc = rec["type_description"]

    lines = [
        f"🎯 **Phân loại tệp tài chính phát hiện:** {detected_type}",
        f"📝 **Đặc điểm:** {desc}",
        f"📊 **Kích thước:** {rec['total_rows']:,} dòng, {rec['total_columns']} cột",
        "",
        "💡 **Gợi ý thuật toán máy học & dự báo tốt nhất (Dựa trên 5 video bài giảng chuẩn):**",
    ]
    for idx, r in enumerate(rec["recommendations"], 1):
        lines.append(f"{idx}. **{r['algorithm_name']}** [{r['suitability']}]")
        lines.append(f"   - 🎓 *Tham chiếu bài giảng:* {r['tutorial_title']} ({r['tutorial_channel']})")
        lines.append(f"   - 📌 *Lý do đề xuất:* {r['reason']}")
        if r.get("suggested_target"):
            lines.append(f"   - 🎯 *Trường mục tiêu gợi ý (Y):* `{r['suggested_target']}`")
        if r.get("suggested_features"):
            feats = ", ".join([f"`{f}`" for f in r["suggested_features"][:5]])
            lines.append(f"   - 🎛️ *Biến đặc trưng gợi ý (X):* {feats}")
        if r.get("suggested_date"):
            lines.append(f"   - 📅 *Trục mốc thời gian:* `{r['suggested_date']}`")
        lines.append("")

    lines.append("👉 **Bạn có thể:**")
    lines.append("- Yêu cầu tôi thực hiện dự báo ngay trong cuộc trò chuyện (ví dụ: 'Hãy chạy Linear Regression dự đoán Doanh thu cho 3 kỳ tới').")
    lines.append("- Hoặc mở giao diện trực quan tại menu **'Dự Báo & Phân Nhóm'** (`/forecast`) để tùy chọn trường Y, trường X và xem biểu đồ tương tác.")
    return "\n".join(lines)


def execute_plot_chart(
    df: pd.DataFrame, chart_code: str, file_path: str
) -> tuple[str, str | None, str, bool, int]:
    """Tool: Vẽ biểu đồ trực quan hóa dữ liệu bằng matplotlib/seaborn trong Sandbox an toàn."""
    reader = "pd.read_csv" if file_path.endswith(".csv") else "pd.read_excel"
    code = clean_python_code(chart_code.strip())

    has_df = any(
        line.strip().startswith(("df =", "df=", "df :="))
        for line in code.splitlines()
    )

    df_init = ""
    if not has_df:
        df_init = f"df = {reader}({file_path!r})\n"

    full_code = f"""import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd

{df_init}
{code}

# Tự động xuất biểu đồ nếu chưa lưu ra output.png
if not os.path.exists("output.png"):
    if plt.get_fignums():
        plt.savefig("output.png", bbox_inches='tight', dpi=150)
    plt.close('all')
"""

    sandbox_res = execute_in_sandbox(full_code, file_path, timeout=15)
    stdout = sandbox_res.get("stdout") or ""
    stderr = sandbox_res.get("stderr") or ""
    chart_base64 = sandbox_res.get("chart_image")
    success = bool(sandbox_res.get("success", False) and chart_base64)
    elapsed = int(sandbox_res.get("execution_time_ms", 0))

    if chart_base64:
        tool_output = stdout or "Biểu đồ đã được vẽ và xuất thành công ra hình ảnh (hiển thị trực tiếp cho người dùng)."
    else:
        tool_output = f"Lỗi khi thực thi mã vẽ biểu đồ: {stderr or 'Không thể tạo hình ảnh biểu đồ output.png.'}"

    return tool_output, chart_base64, full_code, success, elapsed


EXPORT_DIR = "/tmp/exports"
os.makedirs(EXPORT_DIR, exist_ok=True)


def execute_export_dataset(
    df: pd.DataFrame,
    output_filename: str,
    condition: str = "",
    file_format: str = "xlsx",
) -> tuple[str, dict[str, Any] | None, str, bool, int]:
    """Tool: Lọc hoặc biến đổi dữ liệu và xuất ra tệp Excel (.xlsx) hoặc CSV (.csv)."""
    import time

    start = time.time()
    if df is None or df.empty:
        return "Không có dữ liệu để xuất.", None, "", False, 0

    try:
        data_to_export = df.query(condition) if condition.strip() else df.copy()
        safe_name = os.path.basename(output_filename).replace(" ", "_")
        fmt = file_format.lower().replace(".", "").strip()
        if fmt not in ["xlsx", "csv"]:
            fmt = "xlsx" if safe_name.endswith(".xlsx") else "csv"

        if not safe_name.endswith(f".{fmt}"):
            safe_name = f"{safe_name}.{fmt}"

        export_path = os.path.join(EXPORT_DIR, safe_name)
        if fmt == "xlsx":
            data_to_export.to_excel(export_path, index=False)
        else:
            data_to_export.to_csv(export_path, index=False, encoding="utf-8-sig")

        size_kb = round(os.path.getsize(export_path) / 1024, 1)
        elapsed = int((time.time() - start) * 1000)
        file_info = {
            "filename": safe_name,
            "row_count": len(data_to_export),
            "column_count": len(data_to_export.columns),
            "size_kb": size_kb,
            "download_url": f"/api/v1/files/download-export/{safe_name}",
        }
        msg = (
            f"Đã xuất thành công tệp `{safe_name}` gồm {len(data_to_export):,} dòng và {len(data_to_export.columns)} cột ({size_kb} KB).\n"
            f"Người dùng có thể tải về tệp này từ đường dẫn: /api/v1/files/download-export/{safe_name}"
        )
        code_used = (
            f"# Xuất dữ liệu đã lọc ra tệp {safe_name}\n"
            f"export_df = df.query({condition!r})\n"
            f"export_df.to_{'excel' if fmt == 'xlsx' else 'csv'}('{safe_name}', index=False)"
            if condition.strip()
            else f"# Xuất toàn bộ DataFrame ra tệp {safe_name}\n"
                 f"df.to_{'excel' if fmt == 'xlsx' else 'csv'}('{safe_name}', index=False)"
        )
        return msg, file_info, code_used, True, elapsed
    except Exception as e:
        elapsed = int((time.time() - start) * 1000)
        return f"Lỗi khi xuất tệp dữ liệu: {str(e)}", None, "", False, elapsed
