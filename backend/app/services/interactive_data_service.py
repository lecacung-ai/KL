"""Interactive Data Service for guided Excel/CSV inspection, header resolution,
multi-table region selection, and missing cell corrections.
"""

import json
import logging
import os
import uuid
from typing import TYPE_CHECKING, Any

import numpy as np
import openpyxl
import pandas as pd

if TYPE_CHECKING:
    from sqlmodel import Session
    from app.entities.dataset import Dataset
    from app.entities.user import User

from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.services.dataframe_service import dataframe_service
from app.services.dataset_file_storage import DatasetFileStorage
from app.services.schema_analysis import report_builder, schema_analyzer
from app.services.schema_analysis.table_extractor.header_detector import header_detector
from app.services.schema_analysis.table_extractor.layout_classifier import layout_classifier
from app.services.schema_analysis.table_extractor.models import HeaderType
from app.services.schema_analysis.table_extractor.region_extractor import table_region_extractor

logger = logging.getLogger(__name__)


class InteractiveDataService:
    """Service providing interactive workbook inspection and user-guided data cleaning."""

    def __init__(
        self,
        repository: Any = None,
        storage: DatasetFileStorage | None = None,
    ) -> None:
        self._repository = repository
        self.storage = storage or DatasetFileStorage()

    @property
    def repository(self) -> Any:
        if self._repository is None:
            from app.repositories.dataset_repository import dataset_repository
            self._repository = dataset_repository
        return self._repository

    @staticmethod
    def _suggest_column_names(series: pd.Series, col_idx: int) -> list[str]:
        """Generate smart Vietnamese business column name suggestions based on data heuristics."""
        clean = series.dropna()
        if clean.empty:
            return [f"Cột_{col_idx + 1}", "Ghi_Chú", "Mô_Tả"]

        sample_str = " ".join(clean.astype(str).head(10)).lower()

        # 1. Check numeric
        if pd.api.types.is_numeric_dtype(clean) or all(
            isinstance(v, (int, float, np.number)) and not isinstance(v, bool)
            for v in clean.head(10)
        ):
            num_clean = pd.to_numeric(clean, errors="coerce").dropna()
            if not num_clean.empty:
                mean_val = float(num_clean.mean())
                min_val = float(num_clean.min())
                max_val = float(num_clean.max())
                if min_val >= 2000 and max_val <= 2050:
                    return ["Năm", "Niên_Độ", "Năm_Tài_Chính", "Kỳ_Kế_Toán"]
                if min_val >= 1 and max_val <= 12 and (num_clean % 1 == 0).all():
                    return ["Tháng", "Quý", "Thứ_Tự", "Mã_Số"]
                if mean_val > 1000:
                    return ["Số_Tiền", "Doanh_Thu", "Chi_Phí", "Giá_Bán", "Lợi_Nhuận"]
                return ["Số_Lượng", "Chỉ_Tiêu", "Định_Mức", f"Chỉ_Số_{col_idx + 1}"]

        # 2. Check date
        first_val = clean.iloc[0]
        if isinstance(first_val, str) and any(sep in str(first_val) for sep in ["-", "/", "."]):
            try:
                pd.to_datetime(clean.head(5), errors="raise", format="mixed")
                return ["Ngày_Giao_Dịch", "Ngày", "Thời_Gian", "Kỳ_Báo_Cáo"]
            except Exception:
                pass

        # 3. Check business string patterns
        if any(k in sample_str for k in ["corp", "inc", "ltd", "công ty", "tnhh", "cp", "doanh nghiệp"]):
            return ["Công_Ty", "Tên_Khách_Hàng", "Đối_Tác", "Doanh_Nghiệp"]
        if any(k in sample_str for k in ["bắc", "nam", "hà nội", "hcm", "đà nẵng", "miền", "khu vực"]):
            return ["Khu_Vực", "Chi_Nhánh", "Địa_Bàn", "Thị_Trường"]
        if any(k in sample_str for k in ["nv", "sp", "kh", "hd", "id", "code", "mã"]):
            return ["Mã_Định_Danh", "Mã_Khách_Hàng", "Mã_Sản_Phẩm", "Mã_Đơn_Hàng"]

        return ["Tên_Đối_Tượng", "Mô_Tả", "Phân_Loại", f"Thuộc_Tính_{col_idx + 1}"]

    @staticmethod
    def _compute_fill_suggestions(series: pd.Series) -> dict[str, Any]:
        """Compute statistical and heuristic fill values for missing cells."""
        clean = series.dropna()
        suggestions: dict[str, Any] = {}
        if clean.empty:
            suggestions["placeholder"] = "Chưa xác định"
            return suggestions

        if pd.api.types.is_numeric_dtype(clean) or all(
            isinstance(v, (int, float, np.number)) and not isinstance(v, bool)
            for v in clean.head(10)
        ):
            num_clean = pd.to_numeric(clean, errors="coerce").dropna()
            if not num_clean.empty:
                suggestions["mean"] = round(float(num_clean.mean()), 2)
                suggestions["median"] = round(float(num_clean.median()), 2)
                suggestions["zero"] = 0
        else:
            try:
                mode_val = clean.mode().iloc[0] if not clean.mode().empty else "Chưa xác định"
                suggestions["mode"] = str(mode_val)
            except Exception:
                pass
            suggestions["placeholder"] = "Chưa xác định"

        return suggestions

    def inspect_file_for_interaction(self, file_path: str, filename: str) -> dict[str, Any]:
        """
        Scan and extract structured interactive metadata across all sheets, sub-tables,
        header structures, missing cells, and smart column recommendations.
        """
        ext = os.path.splitext(filename)[1].lower()
        if ext not in [".xlsx", ".xls", ".csv"]:
            raise AppException(
                ErrorCode.UNSUPPORTED_FILE_TYPE,
                detail=f"Định dạng tệp '{ext}' không được hỗ trợ. Vui lòng tải .xlsx, .xls hoặc .csv",
            )

        sheets_meta: list[dict[str, Any]] = []

        if ext == ".csv":
            raw_df = dataframe_service.load_dataframe(file_path)
            sheet_meta = self._inspect_single_sheet(
                df_raw=raw_df,
                sheet_name="Sheet1",
                sheet_index=0,
                is_csv=True,
            )
            sheets_meta.append(sheet_meta)
        else:
            # Excel inspection
            try:
                wb = openpyxl.load_workbook(file_path, read_only=True, data_only=True)
                sheet_names = wb.sheetnames
                wb.close()
            except Exception as e:
                logger.warning(f"Could not read sheets via openpyxl: {e}. Fallback to pandas ExcelFile.")
                excel_file = pd.ExcelFile(file_path)
                sheet_names = excel_file.sheet_names

            for s_idx, s_name in enumerate(sheet_names):
                try:
                    df_raw = pd.read_excel(file_path, sheet_name=s_name, header=None)
                except Exception as read_err:
                    logger.error(f"Error reading sheet {s_name}: {read_err}")
                    continue

                sheet_meta = self._inspect_single_sheet(
                    df_raw=df_raw,
                    sheet_name=s_name,
                    sheet_index=s_idx,
                    is_csv=False,
                )
                sheets_meta.append(sheet_meta)

        return {
            "filename": filename,
            "file_type": ext.replace(".", ""),
            "total_sheets": len(sheets_meta),
            "sheets": sheets_meta,
        }

    def _inspect_single_sheet(
        self,
        df_raw: pd.DataFrame,
        sheet_name: str,
        sheet_index: int,
        is_csv: bool = False,
    ) -> dict[str, Any]:
        """Deep analysis of a single worksheet for interactive guidance."""
        if df_raw.empty or df_raw.shape[0] == 0 or df_raw.shape[1] == 0:
            return {
                "name": sheet_name,
                "index": sheet_index,
                "is_empty": True,
                "row_count": 0,
                "column_count": 0,
                "has_header": False,
                "header_type": HeaderType.NO_HEADER.value,
                "layout": "unknown",
                "table_regions": [],
                "columns": [],
                "missing_summary": {"total_missing": 0, "affected_rows": 0, "columns": []},
                "missing_cells": [],
                "sample_data": [],
            }

        # 1. Header Detection
        h_res = header_detector.detect(df_raw)
        has_header = h_res.header_type in [
            HeaderType.SINGLE_ROW_HEADER,
            HeaderType.MULTI_ROW_HEADER,
        ]
        header_row_idx = h_res.header_end_row if has_header else None

        # 2. Layout & Multi-table Extraction
        region_res = table_region_extractor.extract_regions(
            df_raw,
            sheet_name=sheet_name,
            sheet_index=sheet_index,
        )
        layout_type = layout_classifier.classify_table(df_raw, h_res)
        is_multi_table = len(region_res.table_regions) > 1

        # 3. Determine active columns and data rows
        if has_header and header_row_idx is not None:
            active_cols = list(h_res.column_names)
            # Fill missing column names
            while len(active_cols) < df_raw.shape[1]:
                active_cols.append(f"Column_{len(active_cols) + 1}")
            df_data = df_raw.iloc[header_row_idx + 1 :].copy().reset_index(drop=True)
            df_data.columns = active_cols[: df_raw.shape[1]]
        else:
            active_cols = [f"Column_{i + 1}" for i in range(df_raw.shape[1])]
            df_data = df_raw.copy()
            df_data.columns = active_cols

        # 4. Analyze Missing Cells & Empty Rows
        empty_rows: list[int] = []
        missing_cells: list[dict[str, Any]] = []
        columns_missing_map: dict[str, int] = {c: 0 for c in active_cols}

        for r_idx, row in df_data.iterrows():
            row_is_empty = True
            row_missing_in_cols = []
            for c_idx, col_name in enumerate(active_cols):
                val = row[col_name]
                is_missing = pd.isna(val) or val == "" or str(val).strip().lower() in ["nan", "none", "null"]
                if not is_missing:
                    row_is_empty = False
                else:
                    row_missing_in_cols.append((c_idx, col_name))
                    columns_missing_map[col_name] += 1

            if row_is_empty:
                empty_rows.append(int(r_idx))
            else:
                for c_idx, col_name in row_missing_in_cols:
                    context = {
                        k: str(v) if pd.notna(v) else ""
                        for k, v in row.items()
                        if pd.notna(v) and str(v).strip()
                    }
                    missing_cells.append({
                        "row_index": int(r_idx),
                        "column_index": int(c_idx),
                        "column_name": col_name,
                        "row_context": context,
                    })

        total_missing = sum(columns_missing_map.values())
        affected_rows = len({m["row_index"] for m in missing_cells})

        # 5. Column metadata & Smart Suggestions
        columns_meta: list[dict[str, Any]] = []
        for c_idx, col_name in enumerate(active_cols):
            series = df_data[col_name]
            clean_series = series.dropna()
            clean_count = len(clean_series)
            missing_count = columns_missing_map.get(col_name, 0)
            missing_pct = round((missing_count / max(1, len(df_data))) * 100, 1)

            # Type categorization
            is_numeric = bool(pd.api.types.is_numeric_dtype(clean_series))
            is_datetime = False
            if not is_numeric and clean_count > 0:
                first_val = str(clean_series.iloc[0])
                if any(sep in first_val for sep in ["-", "/", "."]):
                    try:
                        pd.to_datetime(clean_series.head(5), errors="raise", format="mixed")
                        is_datetime = True
                    except Exception:
                        pass

            type_category = "Số (Numeric)" if is_numeric else ("Thời gian (Datetime)" if is_datetime else "Phân loại (Categorical)")
            suggestions = self._suggest_column_names(series, c_idx)
            fill_suggestions = self._compute_fill_suggestions(series)

            columns_meta.append({
                "name": col_name,
                "index": c_idx,
                "dtype": str(series.dtype),
                "type_category": type_category,
                "sample_values": [str(x) for x in clean_series.head(4).tolist()],
                "missing_count": missing_count,
                "missing_percentage": missing_pct,
                "suggestions": suggestions,
                "fill_suggestions": fill_suggestions,
            })

        # 6. Table Regions (if multiple tables detected)
        regions_list: list[dict[str, Any]] = []
        for reg in region_res.table_regions:
            reg_df = df_raw.iloc[reg.start_row : reg.end_row + 1, reg.start_column : reg.end_column + 1]
            sample_reg = reg_df.head(5).fillna("").to_dict(orient="records")
            regions_list.append({
                "table_id": reg.table_id,
                "range": reg.range,
                "start_row": reg.start_row,
                "end_row": reg.end_row,
                "start_column": reg.start_column,
                "end_column": reg.end_column,
                "row_count": reg.end_row - reg.start_row + 1,
                "column_count": reg.end_column - reg.start_column + 1,
                "header_type": reg.header_info.header_type.value,
                "columns": reg.header_info.column_names,
                "layout_type": reg.layout_type.value,
                "sample_data": sample_reg,
            })

        # 7. Sample Preview Rows (First 15 rows)
        sample_preview = (
            df_data.head(15).fillna("").to_dict(orient="records")
        )

        return {
            "name": sheet_name,
            "index": sheet_index,
            "is_empty": False,
            "row_count": len(df_data),
            "column_count": len(active_cols),
            "has_header": has_header,
            "header_type": h_res.header_type.value,
            "header_row_index": header_row_idx,
            "layout": "multi_table" if is_multi_table else layout_type.value,
            "is_multi_table": is_multi_table,
            "table_regions": regions_list,
            "columns": columns_meta,
            "empty_rows": empty_rows,
            "missing_summary": {
                "total_missing": total_missing,
                "affected_rows": affected_rows,
                "empty_rows_count": len(empty_rows),
                "columns_with_missing": [
                    c for c in columns_meta if c["missing_count"] > 0
                ],
            },
            "missing_cells": missing_cells[:100],  # Return up to 100 missing cells for UI
            "sample_data": sample_preview,
        }

    def apply_interactive_transformations_and_save(
        self,
        session: "Session",
        user: "User",
        *,
        file_path: str,
        filename: str,
        config: dict[str, Any],
        description: str | None = None,
    ) -> "Dataset":
        """
        Apply user's interactive choices (sheet, table region, header, column renames,
        missing cell fills/drops), create cleaned dataset and store into DB.
        """
        from app.entities.dataset import Dataset
        from app.services.dataset_service import profile_dataset_schema

        ext = os.path.splitext(filename)[1].lower()
        sheet_name = config.get("selected_sheet")
        selected_table_id = config.get("selected_table_id")
        header_mode = config.get("header_mode", "detected")
        custom_header_row = config.get("header_row_index")
        column_renames: dict[str, str] = config.get("column_renames", {})
        cell_fixes: list[dict[str, Any]] = config.get("cell_fixes", [])
        column_fills: dict[str, Any] = config.get("column_fills", {})
        drop_empty_rows = config.get("drop_empty_rows", True)
        drop_any_missing_rows = config.get("drop_any_missing_rows", False)

        # 1. Load Raw DataFrame for chosen sheet
        if ext == ".csv":
            df = dataframe_service.load_dataframe(file_path)
        else:
            actual_sheet = sheet_name if sheet_name is not None else 0
            df_raw = pd.read_excel(file_path, sheet_name=actual_sheet, header=None)

            # If user selected a specific sub-table from a multi-table sheet
            if selected_table_id:
                regions = table_region_extractor.extract_regions(df_raw, sheet_name=str(actual_sheet))
                matched = next((r for r in regions.table_regions if r.table_id == selected_table_id), None)
                if matched:
                    df_raw = df_raw.iloc[matched.start_row : matched.end_row + 1, matched.start_column : matched.end_column + 1].reset_index(drop=True)

            # Handle Header Setup
            if header_mode == "custom_row" and custom_header_row is not None:
                header_idx = int(custom_header_row)
                cols = df_raw.iloc[header_idx].tolist()
                df = df_raw.iloc[header_idx + 1 :].copy().reset_index(drop=True)
                df.columns = [str(c).strip() if pd.notna(c) and str(c).strip() else f"Column_{i+1}" for i, c in enumerate(cols)]
            elif header_mode == "no_header":
                df = df_raw.copy().reset_index(drop=True)
                df.columns = [f"Column_{i + 1}" for i in range(df.shape[1])]
            else:
                # Detected header
                h_res = header_detector.detect(df_raw)
                if h_res.header_type in [HeaderType.SINGLE_ROW_HEADER, HeaderType.MULTI_ROW_HEADER] and h_res.header_end_row is not None:
                    cols = h_res.column_names
                    df = df_raw.iloc[h_res.header_end_row + 1 :].copy().reset_index(drop=True)
                    while len(cols) < df.shape[1]:
                        cols.append(f"Column_{len(cols) + 1}")
                    df.columns = cols[: df.shape[1]]
                else:
                    df = df_raw.copy().reset_index(drop=True)
                    df.columns = [f"Column_{i + 1}" for i in range(df.shape[1])]

        # 2. Drop completely blank rows if requested
        if drop_empty_rows:
            df = df.dropna(how="all").reset_index(drop=True)

        # 3. Apply Column Renames (from smart quiz/suggestions or user input)
        if column_renames:
            df = df.rename(columns=column_renames)

        # 4. Apply Column Fills (Mean, Median, Mode, Zero, Placeholder, Custom)
        for col, strategy in column_fills.items():
            if col not in df.columns:
                continue
            if strategy == "mean":
                m = pd.to_numeric(df[col], errors="coerce").mean()
                if pd.notna(m):
                    df[col] = df[col].fillna(round(float(m), 2))
            elif strategy == "median":
                med = pd.to_numeric(df[col], errors="coerce").median()
                if pd.notna(med):
                    df[col] = df[col].fillna(round(float(med), 2))
            elif strategy == "zero":
                df[col] = df[col].fillna(0)
            elif strategy == "mode":
                clean = df[col].dropna()
                if not clean.empty and not clean.mode().empty:
                    df[col] = df[col].fillna(clean.mode().iloc[0])
            elif strategy == "placeholder":
                df[col] = df[col].fillna("Chưa xác định")
            elif strategy == "ffill":
                df[col] = df[col].ffill()
            elif isinstance(strategy, (int, float, str)):
                df[col] = df[col].fillna(strategy)

        # 5. Apply Explicit Cell Fixes (User typed specific values into individual cells)
        for fix in cell_fixes:
            r = fix.get("row")
            c = fix.get("col")
            val = fix.get("value")
            if r is not None and c is not None and c in df.columns and 0 <= int(r) < len(df):
                df.at[int(r), c] = val

        # 6. Drop any remaining missing rows if requested
        if drop_any_missing_rows:
            df = df.dropna().reset_index(drop=True)

        # 7. Persist Cleaned Data as a new file in storage
        clean_ext = ".xlsx" if ext in [".xlsx", ".xls"] else ".csv"
        clean_filename = f"cleaned_{filename}"
        if not clean_filename.endswith(clean_ext):
            clean_filename = f"{clean_filename}{clean_ext}"

        from io import BytesIO
        output_buffer = BytesIO()
        if clean_ext == ".xlsx":
            df.to_excel(output_buffer, index=False)
        else:
            df.to_csv(output_buffer, index=False, encoding="utf-8-sig")

        output_buffer.seek(0)
        saved_path, size_bytes = self.storage.save_upload(output_buffer, clean_filename)

        # 8. Profile schema for dataset metadata
        post_analysis = None
        post_report = None
        try:
            post_analysis = schema_analyzer.analyze(saved_path)
            post_report = report_builder.build(post_analysis)
        except Exception as e:
            logger.warning(f"Error profiling cleaned dataset: {e}")

        profile = profile_dataset_schema(df, post_analysis, post_report)
        profile["interactive_cleaning_applied"] = {
            "sheet": sheet_name,
            "table_id": selected_table_id,
            "renamed_columns": column_renames,
            "cell_fixes_count": len(cell_fixes),
            "column_fills": column_fills,
        }

        row_count = int(len(df))
        column_count = int(len(df.columns))
        sample_rows = df.head(10).fillna("").to_dict(orient="records")
        sample_data_json = json.dumps(sample_rows, ensure_ascii=False, default=str)
        schema_info_json = json.dumps(profile, ensure_ascii=False)

        existing_dataset = self.repository.get_latest_by_filename(
            session, owner_id=user.id, filename=clean_filename
        )
        version = existing_dataset.version + 1 if existing_dataset else 1

        dataset = Dataset(
            filename=clean_filename,
            file_type=clean_ext.replace(".", ""),
            size_bytes=size_bytes,
            row_count=row_count,
            column_count=column_count,
            version=version,
            status="ready",
            description=description or f"Tệp đã chuẩn hóa tương tác từ '{filename}'",
            schema_info=schema_info_json,
            sample_data=sample_data_json,
            file_path=saved_path,
            owner_id=user.id,
        )
        return self.repository.add(session, dataset)


interactive_data_service = InteractiveDataService()
