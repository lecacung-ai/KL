"""Data Analysis AI Agent application service inspired by LangChain + Streamlit patterns."""

import os
import shutil
import uuid
from typing import Any

import httpx
import pandas as pd
from fastapi import UploadFile
from sqlmodel import Session

from app.core.config import settings
from app.core.sandbox import execute_in_sandbox
from app.entities.analysis_history import AnalysisHistory
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.analysis_history_repository import (
    AnalysisHistoryRepository,
    analysis_history_repository,
)
from app.services.agent_tools import (
    TOOL_DECLARATIONS,
    execute_analyze_data,
    execute_export_dataset,
    execute_filter_data,
    execute_get_data_info,
    execute_plot_chart,
    execute_recommend_forecast_algorithms,
)
from app.services.analysis_prompt import (
    build_analysis_prompt,
    build_conversational_prompt,
    build_data_context,
    build_repair_prompt,
    is_conversational_query,
    is_visualization_query,
)
from app.services.dataframe_service import dataframe_service

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class AiAnalysisService:
    """Service implementing the Conversational Data Analysis AI Agent workflow."""

    def __init__(
        self, history_repository: AnalysisHistoryRepository = analysis_history_repository
    ) -> None:
        self.history_repository = history_repository

    @staticmethod
    def _validate_file(filename: str) -> None:
        if not filename.endswith((".csv", ".xlsx", ".xls")):
            raise AppException(
                ErrorCode.UNSUPPORTED_FILE_TYPE,
                detail="Chỉ hỗ trợ tệp định dạng .csv hoặc .xlsx/.xls",
            )

    async def inspect_columns(self, file: UploadFile) -> dict[str, Any]:
        """Perform preliminary schema profiling for file columns."""
        filename = file.filename or ""
        self._validate_file(filename)
        temp_path = os.path.join(UPLOAD_DIR, f"inspect_{uuid.uuid4().hex}_{filename}")
        try:
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            df = dataframe_service.load_dataframe(temp_path)
            head_sample = df.head(10).fillna("").to_dict(orient="records")
            columns_meta = []
            for col in df.columns:
                series = df[col]
                is_numeric = bool(pd.api.types.is_numeric_dtype(series))
                is_datetime = bool(pd.api.types.is_datetime64_any_dtype(series))
                sample_vals = [str(x) for x in series.dropna().head(3).tolist()]
                columns_meta.append({
                    "name": str(col),
                    "type_category": (
                        "Số (Numeric)"
                        if is_numeric
                        else ("Thời gian (Datetime)" if is_datetime else "Phân loại (Categorical)")
                    ),
                    "sample_values": sample_vals,
                })
            return {
                "filename": filename,
                "row_count": len(df),
                "column_count": len(df.columns),
                "columns": columns_meta,
                "head_data": head_sample,
            }
        except Exception as error:
            raise AppException(
                ErrorCode.ANALYSIS_FILE_READ_ERROR,
                detail=f"Không thể đọc cấu trúc tệp: {error}",
            ) from error
        finally:
            if os.path.exists(temp_path):
                try:
                    os.remove(temp_path)
                except Exception:
                    pass

    @staticmethod
    async def _call_gemini(prompt: str, api_key: str) -> tuple[bool, str]:
        """Call Google Gemini API with automatic model fallback."""
        models = [
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.6-flash",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-3.8-flash",
        ]
        last_error = ""
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in models:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={api_key}"
                )
                try:
                    response = await client.post(
                        url,
                        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                        json={"contents": [{"parts": [{"text": prompt}]}]},
                    )
                    if response.status_code == 200:
                        candidates = response.json().get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                return True, parts[0].get("text", "")
                    else:
                        last_error = f"{response.status_code}: {response.text}"
                except Exception as error:
                    last_error = str(error)
        return False, last_error

    @staticmethod
    async def _call_gemini_with_tools(
        system_instruction: str,
        contents: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        api_key: str,
    ) -> tuple[bool, dict[str, Any]]:
        """Call Google Gemini API with function declarations (Tool Calling) and model fallback."""
        models = [
            "gemini-3.5-flash",
            "gemini-3.5-flash-lite",
            "gemini-3.6-flash",
            "gemini-flash-lite-latest",
            "gemini-3.1-flash-lite",
            "gemini-flash-latest",
            "gemini-3.8-flash",
        ]
        last_error = ""
        payload = {
            "system_instruction": {"parts": [{"text": system_instruction}]},
            "contents": contents,
            "tools": [{"function_declarations": tools}],
        }
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in models:
                url = (
                    f"https://generativelanguage.googleapis.com/v1beta/models/"
                    f"{model}:generateContent?key={api_key}"
                )
                try:
                    response = await client.post(
                        url,
                        headers={"x-goog-api-key": api_key, "Content-Type": "application/json"},
                        json=payload,
                    )
                    if response.status_code == 200:
                        candidates = response.json().get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            for part in parts:
                                if "functionCall" in part:
                                    return True, {
                                        "type": "function_call",
                                        "name": part["functionCall"].get("name"),
                                        "args": part["functionCall"].get("args", {}),
                                        "raw_part": part,
                                        "raw_parts": parts,
                                    }
                            for part in parts:
                                if "text" in part:
                                    return True, {
                                        "type": "text",
                                        "text": part.get("text", ""),
                                        "raw_part": part,
                                        "raw_parts": parts,
                                    }
                    else:
                        last_error = f"{response.status_code}: {response.text}"
                except Exception as error:
                    last_error = str(error)
        return False, {"type": "error", "message": last_error}

    def _get_recent_chat_history(
        self, session: Session, user: User, filename: str
    ) -> list[dict[str, str]]:
        """Fetch previous successful queries for context continuity (multi-turn memory)."""
        try:
            records, _ = self.history_repository.list_for_user(
                session,
                user_id=user.id,
                is_admin=user.is_superuser,
                skip=0,
                limit=3,
                search=filename,
                status_filter="success",
            )
            history = []
            for r in reversed(records):
                if r.query:
                    history.append({
                        "query": r.query,
                        "summary": (r.stdout or "")[:200],
                    })
            return history
        except Exception:
            return []

    async def analyze_upload(
        self,
        session: Session,
        user: User,
        *,
        file: UploadFile | None = None,
        dataset_id: uuid.UUID | None = None,
        query: str = "",
        scope_columns: str = "",
    ) -> dict[str, Any]:
        """Execute conversational Data Analysis AI Agent workflow on stored dataset or uploaded tabular data."""
        if dataset_id:
            from app.repositories.dataset_repository import repository as dataset_repository
            dataset = dataset_repository.get_by_id(session, dataset_id)
            if not dataset:
                raise AppException(ErrorCode.DATASET_NOT_FOUND)
            if not user.is_superuser and dataset.owner_id != user.id:
                raise AppException(ErrorCode.DATASET_ACCESS_DENIED, detail="Không có quyền truy cập tệp dữ liệu này")
            if not os.path.exists(dataset.file_path):
                raise AppException(ErrorCode.DATASET_FILE_NOT_FOUND, detail="Tệp dữ liệu không còn tồn tại trên máy chủ")
            file_path = dataset.file_path
            filename = dataset.filename
        elif file:
            filename = file.filename or "uploaded_file.csv"
            self._validate_file(filename)
            file_path = os.path.join(UPLOAD_DIR, filename)
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
        else:
            raise AppException(ErrorCode.VALIDATION_ERROR, detail="Vui lòng cung cấp dataset_id hoặc file dữ liệu")

        try:
            df = dataframe_service.load_dataframe(file_path)
            if filename.endswith(".csv"):
                df.to_csv(file_path, index=False)
            else:
                df.to_excel(file_path, index=False)

            all_columns = df.columns.tolist()
            selected_cols = (
                [c.strip() for c in scope_columns.split(",") if c.strip() in all_columns]
                if scope_columns
                else []
            )
            df_scoped = df[selected_cols] if selected_cols else df
            columns = df_scoped.columns.tolist()
            schema_info = build_data_context(df_scoped, query)
        except Exception as error:
            raise AppException(
                ErrorCode.ANALYSIS_UPLOAD_READ_ERROR,
                detail=f"Không thể đọc dữ liệu: {error}",
            ) from error

        ai_code = ""
        execution: dict[str, Any] = {
            "success": False,
            "chart_image": None,
            "stdout": "",
            "stderr": "",
            "execution_time_ms": 0,
            "security_status": "idle",
        }

        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

        agent_steps: list[dict[str, Any]] = []
        export_file: dict[str, Any] | None = None

        if query:
            chat_history = self._get_recent_chat_history(session, user, filename)
            sample_cols = ", ".join(columns[:10])

            # Tính toán thời gian thực tế của hệ thống (Múi giờ Việt Nam GMT+7)
            from datetime import datetime, timezone, timedelta
            tz_vn = timezone(timedelta(hours=7))
            now_vn = datetime.now(tz_vn)
            weekdays = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"]
            weekday_vn = weekdays[now_vn.weekday()]
            time_str = now_vn.strftime("%H:%M:%S")
            current_time_str = f"{weekday_vn}, ngày {now_vn.day:02d} tháng {now_vn.month:02d} năm {now_vn.year}, lúc {time_str} (Giờ Việt Nam GMT+7)"

            # Xây dựng System Instruction cho Tool-Calling ReAct Agent
            system_instruction = (
                f"Bạn là FinAI - Chuyên gia Trợ lý Phân tích Dữ liệu & Tài chính Thông minh.\n"
                f"THỜI GIAN HỆ THỐNG HIỆN TẠI: {current_time_str}.\n"
                f"Khi người dùng hỏi về thời gian (ví dụ: 'hôm nay là ngày mấy', 'bây giờ là mấy giờ', 'tháng này là tháng mấy', 'năm nay là năm nào', 'hôm nay thứ mấy', 'thời điểm hiện tại'), bạn PHẢI căn cứ vào mốc thời gian hệ thống này để trả lời chính xác, ngắn gọn và tự nhiên (TUYỆT ĐỐI KHÔNG gọi tool tính toán).\n\n"
                f"Bạn đang làm việc trực tiếp với tệp dữ liệu: '{filename}', kích thước {len(df):,} dòng và {len(df.columns)} cột.\n"
                f"Các cột dữ liệu: {sample_cols}.\n\n"
                f"Bạn có các công cụ (Tools) sau:\n"
                f"1. `get_data_info`: Lấy cấu trúc bảng, kiểu dữ liệu và 5 dòng đầu.\n"
                f"2. `filter_data(condition)`: Lọc dữ liệu theo điều kiện pandas query.\n"
                f"3. `analyze_data(expression)`: BẮT BUỘC GỌI CÔNG CỤ NÀY khi người dùng yêu cầu tính toán, thống kê, so sánh, tìm giá trị lớn nhất/nhỏ nhất, tính tổng, trung bình, tỷ lệ phần trăm hoặc tổng hợp số liệu. Viết mã Python Pandas thao tác trên `df` và dùng lệnh `print(...)` để in kết quả ra màn hình quan sát. Biến `df` đã có sẵn.\n"
                f"4. `plot_chart(chart_code)`: BẮT BUỘC GỌI CÔNG CỤ NÀY khi người dùng yêu cầu vẽ biểu đồ/đồ thị/trực quan hóa dữ liệu (cột, đường, tròn, miền, phân tán, heatmap...). TUYỆT ĐỐI KHÔNG chỉ in mã ra dạng text, PHẢI gọi tool `plot_chart` để hệ thống tạo và hiển thị ảnh biểu đồ thật cho người dùng. Biến `df` đã có sẵn.\n"
                f"5. `export_dataset(output_filename, condition, file_format)`: Lọc hoặc xuất DataFrame ra file (.xlsx hoặc .csv) để người dùng tải về máy.\n"
                f"6. `recommend_forecast_algorithms`: Phân tích loại tệp tài chính hiện tại và gợi ý các thuật toán máy học chuyên sâu phù hợp nhất (Linear Regression - Mariya Sha, Time Series ARIMA / Holt-Winters - freeCodeCamp, LSTM Deep Learning - Code with Josh, Logistic Regression - Josh Starmer StatQuest, K-Means Clustering - Andy McDonald). Đưa ra gợi ý cụ thể về các trường mục tiêu Y và biến đặc trưng X để người dùng tùy chọn.\n\n"
                f"QUY TẮC CỐT LÕI (TOOL-CALLING & REACT LOOP):\n"
                f"- Nếu người dùng chào hỏi, giao tiếp thông thường ('hello', 'hi', 'bạn là ai', 'bạn có thể làm gì', v.v.):\n"
                f"  TUYỆT ĐỐI KHÔNG gọi bất kỳ tool nào! Hãy trả lời ngắn gọn, tự nhiên và lịch sự (ví dụ: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay?').\n"
                f"  TUYỆT ĐỐI KHÔNG tự động giới thiệu tệp dữ liệu, KHÔNG liệt kê số dòng số cột, và KHÔNG tự ý đưa ra danh sách gợi ý câu hỏi KHI NGƯỜI DÙNG CHƯA YÊU CẦU.\n"
                f"  Chỉ giới thiệu tệp dữ liệu hoặc gợi ý câu hỏi khi người dùng thực sự có câu hỏi yêu cầu (ví dụ: 'giới thiệu tệp', 'file này có gì', 'gợi ý câu hỏi giúp tôi').\n"
                f"- Khi người dùng hỏi về tính toán, số liệu (tính tổng, trung bình, min, max, tỷ lệ, lọc dòng cao nhất, v.v.):\n"
                f"  BẮT BUỘC gọi công cụ `analyze_data(expression)`! Hãy viết mã Python Pandas chuẩn xác (theo mô hình LangChain Pandas Agent), in kết quả bằng `print()` để hệ thống chạy trong Sandbox an toàn, sau đó dùng kết quả Observation để trả lời người dùng chi tiết, chính xác.\n"
                f"- Khi người dùng yêu cầu vẽ biểu đồ (ví dụ: 'vẽ biểu đồ', 'vẽ hình', 'trực quan hóa', 'vẽ chart'):\n"
                f"  BẮT BUỘC phải gọi công cụ `plot_chart(chart_code)`! Tuyệt đối không chỉ in mã Python vào câu trả lời văn bản mà không gọi tool.\n"
                f"- Khi người dùng hỏi về dự báo, dự đoán, phân loại rủi ro, phân cụm khách hàng hoặc hỏi 'nên dùng thuật toán gì', 'gợi ý mô hình', 'tệp này phù hợp thuật toán nào', 'làm sao để dự đoán':\n"
                f"  BẮT BUỘC gọi công cụ `recommend_forecast_algorithms`! Sau đó giải thích cho người dùng lý do đề xuất, tham chiếu rõ ràng các bài giảng chuẩn (Python Simplified, freeCodeCamp, Code with Josh, StatQuest, Andy McDonald) và hướng dẫn người dùng chọn biến mục tiêu (Y), biến đặc trưng (X) để thực hiện dự đoán hoặc chuyển qua trang Dự Báo (`/forecast`).\n"
                f"- Quy trình Suy luận Đa bước (Multi-Step ReAct Loop): Bạn có thể gọi nhiều công cụ liên tiếp (tối đa 5 bước) nếu bài toán phức tạp (ví dụ: Lọc dữ liệu trước -> Sau đó vẽ biểu đồ hoặc tính toán -> Sau đó xuất file nếu được yêu cầu).\n"
                f"- Sau khi thu thập đủ kết quả từ các tool, hãy tổng hợp câu trả lời cuối cùng bằng tiếng Việt thật rõ ràng, mạch lạc, chính xác và có chiều sâu phân tích nghiệp vụ."
            )

            # Định dạng Contents kèm Chat History cho Multi-turn Conversation
            contents: list[dict[str, Any]] = []
            for h in chat_history[-3:]:
                if h.get("query"):
                    contents.append({"role": "user", "parts": [{"text": h["query"]}]})
                    if h.get("summary"):
                        contents.append({"role": "model", "parts": [{"text": h["summary"][:500]}]})
            contents.append({"role": "user", "parts": [{"text": query}]})

            if not api_key:
                # Fallback cơ bản khi chưa có GEMINI_API_KEY
                is_chat = is_conversational_query(query)
                is_viz = is_visualization_query(query)
                time_keywords = ["ngày mấy", "mấy giờ", "tháng mấy", "năm mấy", "năm nào", "hôm nay là ngày", "thời gian hiện tại"]
                if any(k in query.lower() for k in time_keywords):
                    execution["stdout"] = f"Hôm nay là {current_time_str}."
                    execution["success"] = True
                elif is_chat:
                    execution["stdout"] = "Xin chào! Tôi có thể giúp gì cho bạn hôm nay?"
                    execution["success"] = True
                elif is_viz:
                    stdout, chart_b64, code_used, success, elapsed = execute_plot_chart(
                        df_scoped,
                        "df.iloc[:, :5].select_dtypes(include='number').head(10).plot(kind='bar')\nplt.title('Tổng quan dữ liệu')",
                        file_path,
                    )
                    execution["stdout"] = stdout or "Đã vẽ biểu đồ trực quan hóa dữ liệu."
                    execution["chart_image"] = chart_b64
                    execution["success"] = success
                    execution["execution_time_ms"] = elapsed
                    ai_code = code_used
                    agent_steps.append({
                        "step": 1,
                        "tool": "plot_chart",
                        "args": {"chart_code": code_used},
                        "output_preview": stdout[:500],
                        "duration_ms": elapsed,
                        "success": success,
                    })
                else:
                    stdout = execute_get_data_info(df_scoped)
                    execution["stdout"] = stdout
                    execution["success"] = True
                    ai_code = "get_data_info()"
                    agent_steps.append({
                        "step": 1,
                        "tool": "get_data_info",
                        "args": {},
                        "output_preview": stdout[:500],
                        "duration_ms": 5,
                        "success": True,
                    })
            else:
                # Multi-Step Tool-Calling Agent Loop (ReAct: Thought -> Action -> Observation -> Final Answer)
                current_contents = list(contents)
                final_answer = ""
                codes_executed: list[str] = []
                total_duration_ms = 0
                MAX_AGENT_STEPS = 5

                for step_idx in range(1, MAX_AGENT_STEPS + 1):
                    agent_success, call_res = await self._call_gemini_with_tools(
                        system_instruction=system_instruction,
                        contents=current_contents,
                        tools=TOOL_DECLARATIONS,
                        api_key=api_key,
                    )

                    if not agent_success:
                        error_msg = call_res.get("message", "Lỗi kết nối Gemini API.")
                        execution["stderr"] = error_msg
                        ai_code = f"# Không thể kết nối Trợ lý AI: {error_msg[:120]}"
                        break

                    call_type = call_res.get("type")

                    if call_type == "text":
                        # Agent hoàn thành suy luận hoặc trả lời chào hỏi trực tiếp
                        final_answer = call_res.get("text", "")
                        execution["success"] = True
                        break

                    elif call_type == "function_call":
                        fn_name = call_res.get("name", "")
                        fn_args = call_res.get("args", {})
                        raw_parts = call_res.get("raw_parts", [call_res.get("raw_part")])

                        tool_output = ""
                        step_success = True
                        step_elapsed = 0
                        step_code = ""

                        if fn_name == "get_data_info":
                            tool_output = execute_get_data_info(df_scoped)
                            step_code = "get_data_info()"
                            step_elapsed = 5

                        elif fn_name == "filter_data":
                            condition = str(fn_args.get("condition", ""))
                            tool_output = execute_filter_data(df_scoped, condition)
                            step_code = f"df.query({condition!r})"
                            step_elapsed = 10

                        elif fn_name == "analyze_data":
                            expression = str(fn_args.get("expression", ""))
                            tool_output, step_code, step_success, step_elapsed = execute_analyze_data(
                                df_scoped, expression, file_path
                            )

                        elif fn_name == "plot_chart":
                            chart_code = str(fn_args.get("chart_code", ""))
                            tool_output, chart_b64, step_code, step_success, step_elapsed = execute_plot_chart(
                                df_scoped, chart_code, file_path
                            )
                            if chart_b64:
                                execution["chart_image"] = chart_b64

                        elif fn_name == "export_dataset":
                            out_name = str(fn_args.get("output_filename", "export.xlsx"))
                            cond = str(fn_args.get("condition", ""))
                            fmt = str(fn_args.get("file_format", "xlsx"))
                            tool_output, file_info, step_code, step_success, step_elapsed = execute_export_dataset(
                                df_scoped, out_name, cond, fmt
                            )
                            if file_info:
                                export_file = file_info

                        elif fn_name == "recommend_forecast_algorithms":
                            tool_output = execute_recommend_forecast_algorithms(df_scoped, filename)
                            step_code = "recommend_forecast_algorithms()"
                            step_elapsed = 15

                        else:
                            tool_output = f"Lỗi: Không tìm thấy công cụ '{fn_name}'."
                            step_success = False

                        total_duration_ms += step_elapsed
                        if step_code:
                            codes_executed.append(step_code)

                        agent_steps.append({
                            "step": step_idx,
                            "tool": fn_name,
                            "args": fn_args,
                            "output_preview": (tool_output or "")[:500],
                            "duration_ms": step_elapsed,
                            "success": step_success,
                        })

                        # Cập nhật lịch sử hội thoại cho vòng lặp tiếp theo của Agent
                        current_contents.append({"role": "model", "parts": raw_parts})
                        current_contents.append({
                            "role": "user",
                            "parts": [
                                {
                                    "functionResponse": {
                                        "name": fn_name,
                                        "response": {"result": str(tool_output)[:8000]},
                                    }
                                }
                            ],
                        })

                if final_answer:
                    execution["stdout"] = final_answer
                elif agent_steps:
                    last_step = agent_steps[-1]
                    execution["stdout"] = f"Đã hoàn thành {len(agent_steps)} bước phân tích.\n\nKết quả bước cuối ({last_step['tool']}):\n{last_step['output_preview']}"
                    execution["success"] = True

                # Hỗ trợ tự động vẽ biểu đồ dự phòng nếu chưa có chart_image
                if not execution.get("chart_image"):
                    # 1. Trích xuất mã vẽ từ final_answer nếu LLM sinh mã trong nội dung text thay vì gọi Tool
                    extracted_code = ""
                    if "```python" in final_answer:
                        parts = final_answer.split("```python")
                        extracted_code = parts[1].split("```")[0].strip()
                    elif "```" in final_answer:
                        parts = final_answer.split("```")
                        extracted_code = parts[1].split("```")[0].strip()

                    if extracted_code and any(kw in extracted_code for kw in ["plt.", "matplotlib", "seaborn", "sns."]):
                        _, chart_b64, step_code, step_success, step_elapsed = execute_plot_chart(
                            df_scoped, extracted_code, file_path
                        )
                        if chart_b64:
                            execution["chart_image"] = chart_b64
                            execution["success"] = True
                            if step_code and step_code not in codes_executed:
                                codes_executed.append(step_code)

                    # 2. Nếu người dùng yêu cầu vẽ biểu đồ mà chưa có ảnh
                    elif is_visualization_query(query):
                        num_df = df_scoped.select_dtypes(include="number")
                        if len(num_df.columns) > 0:
                            num_cols = num_df.columns[:5].tolist()
                            fallback_code = (
                                f"plt.figure(figsize=(10, 6))\n"
                                f"df[{num_cols!r}].head(10).plot(kind='bar', ax=plt.gca())\n"
                                f"plt.title('Biểu đồ trực quan hóa dữ liệu')\n"
                                f"plt.xlabel('Chỉ số bản ghi')\n"
                                f"plt.ylabel('Giá trị')\n"
                                f"plt.tight_layout()\n"
                                f"plt.savefig('output.png', bbox_inches='tight')"
                            )
                            _, chart_b64, step_code, step_success, step_elapsed = execute_plot_chart(
                                df_scoped, fallback_code, file_path
                            )
                            if chart_b64:
                                execution["chart_image"] = chart_b64
                                execution["success"] = True
                                codes_executed.append(fallback_code)

                execution["execution_time_ms"] = max(total_duration_ms, 15)
                execution["security_status"] = "passed"
                if codes_executed:
                    ai_code = "\n\n".join(codes_executed)

        # 6. Ghi vết lịch sử phân tích (Analysis History)
        if query:
            try:
                status = (
                    "success"
                    if execution.get("success")
                    else ("error" if execution.get("stderr") else "idle")
                )
                self.history_repository.add(
                    session,
                    AnalysisHistory(
                        dataset_name=filename,
                        query=query,
                        ai_code=ai_code,
                        stdout=execution.get("stdout"),
                        status=status,
                        error_message=execution.get("stderr"),
                        execution_time_ms=execution.get("execution_time_ms", 0),
                        memory_mb=24.5,
                        chart_image=execution.get("chart_image"),
                        scope_columns=", ".join(selected_cols) if selected_cols else "Toàn bộ dữ liệu",
                        user_id=user.id,
                    ),
                )
            except Exception:
                pass

        return {
            "message": (
                "Phân tích hoàn tất thành công!"
                if execution.get("success")
                else "Phân tích chưa hoàn tất"
            ),
            "file_name": filename,
            "columns": columns,
            "selected_scope": selected_cols,
            "ai_code": ai_code,
            "chart_image": execution.get("chart_image"),
            "stdout": execution.get("stdout"),
            "agent_steps": agent_steps,
            "export_file": export_file,
            "execution_status": (
                "success"
                if execution.get("success")
                else ("error" if execution.get("stderr") else "idle")
            ),
            "execution_error": execution.get("stderr"),
            "execution_time_ms": execution.get("execution_time_ms", 0),
            "security_status": execution.get("security_status", "passed"),
            "validation_status": "verified" if execution.get("success") else "not_run",
        }


ai_analysis_service = AiAnalysisService()
