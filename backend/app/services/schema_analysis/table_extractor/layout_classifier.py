"""Structural Layout Classifier for individual table regions and full worksheets."""

import logging
from typing import Any

import pandas as pd

from app.services.schema_analysis.models.layout import DataLayout
from app.services.schema_analysis.table_extractor.models import (
    HeaderDetectionResult,
    TableRegion,
)

logger = logging.getLogger(__name__)


class LayoutClassifier:
    """Classifies structural layout of table regions and whole worksheets."""

    REPORT_KEYWORDS = (
        "báo cáo",
        "tổng cộng",
        "tổng",
        "cộng",
        "ghi chú",
        "kính gửi",
        "người lập biểu",
        "giám đốc",
        "report",
        "total",
        "subtotal",
        "grand total",
        "summary",
    )

    TRANSPOSED_KEYWORDS = (
        "chỉ tiêu",
        "thuộc tính",
        "metric",
        "attribute",
        "tiêu chí",
        "biến số",
        "field",
    )

    def classify_table(
        self,
        dataframe: pd.DataFrame,
        header_info: HeaderDetectionResult,
    ) -> DataLayout:
        """Classify the structural layout of a single isolated table region."""
        if dataframe.empty or dataframe.shape[0] < 1 or dataframe.shape[1] < 1:
            return DataLayout.UNKNOWN

        rows, cols = dataframe.shape

        # Count total non-empty cells
        total_cells = rows * cols
        non_empty_count = sum(
            not self._is_missing(v)
            for v in dataframe.to_numpy().flatten()
        )
        density = non_empty_count / max(total_cells, 1)

        # If data is extremely sparse or fewer than 2 data cells, it cannot form a recognizable layout
        if non_empty_count < 2 or (total_cells >= 4 and density < 0.4):
            return DataLayout.UNKNOWN

        # 1. KEY_VALUE Check: Exactly 2 columns
        if cols == 2 and rows >= 2:
            col1 = dataframe.iloc[:, 0]
            col2 = dataframe.iloc[:, 1]
            non_empty1 = [v for v in col1 if not self._is_missing(v)]
            non_empty2 = [v for v in col2 if not self._is_missing(v)]
            if non_empty1 and non_empty2:
                text_ratio1 = sum(self._is_text(v) for v in non_empty1) / len(non_empty1)
                unique_ratio1 = len(set(str(v).casefold() for v in non_empty1)) / len(non_empty1)
                if text_ratio1 >= 0.7 and unique_ratio1 >= 0.7:
                    return DataLayout.KEY_VALUE

        # 2. Check for explicit TRANSPOSED layout:
        # If the corner cell (0, 0) explicitly names "Chỉ tiêu", "Metric", etc.
        corner_val = str(dataframe.iloc[0, 0]).strip().lower() if not self._is_missing(dataframe.iloc[0, 0]) else ""
        has_transposed_corner = any(k in corner_val for k in self.TRANSPOSED_KEYWORDS)

        if has_transposed_corner and rows >= 2 and cols >= 3:
            first_col = dataframe.iloc[:, 0]
            first_non_empty = [v for v in first_col if not self._is_missing(v)]
            if first_non_empty:
                label_ratio = sum(self._is_text(v) for v in first_non_empty) / len(first_non_empty)
                if label_ratio >= 0.6:
                    return DataLayout.TRANSPOSED

        # 3. CROSSTAB Check (Pivot Table: Top row is dimension 1, first column is dimension 2)
        if rows >= 3 and cols >= 3:
            is_crosstab = self._check_crosstab(dataframe, header_info)
            if is_crosstab:
                return DataLayout.CROSSTAB

        # 4. General TRANSPOSED Check (First column is attribute names, remaining columns are instances/time)
        if rows >= 2 and cols >= 3:
            first_col = dataframe.iloc[:, 0]
            first_non_empty = [v for v in first_col if not self._is_missing(v)]
            if first_non_empty:
                label_ratio = sum(self._is_text(v) for v in first_non_empty) / len(first_non_empty)
                unique_ratio = len(set(str(v).casefold() for v in first_non_empty)) / len(first_non_empty)

                body_vals = [
                    v
                    for v in dataframe.iloc[:, 1:].to_numpy().flatten()
                    if not self._is_missing(v)
                ]
                if body_vals:
                    numeric_body_ratio = sum(self._looks_like_number(v) for v in body_vals) / len(body_vals)
                    has_date_in_first_col = any(
                        any(sep in str(v) for sep in ["-", "/"])
                        and any(ch.isdigit() for ch in str(v))
                        and pd.notna(pd.to_datetime(str(v), errors="coerce"))
                        for v in first_non_empty
                    )
                    if not has_date_in_first_col and label_ratio >= 0.7 and unique_ratio >= 0.6 and numeric_body_ratio >= 0.7:
                        return DataLayout.TRANSPOSED

        # 5. TABULAR (Standard table layout requires sufficient density)
        if density >= 0.5:
            return DataLayout.TABULAR

        return DataLayout.UNKNOWN

    def classify_sheet(
        self,
        table_regions: list[TableRegion],
        raw_dataframe: pd.DataFrame,
    ) -> tuple[DataLayout, float, list[str], str]:
        """Synthesize sheet-level layout based on detected table regions and sheet features."""
        if not table_regions:
            return (
                DataLayout.UNKNOWN,
                0.0,
                ["Worksheet không chứa vùng bảng dữ liệu nào."],
                "Không có bảng nào được tìm thấy.",
            )

        # Multi-table: Sheet contains 2 or more distinct tabular regions
        if len(table_regions) >= 2:
            evidence = [
                f"Phát hiện {len(table_regions)} vùng dữ liệu độc lập phân tách rõ ràng trên worksheet.",
                f"Tọa độ các bảng: {', '.join(t.range for t in table_regions)}.",
            ]
            reasoning = "Sheet chứa nhiều bảng dữ liệu độc lập được bố trí ngang hoặc dọc."
            return DataLayout.MULTI_TABLE, 0.9, evidence, reasoning

        single_table = table_regions[0]

        has_report_signals = False
        report_evidence: list[str] = []

        # Signal 1: Space before table for title/banner
        if single_table.start_row >= 2:
            top_slice = raw_dataframe.iloc[: single_table.start_row]
            top_values = [
                str(v).strip().lower()
                for v in top_slice.to_numpy().flatten()
                if not self._is_missing(v)
            ]
            if top_values:
                has_report_signals = True
                report_evidence.append(
                    f"Có {len(top_values)} ô thông tin tiêu đề/metadata trước bảng chính."
                )

        # Signal 2: Bottom notes/signatures after table
        if single_table.end_row < raw_dataframe.shape[0] - 1:
            bottom_slice = raw_dataframe.iloc[single_table.end_row + 1 :]
            bottom_values = [
                str(v).strip().lower()
                for v in bottom_slice.to_numpy().flatten()
                if not self._is_missing(v)
            ]
            if bottom_values:
                has_report_signals = True
                report_evidence.append(
                    f"Có {len(bottom_values)} ô thông tin tổng kết/ghi chú sau bảng chính."
                )

        # Signal 3: Report keywords in the sheet
        all_text = " ".join(
            str(v).lower()
            for v in raw_dataframe.to_numpy().flatten()
            if not self._is_missing(v)
        )
        keyword_hits = [kw for kw in self.REPORT_KEYWORDS if kw in all_text]
        if keyword_hits:
            report_evidence.append(
                f"Tìm thấy từ khóa báo cáo: {', '.join(keyword_hits[:4])}."
            )

        if has_report_signals and len(keyword_hits) >= 1:
            evidence = [
                "Bảng dữ liệu được bao quanh bởi các khối tiêu đề báo cáo hoặc ghi chú chân trang.",
            ] + report_evidence
            reasoning = (
                "Worksheet có cấu trúc hoàn chỉnh của một báo cáo quản trị kinh doanh "
                "(gồm tiêu đề báo cáo, bảng dữ liệu chi tiết và phần tổng kết/ghi chú)."
            )
            return DataLayout.REPORT, 0.85, evidence, reasoning

        evidence = [
            f"Worksheet chứa 1 bảng dữ liệu duy nhất ({single_table.range}).",
            f"Dạng bố cục của bảng: {single_table.layout_type.value}.",
        ]
        reasoning = f"Bố cục toàn sheet đồng nhất với cấu trúc bảng đơn lẻ ({single_table.layout_type.value})."
        return single_table.layout_type, single_table.confidence, evidence, reasoning

    def _check_crosstab(
        self,
        df: pd.DataFrame,
        header_info: HeaderDetectionResult,
    ) -> bool:
        """Verify if table is a 2D Crosstab / Pivot matrix."""
        data_start_r = (header_info.header_end_row + 1) if header_info.header_end_row is not None else 1
        if data_start_r >= df.shape[0] or df.shape[1] < 3:
            return False

        # Corner cell signal: "Dimension / Dimension" (e.g. "Khu vực / Quý")
        corner_val = str(df.iloc[0, 0]).strip() if not self._is_missing(df.iloc[0, 0]) else ""
        has_slash_dimension = "/" in corner_val or "\\" in corner_val

        headers = header_info.column_names[1:] if len(header_info.column_names) > 1 else []
        if not headers:
            headers = [str(df.iloc[0, c]).strip() for c in range(1, df.shape[1]) if not self._is_missing(df.iloc[0, c])]

        # If any header indicates a distinct business attribute/entity, it is a standard tabular table
        business_keywords = {
            "công ty", "cong ty", "chi phí", "chi phi", "doanh thu", "số tiền", "so tien",
            "kế hoạch", "ke hoach", "tên", "ten", "mã", "ma", "khách hàng", "khach hang",
            "nhân viên", "nhan vien", "ngày", "ngay", "status", "trạng thái", "trang thai",
            "đơn vị", "don vi", "địa chỉ", "dia chi", "email", "phone", "sđt", "tháng", "quý", "năm"
        }
        business_header_count = sum(
            1 for h in headers if any(kw == str(h).strip().lower() or kw in str(h).strip().lower() for kw in business_keywords)
        )
        if business_header_count >= 2:
            return False

        # All matrix columns (col 1 onward) must be numeric across data rows
        for c in range(1, df.shape[1]):
            col_vals = [v for v in df.iloc[data_start_r:, c] if not self._is_missing(v)]
            if not col_vals:
                continue
            num_ratio = sum(self._looks_like_number(v) for v in col_vals) / len(col_vals)
            if num_ratio < 0.8:
                # Column contains text (e.g., company names) -> NOT a crosstab
                return False

        first_col_data = df.iloc[data_start_r:, 0]
        first_col_non_empty = [v for v in first_col_data if not self._is_missing(v)]
        if not first_col_non_empty:
            return False
        col_labels_text = sum(self._is_text(v) for v in first_col_non_empty) / len(first_col_non_empty)

        # Check for category bucket signals in headers: e.g. Q1..Q4, years (2020, 2021), or corner slash
        is_quarter = any(str(h).upper().startswith("Q") and any(ch.isdigit() for ch in str(h)) for h in headers)
        is_year = all(str(h).isdigit() and len(str(h)) == 4 for h in headers if h)
        if has_slash_dimension or is_quarter or is_year:
            return col_labels_text >= 0.6

        # In a generic crosstab without explicit quarter/year, headers must be short and homogeneous
        return has_slash_dimension

    @staticmethod
    def _is_missing(value: object) -> bool:
        if value is None:
            return True
        try:
            return bool(pd.isna(value)) or (
                isinstance(value, str) and not value.strip()
            )
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _is_text(value: object) -> bool:
        if value is None:
            return False
        if isinstance(value, str):
            clean = value.replace(",", "").replace("%", "").strip()
            try:
                float(clean)
                return False
            except ValueError:
                # Exclude date strings
                if any(sep in clean for sep in ["-", "/"]) and any(ch.isdigit() for ch in clean):
                    try:
                        if pd.notna(pd.to_datetime(clean, errors="coerce")):
                            return False
                    except Exception:
                        pass
                return len(clean) > 0
        return False

    @staticmethod
    def _looks_like_number(value: object) -> bool:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return True
        if isinstance(value, str):
            cleaned = value.replace(",", "").replace("%", "").strip()
            try:
                float(cleaned)
                return True
            except ValueError:
                return False
        return False


layout_classifier = LayoutClassifier()
