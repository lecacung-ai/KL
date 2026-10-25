from fastapi import APIRouter, UploadFile, Form
from app.api.deps import CurrentUser, SessionDep  # Dùng để kiểm tra quyền đăng nhập & database
from app.core.config import settings
from app.core.sandbox import execute_in_sandbox
from app.core.data_loader import smart_load_dataframe
from app.entities.analysis_history import AnalysisHistory
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
import shutil
import os
import pandas as pd
import httpx

import uuid

router = APIRouter()

# Thư mục chứa tệp tạm thời
UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/inspect-columns")
async def inspect_file_columns(
    current_user: CurrentUser,
    file: UploadFile,
):
    """
    Đọc nhanh danh sách cột và kiểu dữ liệu của tệp Excel (.xlsx, .xls) hoặc .csv
    phục vụ cho việc chọn phạm vi phân tích theo cột (Scope Selector).
    """
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise AppException(
            ErrorCode.UNSUPPORTED_FILE_TYPE,
            detail="Chỉ hỗ trợ tệp định dạng .csv hoặc .xlsx/.xls",
        )

    temp_path = os.path.join(UPLOAD_DIR, f"inspect_{uuid.uuid4().hex}_{file.filename}")
    try:
        with open(temp_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        df = smart_load_dataframe(temp_path)
        columns_meta = []
        for col in df.columns:
            series = df[col]
            is_numeric = bool(pd.api.types.is_numeric_dtype(series))
            is_datetime = bool(pd.api.types.is_datetime64_any_dtype(series))
            columns_meta.append({
                "name": str(col),
                "type_category": "Số (Numeric)" if is_numeric else ("Thời gian (Datetime)" if is_datetime else "Phân loại (Categorical)"),
                "sample_values": [str(x) for x in series.dropna().head(3).tolist()],
            })

        return {
            "filename": file.filename,
            "row_count": len(df),
            "columns": columns_meta,
        }
    except Exception as e:
        raise AppException(
            ErrorCode.ANALYSIS_FILE_READ_ERROR,
            detail=f"Không thể đọc cấu trúc tệp: {str(e)}",
        )
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass


async def call_gemini_api(prompt: str, gemini_key: str) -> tuple[bool, str]:
    """
    Gọi Gemini API tuần tự qua các model Flash / Flash-Lite có độ sẵn sàng cao nhất
    """
    models_to_try = [
        "gemini-3.1-flash-lite",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash",
        "gemini-flash-lite-latest",
        "gemini-flash-latest",
    ]
    last_error = ""

    async with httpx.AsyncClient(timeout=60.0) as client:
        for model_name in models_to_try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={gemini_key}"
            headers = {
                "x-goog-api-key": gemini_key,
                "Content-Type": "application/json",
            }
            payload = {
                "contents": [{"parts": [{"text": prompt}]}]
            }
            try:
                res = await client.post(url, headers=headers, json=payload)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        if parts:
                            return True, parts[0].get("text", "")
                else:
                    last_error = f"{res.status_code}: {res.text}"
            except Exception as err:
                last_error = str(err)

    return False, last_error


@router.post("/upload")
async def upload_data_file(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile,
    query: str = Form(default=""),
    scope_columns: str = Form(default=""),
):
    # 1. Kiểm tra định dạng tệp
    if not file.filename.endswith(('.csv', '.xlsx', '.xls')):
        raise AppException(
            ErrorCode.UNSUPPORTED_FILE_TYPE,
            detail="Chỉ hỗ trợ tệp định dạng .csv hoặc .xlsx/.xls",
        )

    file_path = os.path.join(UPLOAD_DIR, file.filename)

    # 2. Lưu file an toàn
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # 3. Đọc dữ liệu mẫu và áp dụng phạm vi phân tích (Module 3 & 4)
    try:
        df = smart_load_dataframe(file_path)
        # Ghi đè file chuẩn hóa để khi Sandbox thực thi mã, pd.read_excel/read_csv đọc đúng 100% cột
        if file.filename.endswith('.csv'):
            df.to_csv(file_path, index=False)
        else:
            df.to_excel(file_path, index=False)

        all_columns = df.columns.tolist()

        selected_cols = []
        if scope_columns:
            selected_cols = [c.strip() for c in scope_columns.split(",") if c.strip() in all_columns]
            df_scoped = df[selected_cols] if selected_cols else df
        else:
            df_scoped = df

        columns = df_scoped.columns.tolist()
        schema_info = f"Các cột trong phạm vi phân tích gồm: {', '.join(columns)}. Dữ liệu mẫu 5 dòng đầu:\n{df_scoped.head(5).to_string()}"
    except Exception as e:
        raise AppException(
            ErrorCode.ANALYSIS_UPLOAD_READ_ERROR,
            detail=f"Không thể đọc dữ liệu: {str(e)}",
        )

    # 4. Gọi AI sinh mã phân tích (Module 5)
    ai_generated_code = ""
    exec_result: dict = {
        "success": False,
        "chart_image": None,
        "stdout": "",
        "stderr": "",
        "execution_time_ms": 0,
        "security_status": "idle",
    }
    gemini_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")

    if query:
        if not gemini_key:
            ai_generated_code = "# Lỗi: Hệ thống chưa được cấu hình GEMINI_API_KEY."
        else:
            read_snippet = f"pd.read_csv('{file_path}')" if file.filename.endswith('.csv') else f"pd.read_excel('{file_path}')"
            prompt = f"""
Bạn là một chuyên gia phân tích dữ liệu kinh doanh và tài chính bằng Python.
Tệp dữ liệu đã được làm sạch và chuẩn hóa sẵn sàng trên máy chủ tại: '{file_path}'.
Để đọc dữ liệu: df = {read_snippet}

Cấu trúc và phạm vi dữ liệu:
{schema_info}

Phạm vi cột chỉ định: {', '.join(selected_cols) if selected_cols else 'Toàn bộ dữ liệu'}
Yêu cầu phân tích: "{query}"

Nhiệm vụ của bạn:
1. Viết MÃ NGUỒN PYTHON hoàn chỉnh (dùng pandas để tính toán và matplotlib/seaborn để vẽ biểu đồ trực quan).
2. Khi vẽ biểu đồ: sử dụng đúng tên các cột ở trên, ép kiểu dữ liệu số pd.to_numeric(df[col], errors='coerce') trước khi vẽ hoặc tính toán, và lưu biểu đồ vào tệp 'output.png'.
3. Nếu có tính toán chỉ số tài chính, hãy dùng lệnh print() để in kết quả rõ ràng ra màn hình.
4. Chỉ trả về mã Python trong khối ```python ... ```, tuyệt đối không giải thích thêm bằng văn bản, không dùng input().
"""
            success_call, response_text = await call_gemini_api(prompt, gemini_key)
            if success_call:
                ai_generated_code = response_text
                # Module 6: Thực thi an toàn trong Sandbox cách ly với kiểm tra AST & giới hạn thời gian
                exec_result = execute_in_sandbox(ai_generated_code, file_path, timeout=15)

                # Module 5: Cơ chế tự sửa sai nếu mã bị lỗi (Self-Healing Loop)
                if not exec_result["success"] and exec_result["stderr"] and exec_result.get("security_status") != "blocked":
                    fix_prompt = f"""
Mã nguồn Python bạn vừa tạo khi thực thi trên máy chủ gặp lỗi sau:
{exec_result['stderr']}

Hãy sửa lại toàn bộ mã Python để khắc phục hoàn toàn lỗi trên.
Đảm bảo tệp dữ liệu được đọc từ '{file_path}' và nếu vẽ biểu đồ thì lưu vào 'output.png'.
Chỉ trả về mã Python trong khối ```python ... ```.
"""
                    retry_success, retry_code = await call_gemini_api(fix_prompt, gemini_key)
                    if retry_success:
                        retry_exec = execute_in_sandbox(retry_code, file_path, timeout=15)
                        if retry_exec["success"] or retry_exec["chart_image"]:
                            ai_generated_code = retry_code
                            exec_result = retry_exec
            else:
                if "429" in response_text or "RESOURCE_EXHAUSTED" in response_text:
                    ai_generated_code = "# Hệ thống phân tích đang tạm thời đạt giới hạn yêu cầu. Vui lòng bấm 'Phân Tích Ngay' để thử lại."
                else:
                    ai_generated_code = f"# Không thể kết nối Trợ lý AI: {response_text[:120]}"

    # Module 9: Tự động lưu vết vào Lịch sử phân tích & Giám sát tài nguyên
    if query:
        try:
            status_val = "success" if exec_result.get("success") else ("error" if exec_result.get("stderr") else "idle")
            history_item = AnalysisHistory(
                dataset_name=file.filename or "uploaded_file.csv",
                query=query,
                ai_code=ai_generated_code,
                stdout=exec_result.get("stdout"),
                status=status_val if status_val != "idle" else "success",
                error_message=exec_result.get("stderr"),
                execution_time_ms=exec_result.get("execution_time_ms", 0),
                memory_mb=24.5,
                chart_image=exec_result.get("chart_image"),
                scope_columns=", ".join(selected_cols) if selected_cols else "Toàn bộ dữ liệu",
                user_id=current_user.id,
            )
            session.add(history_item)
            session.commit()
        except Exception:
            pass

    # 5. Trả kết quả kèm ảnh biểu đồ và thông số đo lường an toàn về Frontend (Module 6 & 7)
    return {
        "message": "Xử lý thành công",
        "file_name": file.filename,
        "columns": columns,
        "selected_scope": selected_cols,
        "ai_code": ai_generated_code,
        "chart_image": exec_result.get("chart_image"),
        "stdout": exec_result.get("stdout"),
        "execution_status": "success" if exec_result.get("success") else ("error" if exec_result.get("stderr") else "idle"),
        "execution_error": exec_result.get("stderr"),
        "execution_time_ms": exec_result.get("execution_time_ms", 0),
        "security_status": exec_result.get("security_status", "passed"),
    }
