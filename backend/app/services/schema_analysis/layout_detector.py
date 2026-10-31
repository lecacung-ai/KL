
"""Infer the structural layout of a worksheet."""

import pandas as pd

from app.services.schema_analysis.models.layout import (
    DataLayout,
    LayoutInference,
)


class LayoutDetector:
    """Detect table, transposed, key-value, or report-like layouts."""

    REPORT_KEYWORDS = (
        "total",
        "subtotal",
        "grand total",
        "tổng cộng",
        "tổng",
        "cộng",
        "ghi chú",
        "note",
    )

    def detect(self, dataframe: pd.DataFrame) -> LayoutInference:
        if dataframe.empty:
            return LayoutInference(
                layout=DataLayout.UNKNOWN,
                confidence=0.0,
                reasoning="Không có dữ liệu để nhận diện.",
            )

        report_result = self._detect_report(dataframe)

        if report_result is not None:
            return report_result

        key_value_result = self._detect_key_value(dataframe)

        if key_value_result is not None:
            return key_value_result

        transposed_result = self._detect_transposed(dataframe)

        if transposed_result is not None:
            return transposed_result

        tabular_result = self._detect_tabular(dataframe)

        if tabular_result is not None:
            return tabular_result

        return LayoutInference(
            layout=DataLayout.UNKNOWN,
            confidence=0.3,
            evidence=["Không có đủ tín hiệu để phân loại cấu trúc."],
            reasoning="Cần kiểm tra cấu trúc dữ liệu thủ công.",
        )

    def _detect_report(
        self,
        dataframe: pd.DataFrame,
    ) -> LayoutInference | None:
        rows, columns = dataframe.shape

        if rows < 3 or columns < 2:
            return None

        values = [
            str(value).strip().casefold()
            for value in dataframe.to_numpy().flatten()
            if not self._is_missing(value)
        ]

        keyword_matches = [
            value
            for value in values
            if any(keyword in value for keyword in self.REPORT_KEYWORDS)
        ]

        blank_rows = sum(
            all(self._is_missing(value) for value in dataframe.iloc[index])
            for index in range(rows)
        )

        keyword_ratio = len(keyword_matches) / max(len(values), 1)
        blank_ratio = blank_rows / rows

        if keyword_matches and (keyword_ratio >= 0.05 or blank_ratio >= 0.15):
            return LayoutInference(
                layout=DataLayout.REPORT,
                confidence=min(0.95, 0.65 + keyword_ratio + blank_ratio),
                evidence=[
                    f"Phát hiện {len(keyword_matches)} ô chứa từ khóa báo cáo.",
                    f"Tỷ lệ dòng trống: {blank_ratio:.2f}.",
                ],
                reasoning=(
                    "Có dấu hiệu của báo cáo tổng hợp, "
                    "dòng tổng cộng hoặc các vùng dữ liệu phân tách."
                ),
            )

        return None

    def _detect_key_value(
        self,
        dataframe: pd.DataFrame,
    ) -> LayoutInference | None:
        rows, columns = dataframe.shape

        if columns != 2 or rows < 2:
            return None

        first_column = dataframe.iloc[:, 0]
        second_column = dataframe.iloc[:, 1]

        first_non_empty = first_column[
            ~first_column.map(self._is_missing)
        ]

        second_non_empty = second_column[
            ~second_column.map(self._is_missing)
        ]

        if len(first_non_empty) < 2 or len(second_non_empty) < 2:
            return None

        text_ratio = sum(
            isinstance(value, str)
            for value in first_non_empty
        ) / len(first_non_empty)

        unique_ratio = (
            first_non_empty.nunique(dropna=True)
            / len(first_non_empty)
        )

        if text_ratio >= 0.7 and unique_ratio >= 0.7:
            return LayoutInference(
                layout=DataLayout.KEY_VALUE,
                confidence=0.75,
                evidence=[
                    "Có đúng hai cột.",
                    f"Tỷ lệ giá trị dạng văn bản ở cột đầu: {text_ratio:.2f}.",
                    f"Tỷ lệ giá trị duy nhất ở cột đầu: {unique_ratio:.2f}.",
                ],
                reasoning=(
                    "Cột đầu có vẻ chứa khóa hoặc tên thuộc tính, "
                    "cột thứ hai chứa giá trị tương ứng."
                ),
            )

        return None

    def _detect_transposed(
        self,
        dataframe: pd.DataFrame,
    ) -> LayoutInference | None:
        rows, columns = dataframe.shape

        if rows < 2 or columns < 3:
            return None

        first_column = dataframe.iloc[:, 0]
        remaining_data = dataframe.iloc[:, 1:]

        first_non_empty = first_column[
            ~first_column.map(self._is_missing)
        ]

        if len(first_non_empty) < 2:
            return None

        label_ratio = sum(
            isinstance(value, str)
            and not self._looks_like_number(value)
            for value in first_non_empty
        ) / len(first_non_empty)

        remaining_values = [
            value
            for value in remaining_data.to_numpy().flatten()
            if not self._is_missing(value)
        ]

        if not remaining_values:
            return None

        numeric_ratio = sum(
            self._looks_like_number(value)
            for value in remaining_values
        ) / len(remaining_values)

        if label_ratio >= 0.7 and numeric_ratio >= 0.6:
            return LayoutInference(
                layout=DataLayout.TRANSPOSED,
                confidence=0.75,
                evidence=[
                    f"Tỷ lệ nhãn dạng văn bản ở cột đầu: {label_ratio:.2f}.",
                    f"Tỷ lệ giá trị số ở phần còn lại: {numeric_ratio:.2f}.",
                    f"Số dòng: {rows}, số cột: {columns}.",
                ],
                reasoning=(
                    "Cột đầu có vẻ chứa tên chỉ tiêu, "
                    "các cột còn lại có thể đại diện cho đối tượng hoặc thời gian."
                ),
            )

        return None

    def _detect_tabular(
        self,
        dataframe: pd.DataFrame,
    ) -> LayoutInference | None:
        rows, columns = dataframe.shape

        if rows < 2 or columns < 2:
            return None

        non_empty_ratios = []

        for _, row in dataframe.iterrows():
            non_empty_count = sum(
                not self._is_missing(value)
                for value in row
            )
            non_empty_ratios.append(non_empty_count / columns)

        average_density = sum(non_empty_ratios) / len(non_empty_ratios)

        if average_density >= 0.7:
            return LayoutInference(
                layout=DataLayout.TABULAR,
                confidence=0.7,
                evidence=[
                    f"Mật độ ô không rỗng trung bình: {average_density:.2f}.",
                    f"Số dòng: {rows}, số cột: {columns}.",
                ],
                reasoning=(
                    "Dữ liệu có mật độ tương đối đồng đều, "
                    "phù hợp với cấu trúc bảng thông thường."
                ),
            )

        return None

    @staticmethod
    def _is_missing(value: object) -> bool:
        if value is None:
            return True

        try:
            result = pd.isna(value)

            if isinstance(result, bool):
                return result

            return False
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _looks_like_number(value: object) -> bool:
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return True

        if isinstance(value, str):
            try:
                float(value.replace(",", "").strip())
                return True
            except ValueError:
                return False

        return False


layout_detector = LayoutDetector()
