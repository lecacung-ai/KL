"""Bounded data context and AI Agent instructions for code generation, profiling, and repair."""

import json
import re
import unicodedata
from typing import Any

import pandas as pd

MAX_CONTEXT_CHARS = 28000
MAX_SAMPLE_ROWS = 40
MAX_SAMPLE_COLUMNS = 40


def _normalize(value: object) -> str:
    return " ".join(unicodedata.normalize("NFC", str(value)).casefold().split())


def build_data_context(df: pd.DataFrame, query: str) -> str:
    """Build rich data profiling context for the AI Agent: dimensions, schema, summary stats, and samples."""
    query_text = _normalize(query)
    query_words = set(re.findall(r"\w+", query_text))
    positions: list[int] = []

    # Identify rows that directly match query keywords
    for start in range(0, min(len(df), 10000), 1000):
        batch = df.iloc[start:min(start + 1000, 10000), :MAX_SAMPLE_COLUMNS].select_dtypes(
            include=["object", "string", "category"]
        )
        for offset, row in enumerate(batch.itertuples(index=False, name=None)):
            for value in row:
                label = _normalize(value)
                words = set(re.findall(r"\w+", label))
                if 2 <= len(label) <= 100 and words and words <= query_words:
                    positions.append(start + offset)
                    break
            if len(positions) >= 20:
                break
        if len(positions) >= 20:
            break

    # Small tables include all rows. Large tables retain head, tail and keyword matches.
    if len(df) <= MAX_SAMPLE_ROWS:
        positions = list(range(len(df)))
    else:
        positions = sorted(set(list(range(8)) + positions + list(range(len(df) - 5, len(df)))))
    positions = positions[:MAX_SAMPLE_ROWS]
    sampled = df.iloc[positions, :MAX_SAMPLE_COLUMNS]
    truncated = len(positions) < len(df) or len(sampled.columns) < len(df.columns)

    rows: list[dict[str, Any]] = []
    for position, values in zip(positions, sampled.itertuples(index=False, name=None), strict=True):
        rows.append({
            "position": position,
            "values": [None if pd.isna(v) else str(v)[:180] for v in values]
        })

    # Detailed column profiling (data types, missing counts, statistics)
    columns_info: list[dict[str, Any]] = []
    for name, dtype in list(df.dtypes.items())[:MAX_SAMPLE_COLUMNS]:
        col_series = df[name]
        col_meta: dict[str, Any] = {
            "name": str(name)[:180],
            "dtype": str(dtype),
            "null_count": int(col_series.isna().sum()),
            "unique_count": int(col_series.nunique()),
        }
        if pd.api.types.is_numeric_dtype(col_series):
            clean_s = col_series.dropna()
            if not clean_s.empty:
                col_meta["min"] = round(float(clean_s.min()), 2)
                col_meta["max"] = round(float(clean_s.max()), 2)
                col_meta["mean"] = round(float(clean_s.mean()), 2)
        columns_info.append(col_meta)

    context = {
        "row_count": len(df),
        "column_count": len(df.columns),
        "columns": columns_info,
        "sample_is_partial": truncated,
        "sample_rows": rows,
    }

    encoded = json.dumps(context, ensure_ascii=False)
    while len(encoded) > MAX_CONTEXT_CHARS and context["sample_rows"]:
        context["sample_rows"].pop()
        context["sample_is_partial"] = True
        encoded = json.dumps(context, ensure_ascii=False)
    return encoded


AGENT_SYSTEM_RULES = """
Bạn là FinAI Agent - Trợ lý Chuyên gia Phân tích Dữ liệu Kinh doanh & Tài chính cấp cao (tương tự LangChain Data Analysis Agent).
Mục tiêu: Đọc dữ liệu, tính toán chính xác, trực quan hóa và đưa ra nhận định kinh doanh sâu sắc cho người dùng.

Quy tắc thực thi cốt lõi:
1. Đọc tệp và giới hạn phạm vi cột được cho phép.
2. Xử lý kiểu dữ liệu, làm sạch ô trống (NaN), chuẩn hóa ngày tháng hoặc số tiền nếu cần.
3. Luôn in ra màn hình (sys.stdout) một báo cáo phân tích hoàn chỉnh gồm 3 phần rõ ràng:
   ---
   📊 1. KẾT QUẢ TÍNH TOÁN & SỐ LIỆU CHÍNH:
   - In ra các con số quan trọng, tỷ lệ phần trăm (%), tốc độ tăng trưởng, tổng cộng.
   - Định dạng số có dấu phẩy ngăn cách (VD: 1,500,000 VNĐ thay vì 1500000).
   - In bảng tóm tắt rõ ràng bằng print(df_summary.to_string()).

   💡 2. NHẬN ĐỊNH & PHÂN TÍCH KINH DOANH (INSIGHTS):
   - Đánh giá xu hướng tăng/giảm, điểm đột biến hoặc bất thường trong dữ liệu.
   - So sánh giữa các nhóm, đối tượng, phân khúc hoặc các kỳ kinh doanh.
   - Nêu nguyên nhân hoặc ý nghĩa kinh doanh của các con số trên.

   🎯 3. KHUYẾN NGHỊ HÀNH ĐỘNG (RECOMMENDATIONS):
   - Đưa ra 2-3 gợi ý hành động thiết thực cho người quản lý/nhà phân tích dựa trên dữ liệu.
   ---

4. Về Biểu đồ trực quan hóa (Data Visualization):
   - Nếu câu hỏi yêu cầu vẽ biểu đồ, hoặc nội dung phân tích có so sánh/xu hướng/phân bổ:
     - Tạo biểu đồ trực quan, đẹp mắt bằng matplotlib.pyplot hoặc seaborn.
     - Thiết lập font tiếng Việt hoặc hiển thị không lỗi, tiêu đề rõ ràng, nhãn trục X và Y.
     - Hiển thị nhãn giá trị (data labels) trên các cột/điểm dữ liệu để dễ đọc.
     - Thêm lưới mờ plt.grid(True, linestyle='--', alpha=0.5).
     - Luôn lưu biểu đồ vào file: plt.savefig('output.png', dpi=150, bbox_inches='tight').
     - Luôn gọi plt.close() sau khi lưu để giải phóng bộ nhớ.

5. Quy tắc an toàn & nghiệp vụ:
   - Dữ liệu chỉ dùng các cột trong phạm vi được phép.
   - Không bịa số liệu; không dùng input(); không gọi thư viện mạng.
   - Không cộng dồn dòng tổng với dòng chi tiết; không cộng tỷ lệ phần trăm.
   - Chỉ trả về duy nhất khối mã Python trong cặp dấu ```python ... ```.
"""


def is_visualization_query(query: str) -> bool:
    """Check if the user explicitly requested a chart, graph, or visual plot."""
    normalized = _normalize(query)
    viz_keywords = [
        "vẽ", "biểu đồ", "đồ thị", "plot", "chart", "graph", "visualize",
        "trực quan", "hình tròn", "cột", "đường", "scatter", "histogram",
        "heatmap", "boxplot", "phân phối", "trực quan hóa", "vẽ hình", "minh họa"
    ]
    return any(k in normalized for k in viz_keywords)


def is_conversational_query(query: str) -> bool:
    """Check if the user query is a greeting, casual chat, or general bot capability inquiry."""
    normalized = _normalize(query)
    if is_visualization_query(query):
        return False

    calc_keywords = [
        "tính", "tổng", "trung bình", "cao nhất", "thấp nhất", "max", "min", "mean",
        "sum", "count", "đếm", "lọc", "tìm", "top", "so sánh", "tỷ lệ", "doanh thu",
        "chi phí", "lợi nhuận", "bao nhiêu", "dòng nào", "cột nào", "dữ liệu nào",
        "thống kê", "phân tích", "dự báo", "xu hướng", "nhóm", "phần trăm"
    ]
    has_calc = any(k in normalized for k in calc_keywords)
    if has_calc:
        return False

    greetings = [
        "hello", "hi", "hey", "halo", "xin chào", "chào", "chào bạn", "alo",
        "good morning", "good afternoon", "good evening", "bạn là ai",
        "who are you", "what can you do", "bạn có thể làm gì", "giúp tôi",
        "hướng dẫn", "bắt đầu", "start", "cảm ơn", "thank you", "thanks",
        "ok", "tuyệt", "good", "bye", "tạm biệt", "test"
    ]
    words = normalized.split()
    if len(words) <= 4 and any(g in normalized for g in greetings):
        return True

    return any(
        normalized == g
        or normalized.startswith(f"{g} ")
        or normalized.endswith(f" {g}")
        for g in greetings
    )


def build_conversational_prompt(
    *,
    filename: str,
    row_count: int,
    column_count: int,
    columns: list[str],
    query: str,
    chat_history: list[dict[str, str]] | None = None,
) -> str:
    """Build prompt for conversational / greeting responses without generating code or charts."""
    return f"""Bạn là FinAI - Trợ lý Chuyên gia Phân tích Dữ liệu Thông minh (như trong video Build a Data Analysis AI Agent | Chat With Your CSV & Excel Files - LangChain + Streamlit).
Người dùng vừa gửi lời chào hoặc tương tác thông thường: "{query}".

Nhiệm vụ của bạn:
1. Chào người dùng một cách tự nhiên, ngắn gọn và lịch sự bằng tiếng Việt (ví dụ: "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?").
2. QUY TẮC BẮT BUỘC:
   - TUYỆT ĐỐI KHÔNG tự động giới thiệu tệp, KHÔNG liệt kê số dòng số cột, và KHÔNG tự động gợi ý danh sách câu hỏi KHI NGƯỜI DÙNG CHƯA YÊU CẦU.
   - Chỉ giới thiệu tệp dữ liệu hoặc gợi ý câu hỏi khi người dùng thực sự hỏi cụ thể (ví dụ: "giới thiệu tệp", "file này có gì", "tôi nên hỏi gì").
   - TUYỆT ĐỐI KHÔNG viết mã Python.
   - TUYỆT ĐỐI KHÔNG sinh khối ```python.
   - TUYỆT ĐỐI KHÔNG vẽ hình hay lưu file ảnh.
   - Chỉ trả lời bằng văn bản đối thoại tự nhiên, ngắn gọn, thân thiện.
"""


def build_analysis_prompt(
    *,
    file_path: str,
    context: str,
    columns: list[str],
    query: str,
    chat_history: list[dict[str, str]] | None = None,
    is_visualization: bool | None = None,
) -> str:
    """Build prompt for AI Data Analysis Agent with multi-turn chat support."""
    reader = "pd.read_csv" if file_path.endswith(".csv") else "pd.read_excel"
    if is_visualization is None:
        is_visualization = is_visualization_query(query)
    
    history_text = ""
    if chat_history:
        history_lines = []
        for item in chat_history[-3:]:
            q = item.get("query", "")
            s = item.get("summary", "")
            if q:
                history_lines.append(f"- Câu hỏi trước: \"{q}\"")
                if s:
                    history_lines.append(f"  Kết quả: {s[:250]}...")
        if history_lines:
            history_text = "\nNgữ cảnh trò chuyện trước đó:\n" + "\n".join(history_lines) + "\n"

    viz_instruction = (
        """📊 YÊU CẦU TRỰC QUAN HÓA (DATA VISUALIZATION) - TIÊU CHUẨN THỰC NGHIỆM TỐI ƯU (ĐỘ TIN CẬY 99%):
Người dùng CÓ yêu cầu vẽ biểu đồ/trực quan hóa cho câu hỏi này.
Hãy áp dụng quy chuẩn thiết kế biểu đồ của Chuyên gia BI cấp cao kết hợp các bài học thực nghiệm:
1. Luôn ép kiểu an toàn cho cột số liệu: df[cot_so] = pd.to_numeric(df[cot_so], errors='coerce').
2. Luôn tổng hợp dữ liệu nhóm (groupby().sum() hoặc groupby().mean()), sắp xếp giảm dần và lấy Top 10 bản ghi tiêu biểu nhất để bố cục biểu đồ thoáng đẹp, không bị đè chữ.
3. Đặt nhãn giá trị (data labels) rõ ràng trên đầu các cột hoặc điểm dữ liệu.
4. Xoay nhãn trục hoành plt.xticks(rotation=45, ha='right') để nhãn hiển thị đầy đủ, không bị chồng lấn.
5. Luôn dùng backend headless matplotlib.use('Agg'), lưu biểu đồ vào file: plt.savefig('output.png', dpi=150, bbox_inches='tight') và gọi plt.close('all').
6. Đồng thời in kết quả phân tích số liệu ra màn hình bằng lệnh print()."""
        if is_visualization
        else
        """⚠️ YÊU CẦU QUAN TRỌNG VỀ TRỰC QUAN HÓA:
Người dùng KHÔNG yêu cầu vẽ biểu đồ trong câu hỏi này (chỉ yêu cầu tính toán, trả lời số liệu hoặc thông tin).
- TUYỆT ĐỐI KHÔNG import matplotlib hay seaborn.
- TUYỆT ĐỐI KHÔNG vẽ biểu đồ và KHÔNG lưu file 'output.png'.
- Chỉ tập trung viết mã Python để tính toán chính xác số liệu và in kết quả ra màn hình bằng print()."""
    )

    return f"""{AGENT_SYSTEM_RULES}

Dữ liệu nguồn:
- Đọc tệp: df = {reader}({file_path!r})
- Giới hạn DataFrame: df = df[{columns!r}].copy()
{history_text}
Yêu cầu phân tích của người dùng:
"{query}"

{viz_instruction}

Cấu trúc và mẫu dữ liệu (Data Profiling JSON):
{context}

Hãy suy nghĩ từng bước (Thought) và viết mã Python hoàn chỉnh trong khối ```python ... ``` để thực thi và in báo cáo phân tích theo mẫu.
"""


def build_repair_prompt(original_prompt: str, code: str, error: str) -> str:
    """Build self-correction prompt for the agent when code execution encounters errors."""
    return f"""{original_prompt}

Mã Python đã chạy lần trước:
```python
{code[:40000]}
```

Lỗi phát sinh khi thực thi trong Sandbox:
```text
{error[:8000]}
```

Hãy phân tích lỗi trên (ví dụ: KeyError, ValueError, thiếu cột, ép kiểu dữ liệu lỗi) và viết lại TOÀN BỘ mã Python đã được sửa lỗi trong khối ```python ... ``` để thực thi thành công.
"""


__all__ = [
    "MAX_CONTEXT_CHARS",
    "MAX_SAMPLE_COLUMNS",
    "MAX_SAMPLE_ROWS",
    "build_analysis_prompt",
    "build_conversational_prompt",
    "build_data_context",
    "build_repair_prompt",
    "is_conversational_query",
    "is_visualization_query",
]
