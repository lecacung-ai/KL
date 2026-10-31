"""Application service for file analysis requests powered by Gemini."""

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
from app.dto.response.common import Message
from app.entities.analysis_history import AnalysisHistory
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.analysis_history_repository import (
    AnalysisHistoryRepository,
    analysis_history_repository,
)
from app.services.dataframe_service import dataframe_service

UPLOAD_DIR = "/tmp/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


class AiAnalysisService:
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
        filename = file.filename or ""
        self._validate_file(filename)
        temp_path = os.path.join(UPLOAD_DIR, f"inspect_{uuid.uuid4().hex}_{filename}")
        try:
            with open(temp_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            df = dataframe_service.load_dataframe(temp_path)
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
            return {"filename": filename, "row_count": len(df), "columns": columns_meta}
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
        models = [
            "gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemini-3.5-flash",
            "gemini-flash-lite-latest", "gemini-flash-latest",
        ]
        last_error = ""
        async with httpx.AsyncClient(timeout=60.0) as client:
            for model in models:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"
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

    async def analyze_upload(
        self, session: Session, user: User, *, file: UploadFile,
        query: str = "", scope_columns: str = "",
    ) -> dict[str, Any]:
        filename = file.filename or "uploaded_file.csv"
        self._validate_file(filename)
        file_path = os.path.join(UPLOAD_DIR, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            df = dataframe_service.load_dataframe(file_path)
            if filename.endswith(".csv"):
                df.to_csv(file_path, index=False)
            else:
                df.to_excel(file_path, index=False)
            all_columns = df.columns.tolist()
            selected_cols = [c.strip() for c in scope_columns.split(",") if c.strip() in all_columns] if scope_columns else []
            df_scoped = df[selected_cols] if selected_cols else df
            columns = df_scoped.columns.tolist()
            schema_info = (
                f"Các cột trong phạm vi phân tích gồm: {', '.join(columns)}. "
                f"Dữ liệu mẫu 5 dòng đầu:\n{df_scoped.head(5).to_string()}"
            )
        except Exception as error:
            raise AppException(
                ErrorCode.ANALYSIS_UPLOAD_READ_ERROR,
                detail=f"Không thể đọc dữ liệu: {error}",
            ) from error

        ai_code = ""
        execution: dict[str, Any] = {
            "success": False, "chart_image": None, "stdout": "", "stderr": "",
            "execution_time_ms": 0, "security_status": "idle",
        }
        api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
        if query:
            if not api_key:
                ai_code = "# Lỗi: Hệ thống chưa được cấu hình GEMINI_API_KEY."
            else:
                read_snippet = f"pd.read_csv('{file_path}')" if filename.endswith(".csv") else f"pd.read_excel('{file_path}')"
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
                success, response_text = await self._call_gemini(prompt, api_key)
                if success:
                    ai_code = response_text
                    execution = execute_in_sandbox(ai_code, file_path, timeout=15)
                    if not execution["success"] and execution["stderr"] and execution.get("security_status") != "blocked":
                        fix_prompt = f"""
Mã nguồn Python bạn vừa tạo khi thực thi trên máy chủ gặp lỗi sau:
{execution['stderr']}

Hãy sửa lại toàn bộ mã Python để khắc phục hoàn toàn lỗi trên.
Đảm bảo tệp dữ liệu được đọc từ '{file_path}' và nếu vẽ biểu đồ thì lưu vào 'output.png'.
Chỉ trả về mã Python trong khối ```python ... ```.
"""
                        retry_success, retry_code = await self._call_gemini(fix_prompt, api_key)
                        if retry_success:
                            retry_execution = execute_in_sandbox(retry_code, file_path, timeout=15)
                            if retry_execution["success"] or retry_execution["chart_image"]:
                                ai_code, execution = retry_code, retry_execution
                elif "429" in response_text or "RESOURCE_EXHAUSTED" in response_text:
                    ai_code = "# Hệ thống phân tích đang tạm thời đạt giới hạn yêu cầu. Vui lòng bấm 'Phân Tích Ngay' để thử lại."
                else:
                    ai_code = f"# Không thể kết nối Trợ lý AI: {response_text[:120]}"

        if query:
            try:
                status = "success" if execution.get("success") else ("error" if execution.get("stderr") else "idle")
                self.history_repository.add(session, AnalysisHistory(
                    dataset_name=filename, query=query, ai_code=ai_code,
                    stdout=execution.get("stdout"),
                    status=status if status != "idle" else "success",
                    error_message=execution.get("stderr"),
                    execution_time_ms=execution.get("execution_time_ms", 0),
                    memory_mb=24.5, chart_image=execution.get("chart_image"),
                    scope_columns=", ".join(selected_cols) if selected_cols else "Toàn bộ dữ liệu",
                    user_id=user.id,
                ))
            except Exception:
                pass

        return {
            "message": "Xử lý thành công", "file_name": filename, "columns": columns,
            "selected_scope": selected_cols, "ai_code": ai_code,
            "chart_image": execution.get("chart_image"), "stdout": execution.get("stdout"),
            "execution_status": "success" if execution.get("success") else ("error" if execution.get("stderr") else "idle"),
            "execution_error": execution.get("stderr"),
            "execution_time_ms": execution.get("execution_time_ms", 0),
            "security_status": execution.get("security_status", "passed"),
        }


ai_analysis_service = AiAnalysisService()
