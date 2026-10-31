"""Dataset use cases: upload, profile, read, clean, download, and delete."""

import json
import uuid
from typing import Any, BinaryIO

import pandas as pd
from sqlmodel import Session

from app.entities.dataset import Dataset
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.dataset_repository import DatasetRepository, repository
from app.services.dataframe_service import dataframe_service
from app.services.dataset_file_storage import DatasetFileStorage, file_storage
from app.services.schema_analysis import (
    ReportBuilder,
    SchemaAnalyzer,
    report_builder as default_report_builder,
    schema_analyzer as default_schema_analyzer,
)
from app.services.schema_analysis.models.column import SemanticType
from app.services.schema_analysis.models.report import SchemaAnalysisResult


def profile_dataset_schema(
    df: pd.DataFrame,
    analysis_result: SchemaAnalysisResult | None = None,
    analysis_report: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Summarize schema, missing data, duplicates, and data health with semantic inference."""
    row_count = int(len(df))
    col_count = int(len(df.columns))
    duplicate_rows = int(df.duplicated().sum())

    total_missing_cells = 0
    total_cells = row_count * col_count if (row_count and col_count) else 1

    schema_col_map = {}
    layout_info = None
    if analysis_result and analysis_result.dataset.sheets:
        first_sheet = analysis_result.dataset.sheets[0]
        layout_info = {
            "type": (
                first_sheet.layout.layout.value
                if hasattr(first_sheet.layout.layout, "value")
                else str(first_sheet.layout.layout)
            ),
            "confidence": first_sheet.layout.confidence,
            "evidence": first_sheet.layout.evidence,
            "reasoning": first_sheet.layout.reasoning,
        }
        for col_schema in first_sheet.columns:
            schema_col_map[col_schema.name] = col_schema
            schema_col_map[f"pos_{col_schema.position}"] = col_schema

    columns_meta = []
    for idx, col in enumerate(df.columns):
        series = df[col]
        missing_count = int(series.isna().sum())
        total_missing_cells += missing_count
        missing_pct = round((missing_count / row_count * 100), 1) if row_count > 0 else 0
        unique_count = int(series.nunique(dropna=True))

        dtype_str = str(series.dtype)
        is_numeric = bool(pd.api.types.is_numeric_dtype(series))
        is_datetime = bool(pd.api.types.is_datetime64_any_dtype(series))

        col_schema = schema_col_map.get(str(col)) or schema_col_map.get(f"pos_{idx}")

        if col_schema:
            if col_schema.semantic_type == SemanticType.CURRENCY:
                type_category = "Số - Tiền tệ (Currency)"
            elif col_schema.semantic_type == SemanticType.PERCENTAGE:
                type_category = "Số - Phần trăm (Percentage)"
            elif col_schema.semantic_type in {SemanticType.DATE, SemanticType.DATETIME, SemanticType.TIME}:
                type_category = "Thời gian (Datetime)"
            elif col_schema.semantic_type == SemanticType.BOOLEAN:
                type_category = "Logic (Boolean)"
            elif col_schema.semantic_type == SemanticType.IDENTIFIER:
                type_category = "Định danh (Identifier)"
            elif col_schema.semantic_type == SemanticType.CATEGORICAL:
                type_category = "Phân loại (Categorical)"
            elif is_numeric or col_schema.semantic_type in {SemanticType.INTEGER, SemanticType.FLOAT}:
                type_category = "Số (Numeric)"
            else:
                type_category = "Văn bản (Text/String)"
        else:
            type_category = "Số (Numeric)" if is_numeric else ("Thời gian (Datetime)" if is_datetime else "Phân loại (Categorical)")

        col_summary: dict[str, Any] = {
            "name": str(col),
            "dtype": dtype_str,
            "type_category": type_category,
            "missing_count": missing_count,
            "missing_percentage": missing_pct,
            "unique_count": unique_count,
            "is_constant": bool(unique_count <= 1 and row_count > 1),
            "sample_values": [str(value) for value in series.dropna().head(3).tolist()],
        }

        if col_schema:
            col_summary["semantic_type"] = (
                col_schema.semantic_type.value
                if hasattr(col_schema.semantic_type, "value")
                else str(col_schema.semantic_type)
            )
            col_summary["semantic_role"] = (
                col_schema.semantic_role.value
                if hasattr(col_schema.semantic_role, "value")
                else str(col_schema.semantic_role)
            )
            col_summary["confidence"] = col_schema.confidence
            col_summary["invalid_count"] = col_schema.invalid_count
            if col_schema.evidence:
                col_summary["evidence"] = col_schema.evidence
            if col_schema.reasoning:
                col_summary["reasoning"] = col_schema.reasoning

        if is_numeric and int(series.dropna().count()) > 0:
            try:
                col_summary["min"] = float(series.min())
                col_summary["max"] = float(series.max())
                col_summary["mean"] = round(float(series.mean()), 2)
                col_summary["median"] = round(float(series.median()), 2)
            except Exception:
                pass

        columns_meta.append(col_summary)

    if analysis_result and analysis_result.quality.health_score is not None:
        health_score = float(analysis_result.quality.health_score)
    else:
        missing_ratio = total_missing_cells / total_cells
        duplicate_ratio = duplicate_rows / row_count if row_count > 0 else 0
        health_score = max(0, min(100, round((1.0 - (missing_ratio * 0.7 + duplicate_ratio * 0.3)) * 100, 1)))

    recommendations: list[str] = []
    if analysis_result and analysis_result.recommendations:
        recommendations.extend(analysis_result.recommendations)

    if duplicate_rows > 0:
        recommendations.append(
            f"Phát hiện {duplicate_rows} dòng dữ liệu bị trùng lặp hoàn toàn, khuyến nghị lọc bỏ để không làm lệch mô hình."
        )
    for column in columns_meta:
        if column["missing_count"] > 0:
            if column["missing_percentage"] > 50:
                recommendations.append(
                    f"Cột '{column['name']}' bị khuyết {column['missing_percentage']}% dữ liệu (>50%), khuyến nghị cân nhắc loại bỏ cột này khi huấn luyện dự báo."
                )
            elif "Số" in column["type_category"]:
                recommendations.append(
                    f"Cột số '{column['name']}' có {column['missing_count']} ô bị trống ({column['missing_percentage']}%), khuyến nghị điền bằng giá trị trung bình ({column.get('mean', 0)}) hoặc trung vị."
                )
            else:
                recommendations.append(
                    f"Cột phân loại '{column['name']}' có {column['missing_count']} ô bị trống, khuyến nghị điền nhãn 'Chưa xác định'."
                )
        if column["is_constant"]:
            recommendations.append(
                f"Cột '{column['name']}' chỉ chứa 1 giá trị duy nhất (hằng số), không mang giá trị thống kê phân tích."
            )

    deduped_recommendations = list(dict.fromkeys(recommendations))
    if not deduped_recommendations:
        deduped_recommendations.append(
            "Cấu trúc dữ liệu hoàn hảo! Không phát hiện bản ghi trùng lặp và không có dữ liệu khuyết thiếu."
        )

    result: dict[str, Any] = {
        "row_count": row_count,
        "column_count": col_count,
        "duplicate_rows": duplicate_rows,
        "total_missing_cells": total_missing_cells,
        "health_score": health_score,
        "columns": columns_meta,
        "recommendations": deduped_recommendations,
    }

    if layout_info:
        result["layout"] = layout_info
    if analysis_report:
        result["schema_analysis"] = analysis_report
        if "issues" in analysis_report:
            result["issues"] = analysis_report["issues"]

    return result


class DatasetService:
    def __init__(
        self,
        dataset_repository: DatasetRepository = repository,
        storage: DatasetFileStorage = file_storage,
        schema_analyzer: SchemaAnalyzer | None = None,
        report_builder: ReportBuilder | None = None,
    ) -> None:
        self.repository = dataset_repository
        self.storage = storage
        self.schema_analyzer = schema_analyzer or default_schema_analyzer
        self.report_builder = report_builder or default_report_builder

    def list_datasets(
        self, session: Session, user: User, *, skip: int, limit: int
    ) -> tuple[list[Dataset], int]:
        return self.repository.list_for_owner(
            session,
            owner_id=user.id,
            is_admin=user.is_superuser,
            skip=skip,
            limit=limit,
        )

    def upload_dataset(
        self,
        session: Session,
        user: User,
        *,
        file_stream: BinaryIO,
        filename: str,
        description: str | None,
    ) -> Dataset:
        file_ext = filename.split(".")[-1].lower() if "." in filename else ""
        if file_ext not in ["csv", "xlsx", "xls"]:
            raise AppException(
                ErrorCode.UNSUPPORTED_FILE_TYPE,
                detail="Định dạng tệp không được hỗ trợ. Vui lòng tải tệp .csv hoặc .xlsx/.xls",
            )

        saved_path, size_bytes = self.storage.save_upload(file_stream, filename)

        try:
            df = dataframe_service.load_dataframe(saved_path)
            if file_ext == "csv":
                df.to_csv(saved_path, index=False)
            else:
                df.to_excel(saved_path, index=False)
            size_bytes = self.storage.size(saved_path)

            post_analysis = None
            post_report = None
            try:
                post_analysis = self.schema_analyzer.analyze(saved_path)
                post_report = self.report_builder.build(post_analysis)
            except Exception:
                pass

            profile = profile_dataset_schema(df, post_analysis, post_report)
            row_count = profile["row_count"]
            column_count = profile["column_count"]
            sample_rows = df.head(10).fillna("").to_dict(orient="records")
            sample_data_json = json.dumps(sample_rows, ensure_ascii=False, default=str)
            schema_info_json = json.dumps(profile, ensure_ascii=False)
            status = "ready"
        except Exception as error:
            status = "error"
            row_count = 0
            column_count = 0
            schema_info_json = json.dumps(
                {"error": str(error), "columns": [], "recommendations": []}
            )
            sample_data_json = json.dumps([])

        existing_dataset = self.repository.get_latest_by_filename(
            session, owner_id=user.id, filename=filename
        )
        version = existing_dataset.version + 1 if existing_dataset else 1

        dataset = Dataset(
            filename=filename,
            file_type=file_ext,
            size_bytes=size_bytes,
            row_count=row_count,
            column_count=column_count,
            version=version,
            status=status,
            description=description,
            schema_info=schema_info_json,
            sample_data=sample_data_json,
            file_path=saved_path,
            owner_id=user.id,
        )
        return self.repository.add(session, dataset)

    def get_dataset(self, session: Session, dataset_id: uuid.UUID, user: User) -> Dataset:
        dataset = self.repository.get_by_id(session, dataset_id)
        if not dataset:
            raise AppException(ErrorCode.DATASET_NOT_FOUND)
        self._ensure_access(dataset, user)
        return dataset

    def get_quality_report(
        self, session: Session, dataset_id: uuid.UUID, user: User
    ) -> dict[str, Any]:
        dataset = self.get_dataset(session, dataset_id, user)
        try:
            profile = json.loads(dataset.schema_info or "{}")
            if "columns" not in profile and isinstance(profile, list):
                profile = {"columns": profile, "health_score": 100, "recommendations": []}
        except Exception:
            profile = {
                "columns": [],
                "health_score": 0,
                "recommendations": ["Lỗi đọc thông tin cấu trúc tệp."],
            }

        return {
            "dataset_id": dataset.id,
            "filename": dataset.filename,
            "version": dataset.version,
            "row_count": dataset.row_count,
            "column_count": dataset.column_count,
            "size_bytes": dataset.size_bytes,
            "status": dataset.status,
            "quality_profile": profile,
            "schema_analysis": profile.get("schema_analysis"),
            "layout": profile.get("layout"),
        }

    def get_schema_analysis(
        self, session: Session, dataset_id: uuid.UUID, user: User
    ) -> dict[str, Any]:
        dataset = self.get_dataset(session, dataset_id, user)
        if not self.storage.exists(dataset.file_path):
            raise AppException(ErrorCode.DATASET_FILE_NOT_FOUND)

        try:
            profile = json.loads(dataset.schema_info or "{}")
            if "schema_analysis" in profile and profile["schema_analysis"]:
                return profile["schema_analysis"]
        except Exception:
            pass

        analysis = self.schema_analyzer.analyze(dataset.file_path)
        return self.report_builder.build(analysis)

    def clean_dataset(
        self, session: Session, dataset_id: uuid.UUID, user: User
    ) -> Dataset:
        dataset = self.get_dataset(session, dataset_id, user)
        if not self.storage.exists(dataset.file_path):
            raise AppException(ErrorCode.DATASET_FILE_NOT_FOUND)

        try:
            # 1. Tiền phân tích lược đồ: nhận diện cấu trúc, layout và kiểu ngữ nghĩa các cột
            col_type_map: dict[str, SemanticType] = {}
            try:
                pre_analysis = self.schema_analyzer.analyze(dataset.file_path)
                if pre_analysis.dataset.sheets:
                    for col in pre_analysis.dataset.sheets[0].columns:
                        col_type_map[col.name] = col.semantic_type
            except Exception:
                col_type_map = {}

            # 2. Đọc DataFrame gốc
            if dataset.file_type == "csv":
                try:
                    df = pd.read_csv(dataset.file_path)
                except UnicodeDecodeError:
                    df = pd.read_csv(dataset.file_path, encoding="latin1")
            else:
                df = pd.read_excel(dataset.file_path)

            # Loại bỏ hoàn toàn các dòng trùng lặp và dòng rỗng
            df = df.drop_duplicates()
            df = df.dropna(how="all")

            # 3. Làm sạch dữ liệu theo kiểu ngữ nghĩa đã nhận diện (Semantic-aware Cleaning)
            for column in df.columns:
                col_name_str = str(column)
                sem_type = col_type_map.get(col_name_str) or col_type_map.get(column)

                is_num = (
                    pd.api.types.is_numeric_dtype(df[column])
                    or sem_type in {
                        SemanticType.INTEGER,
                        SemanticType.FLOAT,
                        SemanticType.CURRENCY,
                        SemanticType.PERCENTAGE,
                    }
                )

                if is_num:
                    if df[column].dtype == object:
                        # Làm sạch ký tự tiền tệ, phần trăm, dấu phẩy ngăn cách
                        cleaned_series = (
                            df[column]
                            .astype(str)
                            .str.replace(r"[^\d.-]", "", regex=True)
                        )
                        df[column] = pd.to_numeric(cleaned_series, errors="coerce")
                    else:
                        df[column] = pd.to_numeric(df[column], errors="coerce")

                    median_val = df[column].median()
                    fill_val = median_val if pd.notna(median_val) else 0
                    if sem_type == SemanticType.INTEGER and pd.notna(fill_val):
                        fill_val = round(fill_val)
                    df[column] = df[column].fillna(fill_val)

                elif sem_type in {SemanticType.DATE, SemanticType.DATETIME}:
                    parsed_dates = pd.to_datetime(df[column], errors="coerce")
                    if parsed_dates.notna().sum() > 0:
                        df[column] = parsed_dates.ffill().bfill()

                elif sem_type == SemanticType.BOOLEAN:
                    def _normalize_bool(val: Any) -> bool:
                        if pd.isna(val):
                            return False
                        s = str(val).strip().casefold()
                        return s in {"true", "yes", "có", "co", "1", "đúng", "y"}

                    df[column] = df[column].map(_normalize_bool)

                else:
                    if df[column].dtype == object:
                        df[column] = df[column].map(
                            lambda x: str(x).strip() if pd.notna(x) and str(x).strip() != "" else "Chưa xác định"
                        )
                    else:
                        df[column] = df[column].fillna("Chưa xác định")

            # 4. Ghi lại dữ liệu đã làm sạch vào tệp
            if dataset.file_type == "csv":
                df.to_csv(dataset.file_path, index=False)
            else:
                df.to_excel(dataset.file_path, index=False)

            # 5. Phân tích lược đồ sau khi làm sạch để cập nhật profile toàn diện
            post_analysis = None
            post_report = None
            try:
                post_analysis = self.schema_analyzer.analyze(dataset.file_path)
                post_report = self.report_builder.build(post_analysis)
            except Exception:
                pass

            profile = profile_dataset_schema(df, post_analysis, post_report)
            dataset.row_count = int(len(df))
            dataset.column_count = int(len(df.columns))
            dataset.size_bytes = self.storage.size(dataset.file_path)
            dataset.schema_info = json.dumps(profile, ensure_ascii=False)
            sample_rows = df.head(10).fillna("").to_dict(orient="records")
            dataset.sample_data = json.dumps(sample_rows, ensure_ascii=False, default=str)
            dataset.status = "ready"

            return self.repository.save(session, dataset)
        except Exception as error:
            raise AppException(
                ErrorCode.DATASET_CLEAN_ERROR,
                detail=f"Lỗi khi làm sạch dữ liệu: {str(error)}",
            )

    def get_downloadable_dataset(
        self, session: Session, dataset_id: uuid.UUID, user: User
    ) -> Dataset:
        dataset = self.get_dataset(session, dataset_id, user)
        if not self.storage.exists(dataset.file_path):
            raise AppException(ErrorCode.DATASET_FILE_NOT_FOUND)
        return dataset

    def delete_dataset(
        self, session: Session, dataset_id: uuid.UUID, user: User
    ) -> None:
        dataset = self.get_dataset(session, dataset_id, user)
        self.storage.delete(dataset.file_path)
        self.repository.delete(session, dataset)

    @staticmethod
    def _ensure_access(dataset: Dataset, user: User) -> None:
        if not user.is_superuser and dataset.owner_id != user.id:
            raise AppException(ErrorCode.DATASET_ACCESS_DENIED)


dataset_service = DatasetService()
