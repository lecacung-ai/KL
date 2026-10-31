
"""Validate DataFrame values against inferred semantic types.

This module reports invalid values without modifying the source DataFrame.
"""

from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Any

import pandas as pd

from app.services.schema_analysis.models.column import (
    ColumnSchema,
    SemanticType,
)
from app.services.schema_analysis.models.quality import (
    IssueSeverity,
    QualityIssue,
)


@dataclass
class SheetValidationResult:
    columns_checked: int = 0
    invalid_values: int = 0
    issues: list[QualityIssue] = field(default_factory=list)


class QualityValidator:
    BOOLEAN_VALUES = {
        "true", "false",
        "yes", "no",
        "y", "n",
        "có", "không",
        "co", "khong",
        "đúng", "sai",
        "1", "0",
    }

    def validate(
        self,
        dataframe: pd.DataFrame,
        columns: list[ColumnSchema],
    ) -> SheetValidationResult:
        result = SheetValidationResult()

        for column_schema in columns:
            position = column_schema.position

            if position < 0 or position >= dataframe.shape[1]:
                continue

            series = dataframe.iloc[:, position]
            semantic_type = column_schema.semantic_type

            if not self._is_validatable(semantic_type):
                continue

            result.columns_checked += 1

            invalid_values = []
            non_missing_count = 0

            for value in series.tolist():
                if self._is_missing(value):
                    continue

                non_missing_count += 1

                if not self._is_valid(value, semantic_type):
                    invalid_values.append(value)

            invalid_count = len(invalid_values)

            if invalid_count == 0:
                continue

            percentage = (
                invalid_count / non_missing_count * 100
                if non_missing_count > 0
                else 0.0
            )

            result.invalid_values += invalid_count

            result.issues.append(
                QualityIssue(
                    code="INVALID_VALUE_TYPE",
                    severity=IssueSeverity.WARNING,
                    message=(
                        f"Cột '{column_schema.name}' có "
                        f"{invalid_count} giá trị không phù hợp "
                        f"với kiểu dữ liệu kỳ vọng "
                        f"'{semantic_type.value}'."
                    ),
                    column_name=column_schema.name,
                    affected_count=invalid_count,
                    affected_percentage=round(percentage, 2),
                    evidence=[
                        f"Giá trị không hợp lệ: "
                        f"{self._safe_repr(value)}"
                        for value in invalid_values[:5]
                    ],
                    recommendation=(
                        "Kiểm tra các giá trị không phù hợp. "
                        "Không tự động thay thế hoặc xóa dữ liệu "
                        "khi chưa xác nhận ý nghĩa của chúng."
                    ),
                )
            )

        return result

    @staticmethod
    def _is_missing(value: Any) -> bool:
        if value is None:
            return True

        if isinstance(value, str):
            return not value.strip()

        try:
            missing = pd.isna(value)
            return bool(missing) if not hasattr(missing, "__len__") else False
        except (TypeError, ValueError):
            return False

    @staticmethod
    def _is_validatable(semantic_type: SemanticType) -> bool:
        return semantic_type in {
            SemanticType.INTEGER,
            SemanticType.FLOAT,
            SemanticType.CURRENCY,
            SemanticType.PERCENTAGE,
            SemanticType.BOOLEAN,
            SemanticType.DATE,
            SemanticType.DATETIME,
            SemanticType.TIME,
        }

    def _is_valid(
        self,
        value: Any,
        semantic_type: SemanticType,
    ) -> bool:
        if semantic_type == SemanticType.INTEGER:
            number = self._to_number(value)
            return number is not None and number.is_integer()

        if semantic_type in {
            SemanticType.FLOAT,
            SemanticType.CURRENCY,
            SemanticType.PERCENTAGE,
        }:
            return self._to_number(value) is not None

        if semantic_type == SemanticType.BOOLEAN:
            return self._is_boolean(value)

        if semantic_type == SemanticType.DATE:
            return self._is_date(value)

        if semantic_type == SemanticType.DATETIME:
            return self._is_datetime(value)

        if semantic_type == SemanticType.TIME:
            return self._is_time(value)

        # Unknown or non-validated semantic types are not rejected.
        return True

    @staticmethod
    def _to_number(value: Any) -> float | None:
        if isinstance(value, bool):
            return None

        try:
            number = pd.to_numeric(value, errors="coerce")
            if pd.isna(number):
                return None
            return float(number)
        except (TypeError, ValueError, OverflowError):
            return None

    def _is_boolean(self, value: Any) -> bool:
        if isinstance(value, bool):
            return True

        return str(value).strip().casefold() in self.BOOLEAN_VALUES

    @staticmethod
    def _is_date(value: Any) -> bool:
        if isinstance(value, (datetime, date, pd.Timestamp)):
            return True

        if isinstance(value, (int, float)):
            return False

        try:
            parsed = pd.to_datetime(
                value,
                errors="coerce",
                dayfirst=True,
            )
            return not pd.isna(parsed)
        except (TypeError, ValueError, OverflowError):
            return False

    @staticmethod
    def _is_datetime(value: Any) -> bool:
        if isinstance(value, (datetime, pd.Timestamp)):
            return True

        if isinstance(value, (int, float)):
            return False

        if not isinstance(value, str):
            return False

        text = value.strip()

        # A date-only string is not enough evidence for Datetime.
        has_time_component = (
            "T" in text
            or " " in text
            or ":" in text
        )
        if not has_time_component:
            return False

        try:
            parsed = pd.to_datetime(
                text,
                errors="coerce",
                dayfirst=True,
            )
            return not pd.isna(parsed)
        except (TypeError, ValueError, OverflowError):
            return False

    @staticmethod
    def _is_time(value: Any) -> bool:
        if isinstance(value, time):
            return True

        if isinstance(value, (int, float)):
            return False

        if not isinstance(value, str):
            return False

        try:
            parsed = pd.to_datetime(
                value.strip(),
                errors="coerce",
            )
            return not pd.isna(parsed)
        except (TypeError, ValueError, OverflowError):
            return False

    @staticmethod
    def _safe_repr(value: Any) -> str:
        if isinstance(value, (datetime, date, time, pd.Timestamp)):
            return value.isoformat()

        return str(value)[:100]


quality_validator = QualityValidator()
