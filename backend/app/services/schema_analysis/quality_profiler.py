
"""Descriptive data quality profiling.

This module observes a DataFrame and reports statistics.
It never modifies the original data.
"""

from dataclasses import asdict, dataclass
from typing import Any

import pandas as pd


@dataclass
class ColumnProfile:
    name: str
    position: int
    row_count: int
    non_null_count: int
    missing_count: int
    missing_percentage: float
    unique_count: int
    duplicate_value_count: int
    is_constant: bool
    sample_values: list[Any]


@dataclass
class SheetQualityProfile:
    row_count: int
    column_count: int
    total_cells: int
    missing_cells: int
    duplicate_rows: int
    empty_rows: int
    columns: list[ColumnProfile]

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


class QualityProfiler:
    """Calculate descriptive quality statistics for a DataFrame."""

    def profile(self, dataframe: pd.DataFrame) -> SheetQualityProfile:
        row_count, column_count = dataframe.shape
        total_cells = row_count * column_count

        column_profiles: list[ColumnProfile] = []
        missing_cells = 0

        # Use iloc so duplicate column names are handled independently.
        for position in range(column_count):
            series = dataframe.iloc[:, position]
            name = str(dataframe.columns[position])

            missing_mask = self._missing_mask(series)
            missing_count = int(missing_mask.sum())
            non_missing = series[~missing_mask]

            non_null_count = len(non_missing)
            unique_count = self._count_unique(non_missing)

            missing_cells += missing_count

            if row_count > 0:
                missing_percentage = round(
                    missing_count / row_count * 100, 2
                )
            else:
                missing_percentage = 0.0

            column_profiles.append(
                ColumnProfile(
                    name=name,
                    position=position,
                    row_count=row_count,
                    non_null_count=non_null_count,
                    missing_count=missing_count,
                    missing_percentage=missing_percentage,
                    unique_count=unique_count,
                    duplicate_value_count=max(
                        non_null_count - unique_count, 0
                    ),
                    # An all-missing column is not considered constant.
                    is_constant=(
                        non_null_count > 0 and unique_count == 1
                    ),
                    sample_values=self._sample_values(non_missing),
                )
            )

        duplicate_rows = self._count_duplicate_rows(dataframe)
        empty_rows = self._count_empty_rows(dataframe)

        return SheetQualityProfile(
            row_count=row_count,
            column_count=column_count,
            total_cells=total_cells,
            missing_cells=missing_cells,
            duplicate_rows=duplicate_rows,
            empty_rows=empty_rows,
            columns=column_profiles,
        )

    @staticmethod
    def _missing_mask(series: pd.Series) -> pd.Series:
        """Treat null values and whitespace-only strings as missing."""
        null_mask = series.isna()
        blank_mask = series.map(
            lambda value: isinstance(value, str) and not value.strip()
        )
        return null_mask | blank_mask

    @staticmethod
    def _count_unique(series: pd.Series) -> int:
        """Count unique non-missing values."""
        try:
            return int(series.nunique(dropna=True))
        except TypeError:
            # Fallback for unusual unhashable cell values.
            return len({repr(value) for value in series.tolist()})

    @staticmethod
    def _sample_values(
        series: pd.Series,
        limit: int = 5,
    ) -> list[Any]:
        """Return up to five distinct, JSON-friendly sample values."""
        samples: list[Any] = []
        seen: set[str] = set()

        for value in series.tolist():
            key = repr(value)

            if key in seen:
                continue

            seen.add(key)
            samples.append(QualityProfiler._to_json_safe(value))

            if len(samples) >= limit:
                break

        return samples

    @staticmethod
    def _to_json_safe(value: Any) -> Any:
        """Convert common Pandas and NumPy values to serializable values."""
        if isinstance(value, (pd.Timestamp, pd.Timedelta)):
            return value.isoformat()

        if hasattr(value, "item"):
            try:
                value = value.item()
            except (ValueError, TypeError):
                pass

        if value is None or isinstance(value, (str, int, float, bool)):
            return value

        return str(value)

    @staticmethod
    def _count_duplicate_rows(dataframe: pd.DataFrame) -> int:
        if dataframe.empty:
            return 0

        try:
            return int(dataframe.duplicated().sum())
        except TypeError:
            # Fallback for unusual unhashable cell values.
            row_keys = dataframe.apply(
                lambda row: tuple(repr(value) for value in row),
                axis=1,
            )
            return int(row_keys.duplicated().sum())

    @staticmethod
    def _count_empty_rows(dataframe: pd.DataFrame) -> int:
        if dataframe.empty:
            return 0

        missing = dataframe.isna() | dataframe.apply(
            lambda column: column.map(
                lambda value: isinstance(value, str) and not value.strip()
            )
        )

        return int(missing.all(axis=1).sum())


quality_profiler = QualityProfiler()
