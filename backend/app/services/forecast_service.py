"""Use case for forecasting a stored dataset and recording its result."""

import os
import time

from sqlmodel import Session

from app.analytics.forecasting import train_and_forecast_series
from app.dto.request.forecast import ForecastRequest
from app.entities.analysis_history import AnalysisHistory
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.analysis_history_repository import analysis_history_repository
from app.repositories.dataset_repository import repository as dataset_repository
from app.services.dataframe_service import dataframe_service


class ForecastService:
    def predict(self, session: Session, user: User, request: ForecastRequest) -> dict:
        started = time.time()
        dataset = dataset_repository.get_by_id(session, request.dataset_id)
        if not dataset:
            raise AppException(ErrorCode.DATASET_NOT_FOUND)
        if not user.is_superuser and dataset.owner_id != user.id:
            raise AppException(ErrorCode.DATASET_ACCESS_DENIED, detail="Không có quyền truy cập tệp dữ liệu này")
        if not os.path.exists(dataset.file_path):
            raise AppException(ErrorCode.DATASET_FILE_NOT_FOUND, detail="Tệp dữ liệu không còn tồn tại trên máy chủ")
        try:
            df = dataframe_service.load_dataframe(dataset.file_path)
        except Exception as error:
            raise AppException(ErrorCode.ANALYSIS_FILE_READ_ERROR, detail=f"Không thể đọc file dữ liệu: {error}") from error
        try:
            result = train_and_forecast_series(
                df=df, target_column=request.target_column, date_column=request.date_column,
                horizon=max(1, min(12, request.horizon)), model_type=request.model_type,
            )
        except Exception as error:
            elapsed = round((time.time() - started) * 1000, 1)
            analysis_history_repository.add(session, AnalysisHistory(
                dataset_name=dataset.filename,
                query=f"Dự báo {request.target_column} ({request.horizon} kỳ - {request.model_type})",
                ai_code=f"# Forecast error: {error}", stdout="", status="error",
                error_message=str(error), execution_time_ms=elapsed, memory_mb=18.5,
                chart_image=None, scope_columns=request.target_column,
                user_id=user.id, dataset_id=dataset.id,
            ))
            raise AppException(ErrorCode.ANALYSIS_ERROR, detail=str(error)) from error

        elapsed = round((time.time() - started) * 1000, 1)
        try:
            analysis_history_repository.add(session, AnalysisHistory(
                dataset_name=dataset.filename,
                query=f"Dự báo {request.target_column} ({request.horizon} kỳ - {request.model_type})",
                ai_code=f"# Thuật toán: {request.model_type}\n# Chỉ tiêu dự báo: {request.target_column}\n# Số kỳ: {request.horizon}\n# R²: {result['metrics']['r2']} | MAE: {result['metrics']['mae']}",
                stdout=result["summary"], status="success", error_message=None,
                execution_time_ms=elapsed, memory_mb=28.4,
                chart_image=result["chart_image"],
                scope_columns=f"{request.target_column}, {request.date_column or 'None'}",
                user_id=user.id, dataset_id=dataset.id,
            ))
        except Exception:
            pass
        return {"status": "success", "dataset_name": dataset.filename, "execution_time_ms": elapsed, "data": result}


forecast_service = ForecastService()
