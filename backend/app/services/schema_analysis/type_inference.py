
"""Infer physical types and semantic types for DataFrame columns."""

import re
from collections import Counter
from typing import Any

import pandas as pd

from app.services.schema_analysis.models.column import (
    SemanticRole,
    SemanticType,
)


class TypeInference:
    """Infer data types using values and column-name evidence."""

    BOOLEAN_VALUES = {
        "true", "false",
        "yes", "no",
        "y", "n",
        "1", "0",
        "có", "không",
        "co", "khong",
        "đúng", "sai",
    }

    CURRENCY_KEYWORDS = (
        "price", "amount", "revenue", "cost",
        "salary", "sales", "profit",
        "giá", "doanh thu", "chi phí",
        "lương", "tiền",
    )

    PERCENTAGE_KEYWORDS = (
        "percent", "percentage", "rate",
        "ratio", "growth",
        "tỷ lệ", "phần trăm", "tăng trưởng",
    )

    DATE_KEYWORDS = (
        "date", "day", "ngày",
    )

    TIME_KEYWORDS = (
        "time", "thời gian", "giờ",
    )

    ID_KEYWORDS = (
        "id", "code", "sku", "uuid",
        "mã", "số hiệu", "identifier",
    )

    DESCRIPTION_KEYWORDS = (
        "description", "note", "comment",
        "address", "địa chỉ", "mô tả",
        "ghi chú", "nhận xét",
    )

    CATEGORICAL_KEYWORDS = (
        "khu vực", "loại", "nhóm", "danh mục",
        "category", "region", "type", "status", "phân loại",
    )

    def infer(self, series: pd.Series, column_name: str) -> dict[str, Any]:
        """Return inferred type, role, confidence and evidence."""

        values = series.dropna()
        non_empty = values[
            values.map(lambda value: str(value).strip() != "")
        ]

        total_count = len(series)
        non_null_count = len(non_empty)
        missing_count = total_count - non_null_count

        if non_null_count == 0:
            return self._result(
                physical_type=str(series.dtype),
                semantic_type=SemanticType.UNKNOWN,
                semantic_role=SemanticRole.UNKNOWN,
                confidence=0.0,
                evidence=["Cột không có giá trị hợp lệ để suy luận."],
                total_count=total_count,
                non_null_count=0,
                missing_count=missing_count,
            )

        normalized_name = column_name.casefold().strip()
        text_values = non_empty.map(lambda value: str(value).strip())

        unique_count = int(text_values.nunique())
        unique_ratio = unique_count / non_null_count

        evidence: list[str] = []

        # 1. Semantic inference from column name.
        semantic_type, semantic_role = self._infer_from_name(
            normalized_name
        )

        if semantic_type is not SemanticType.UNKNOWN:
            evidence.append(
                f"Tên cột '{column_name}' cung cấp tín hiệu ngữ nghĩa."
            )

        # 2. Infer from actual values.
        value_type = self._infer_from_values(non_empty)

        evidence.append(
            f"Giá trị thực tế gợi ý kiểu {value_type.value}."
        )

        # 3. Combine name and value evidence.
        if semantic_type is SemanticType.UNKNOWN:
            semantic_type = value_type

        elif not self._is_compatible(semantic_type, value_type):
            evidence.append(
                "Tên cột và kiểu giá trị có dấu hiệu không tương thích."
            )

            semantic_type = SemanticType.MIXED

        # 4. Infer role.
        if semantic_role is SemanticRole.UNKNOWN:
            semantic_role = self._infer_role(
                semantic_type,
                unique_ratio,
                normalized_name,
            )

        confidence = self._calculate_confidence(
            semantic_type,
            value_type,
            unique_ratio,
            non_null_count,
        )

        return self._result(
            physical_type=str(series.dtype),
            semantic_type=semantic_type,
            semantic_role=semantic_role,
            confidence=confidence,
            evidence=evidence,
            total_count=total_count,
            non_null_count=non_null_count,
            missing_count=missing_count,
        )

    def _infer_from_name(
        self,
        name: str,
    ) -> tuple[SemanticType, SemanticRole]:

        if any(keyword in name for keyword in self.ID_KEYWORDS):
            return SemanticType.IDENTIFIER, SemanticRole.IDENTIFIER

        if any(keyword in name for keyword in self.CURRENCY_KEYWORDS):
            return SemanticType.CURRENCY, SemanticRole.MEASURE

        if any(keyword in name for keyword in self.PERCENTAGE_KEYWORDS):
            return SemanticType.PERCENTAGE, SemanticRole.MEASURE

        if any(keyword in name for keyword in self.DATE_KEYWORDS):
            return SemanticType.DATE, SemanticRole.TEMPORAL

        if any(keyword in name for keyword in self.TIME_KEYWORDS):
            return SemanticType.DATETIME, SemanticRole.TEMPORAL

        if any(
            keyword in name
            for keyword in self.DESCRIPTION_KEYWORDS
        ):
            return SemanticType.TEXT, SemanticRole.DESCRIPTION

        if any(
            keyword in name
            for keyword in self.CATEGORICAL_KEYWORDS
        ):
            return SemanticType.CATEGORICAL, SemanticRole.DIMENSION

        return SemanticType.UNKNOWN, SemanticRole.UNKNOWN

    def _infer_from_values(self, values: pd.Series) -> SemanticType:
        normalized = values.map(
            lambda value: str(value).strip().casefold()
        )

        boolean_ratio = normalized.isin(self.BOOLEAN_VALUES).mean()

        if boolean_ratio >= 0.95:
            return SemanticType.BOOLEAN

        numeric_values = pd.to_numeric(values, errors="coerce")
        numeric_ratio = numeric_values.notna().mean()

        if numeric_ratio >= 0.95:
            if (numeric_values.dropna() % 1 == 0).all():
                return SemanticType.INTEGER

            return SemanticType.FLOAT

        date_values = pd.to_datetime(
            values,
            errors="coerce",
            format="mixed",
        )

        date_ratio = date_values.notna().mean()

        if date_ratio >= 0.95:
            return SemanticType.DATETIME

        if normalized.nunique() / len(normalized) <= 0.2:
            return SemanticType.CATEGORICAL

        if normalized.map(len).mean() > 50:
            return SemanticType.TEXT

        if numeric_ratio > 0 or date_ratio > 0:
            return SemanticType.MIXED

        return SemanticType.STRING

    @staticmethod
    def _is_compatible(
        semantic_type: SemanticType,
        value_type: SemanticType,
    ) -> bool:

        if semantic_type in {
            SemanticType.CURRENCY,
            SemanticType.PERCENTAGE,
            SemanticType.INTEGER,
            SemanticType.FLOAT,
        }:
            return value_type in {
                SemanticType.INTEGER,
                SemanticType.FLOAT,
            }

        if semantic_type is SemanticType.DATE:
            return value_type is SemanticType.DATETIME

        if semantic_type is SemanticType.TEXT:
            return value_type in {
                SemanticType.STRING,
                SemanticType.TEXT,
                SemanticType.CATEGORICAL,
            }

        if semantic_type is SemanticType.IDENTIFIER:
            return value_type in {
                SemanticType.STRING,
                SemanticType.INTEGER,
                SemanticType.TEXT,
                SemanticType.IDENTIFIER,
                SemanticType.MIXED,
            }

        if semantic_type is SemanticType.CATEGORICAL:
            return value_type in {
                SemanticType.STRING,
                SemanticType.CATEGORICAL,
            }

        return semantic_type is value_type

    def _infer_role(
        self,
        semantic_type: SemanticType,
        unique_ratio: float,
        name: str,
    ) -> SemanticRole:

        if semantic_type in {
            SemanticType.DATE,
            SemanticType.DATETIME,
            SemanticType.TIME,
        }:
            return SemanticRole.TEMPORAL

        if semantic_type in {
            SemanticType.INTEGER,
            SemanticType.FLOAT,
            SemanticType.CURRENCY,
            SemanticType.PERCENTAGE,
        }:
            return SemanticRole.MEASURE

        if semantic_type is SemanticType.BOOLEAN:
            return SemanticRole.STATUS

        if semantic_type is SemanticType.TEXT:
            return SemanticRole.DESCRIPTION

        if unique_ratio >= 0.9:
            return SemanticRole.IDENTIFIER

        if semantic_type in {
            SemanticType.STRING,
            SemanticType.CATEGORICAL,
        }:
            return SemanticRole.DIMENSION

        return SemanticRole.UNKNOWN

    @staticmethod
    def _calculate_confidence(
        semantic_type: SemanticType,
        value_type: SemanticType,
        unique_ratio: float,
        sample_count: int,
    ) -> float:

        if semantic_type is SemanticType.UNKNOWN:
            return 0.0

        confidence = 0.6

        if semantic_type is value_type:
            confidence += 0.2

        if sample_count >= 20:
            confidence += 0.1

        if unique_ratio > 0.95:
            confidence -= 0.05

        return round(max(0.0, min(1.0, confidence)), 2)

    @staticmethod
    def _result(
        physical_type: str,
        semantic_type: SemanticType,
        semantic_role: SemanticRole,
        confidence: float,
        evidence: list[str],
        total_count: int,
        non_null_count: int,
        missing_count: int,
    ) -> dict[str, Any]:

        return {
            "physical_type": physical_type,
            "semantic_type": semantic_type,
            "semantic_role": semantic_role,
            "confidence": confidence,
            "evidence": evidence,
            "row_count": total_count,
            "non_null_count": non_null_count,
            "missing_count": missing_count,
            "missing_percentage": (
                round(missing_count / total_count * 100, 2)
                if total_count
                else 0.0
            ),
            "unique_count": 0,
            "invalid_count": 0,
            "is_constant": False,
            "sample_values": [],
        }


type_inference = TypeInference()
