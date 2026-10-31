
"""Extract table structure from raw worksheet data."""

from dataclasses import dataclass, field

import pandas as pd


@dataclass
class StructureResult:
    """Detected table structure without modifying source data."""

    header_row: int | None
    data_start_row: int | None
    row_count: int
    column_count: int
    column_names: list[str]
    duplicate_columns: list[str] = field(default_factory=list)
    unnamed_columns: list[int] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    header_confidence: float = 0.0
    evidence: list[str] = field(default_factory=list)


class StructureExtractor:
    """Analyze worksheet structure and infer a possible header row."""

    def extract(self, dataframe: pd.DataFrame) -> StructureResult:
        if dataframe.empty:
            return StructureResult(
                header_row=None,
                data_start_row=None,
                row_count=0,
                column_count=len(dataframe.columns),
                column_names=[],
                warnings=["Worksheet không có dữ liệu."],
            )

        header_row, confidence, evidence = self._detect_header(dataframe)

        if header_row is None:
            return StructureResult(
                header_row=None,
                data_start_row=None,
                row_count=len(dataframe),
                column_count=len(dataframe.columns),
                column_names=[],
                warnings=[
                    "Không xác định được header đáng tin cậy. "
                    "Cần người dùng xác nhận cấu trúc."
                ],
                header_confidence=confidence,
                evidence=evidence,
            )

        raw_names = dataframe.iloc[header_row].tolist()

        column_names = [
            self._normalize_column_name(value, position)
            for position, value in enumerate(raw_names)
        ]

        duplicate_columns = self._find_duplicates(column_names)

        unnamed_columns = [
            index
            for index, value in enumerate(raw_names)
            if self._is_missing(value)
        ]

        warnings = []

        if duplicate_columns:
            warnings.append(
                f"Phát hiện tên cột trùng: {duplicate_columns}"
            )

        if unnamed_columns:
            warnings.append(
                f"Phát hiện cột chưa có tên tại vị trí: {unnamed_columns}"
            )

        return StructureResult(
            header_row=header_row,
            data_start_row=header_row + 1,
            row_count=len(dataframe) - header_row - 1,
            column_count=len(dataframe.columns),
            column_names=column_names,
            duplicate_columns=duplicate_columns,
            unnamed_columns=unnamed_columns,
            warnings=warnings,
            header_confidence=confidence,
            evidence=evidence,
        )

    def _detect_header(
        self,
        dataframe: pd.DataFrame,
    ) -> tuple[int | None, float, list[str]]:
        """
        Find a likely header row using simple structural signals.

        This is an initial heuristic, not a definitive classifier.
        """

        best_row = None
        best_score = 0.0
        best_evidence: list[str] = []

        # Inspect only the first 20 rows to avoid treating distant
        # content as a table header.
        for row_index in range(min(len(dataframe), 20)):
            row = dataframe.iloc[row_index]

            values = [
                value
                for value in row.tolist()
                if not self._is_missing(value)
            ]

            if len(values) < 2:
                continue

            text_count = sum(
                isinstance(value, str)
                and not self._looks_like_number(value)
                for value in values
            )

            non_empty_ratio = len(values) / max(len(row), 1)
            text_ratio = text_count / len(values)

            score = (
                0.5 * non_empty_ratio
                + 0.5 * text_ratio
            )

            evidence = [
                f"Có {len(values)} ô không rỗng.",
                f"Tỷ lệ ô dạng văn bản: {text_ratio:.2f}.",
                f"Tỷ lệ ô không rỗng: {non_empty_ratio:.2f}.",
            ]

            if score > best_score:
                best_score = score
                best_row = row_index
                best_evidence = evidence

        if best_score < 0.6:
            return None, best_score, best_evidence

        return best_row, best_score, best_evidence

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
    def _looks_like_number(value: object) -> bool:
        if not isinstance(value, str):
            return isinstance(value, (int, float))

        try:
            float(value.replace(",", "").strip())
            return True
        except ValueError:
            return False

    def _normalize_column_name(
        self,
        value: object,
        position: int,
    ) -> str:
        if self._is_missing(value):
            return f"Unnamed_{position + 1}"

        return str(value).strip()

    @staticmethod
    def _find_duplicates(names: list[str]) -> list[str]:
        seen = set()
        duplicates = set()

        for name in names:
            normalized = name.casefold()

            if normalized in seen:
                duplicates.add(name)

            seen.add(normalized)

        return sorted(duplicates)


structure_extractor = StructureExtractor()
