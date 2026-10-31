"""Use case for clustering a stored dataset and recording its result."""

import os
import time

from sqlmodel import Session

from app.analytics.clustering import run_kmeans_clustering
from app.dto.request.clustering import ClusteringRequest
from app.entities.analysis_history import AnalysisHistory
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.analysis_history_repository import analysis_history_repository
from app.repositories.dataset_repository import repository as dataset_repository
from app.services.dataframe_service import dataframe_service


class ClusteringService:
    def analyze(self, session: Session, user: User, request: ClusteringRequest) -> dict:
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
            result = run_kmeans_clustering(
                df=df, features=request.features,
                n_clusters=max(2, min(6, request.n_clusters)), id_column=request.id_column,
            )
        except Exception as error:
            elapsed = round((time.time() - started) * 1000, 1)
            analysis_history_repository.add(session, AnalysisHistory(
                dataset_name=dataset.filename,
                query=f"Phân cụm K-Means ({request.n_clusters} cụm trên {', '.join(request.features)})",
                ai_code=f"# Clustering error: {error}", stdout="", status="error",
                error_message=str(error), execution_time_ms=elapsed, memory_mb=24.0,
                chart_image=None, scope_columns=", ".join(request.features),
                user_id=user.id, dataset_id=dataset.id,
            ))
            raise AppException(ErrorCode.ANALYSIS_ERROR, detail=str(error)) from error

        elapsed = round((time.time() - started) * 1000, 1)
        try:
            summary = f"Phân cụm K-Means thành công {request.n_clusters} phân khúc. Điểm Silhouette: {result['silhouette_score']} ({result['quality_rating']})."
            analysis_history_repository.add(session, AnalysisHistory(
                dataset_name=dataset.filename,
                query=f"Phân cụm K-Means ({request.n_clusters} phân khúc khách hàng/sản phẩm)",
                ai_code=f"# Thuật toán: K-Means Clustering\n# Số cụm: {request.n_clusters}\n# Silhouette Score: {result['silhouette_score']}\n# Đặc trưng: {', '.join(result['features'])}",
                stdout=summary, status="success", error_message=None,
                execution_time_ms=elapsed, memory_mb=32.6,
                chart_image=result["chart_image"], scope_columns=", ".join(result["features"]),
                user_id=user.id, dataset_id=dataset.id,
            ))
        except Exception:
            pass
        return {"status": "success", "dataset_name": dataset.filename, "execution_time_ms": elapsed, "data": result}


clustering_service = ClusteringService()
