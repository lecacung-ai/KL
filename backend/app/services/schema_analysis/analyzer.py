
"""Orchestrate the schema analysis pipeline."""

from pathlib import Path
from typing import Any

import pandas as pd

from app.services.schema_analysis.reader import DataReader
from app.services.schema_analysis.structure_extractor import (
    StructureExtractor,
)
from app.services.schema_analysis.layout_detector import LayoutDetector
from app.services.schema_analysis.type_inference import TypeInference
from app.services.schema_analysis.quality_profiler import QualityProfiler
from app.services.schema_analysis.quality_validator import QualityValidator

from app.services.schema_analysis.models.column import (
    ColumnSchema,
    SemanticRole,
    SemanticType,
)
from app.services.schema_analysis.models.dataset import (
    DatasetSchema,
    FileType,
    SheetSchema,
)
from app.services.schema_analysis.models.layout import (
    LayoutInference,
)
from app.services.schema_analysis.models.quality import (
    DatasetStatus,
    QualityIssue,
    QualitySummary,
)
from app.services.schema_analysis.models.report import (
    SchemaAnalysisResult,
)


class SchemaAnalyzer:
    """Coordinate all schema analysis components."""

    def __init__(
        self,
        reader: DataReader | None = None,
        structure_extractor: StructureExtractor | None = None,
        layout_detector: LayoutDetector | None = None,
        type_inference: TypeInference | None = None,
        quality_profiler: QualityProfiler | None = None,
        quality_validator: QualityValidator | None = None,
    ) -> None:
        self.reader = reader or DataReader()
        self.structure_extractor = (
            structure_extractor or StructureExtractor()
        )
        self.layout_detector = layout_detector or LayoutDetector()
        self.type_inference = type_inference or TypeInference()
        self.quality_profiler = quality_profiler or QualityProfiler()
        self.quality_validator = (
            quality_validator or QualityValidator()
        )

    def analyze(self, file_path: str | Path) -> SchemaAnalysisResult:
        """Analyze a CSV or Excel file and return a unified report."""

        path = Path(file_path)

        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"File not found: {path}")

        loaded = self.reader.read(path)

        sheet_schemas: list[SheetSchema] = []
        all_issues: list[QualityIssue] = []

        total_rows = 0
        total_columns = 0
        total_cells = 0
        total_missing = 0
        total_duplicates = 0
        total_invalid = 0

        for sheet in loaded.sheets:
            raw_df = sheet.dataframe

            structure = self.structure_extractor.extract(raw_df)

            analysis_df = self._prepare_dataframe(
                raw_df,
                structure,
            )

            layout_result = self.layout_detector.detect(analysis_df)

            column_schemas = self._infer_columns(analysis_df)

            profile = self.quality_profiler.profile(analysis_df)

            validation = self.quality_validator.validate(
                analysis_df,
                column_schemas,
            )

            sheet_issues = list(validation.issues)

            # Preserve structural warnings as report issues.
            for warning in structure.warnings:
                sheet_issues.append(
                    QualityIssue(
                        code="STRUCTURE_WARNING",
                        severity="warning",
                        message=str(warning),
                        sheet_name=sheet.name,
                    )
                )

            # Attach sheet information to validation issues.
            for issue in validation.issues:
                issue.sheet_name = sheet.name

            sheet_schema = SheetSchema(
                name=sheet.name,
                position=sheet.position,
                row_count=analysis_df.shape[0],
                column_count=analysis_df.shape[1],
                header_row=structure.header_row,
                columns=column_schemas,
                is_empty=analysis_df.empty,
                layout=LayoutInference(
                    layout=layout_result.layout,
                    confidence=layout_result.confidence,
                    evidence=layout_result.evidence,
                    reasoning=layout_result.reasoning,
                ),
            )

            sheet_schemas.append(sheet_schema)
            all_issues.extend(sheet_issues)

            total_rows += profile.row_count
            total_columns += profile.column_count
            total_cells += (
                profile.row_count * profile.column_count
            )
            total_missing += profile.missing_cells
            total_duplicates += profile.duplicate_rows
            total_invalid += validation.invalid_values

        dataset_schema = DatasetSchema(
            filename=path.name,
            file_type=self._get_file_type(
                loaded.metadata.file_type
            ),
            file_size_bytes=loaded.metadata.file_size_bytes,
            sheet_count=len(sheet_schemas),
            total_row_count=total_rows,
            total_column_count=total_columns,
            sheets=sheet_schemas,
        )

        # Include reader warnings in the final report.
        for warning in loaded.metadata.warnings:
            all_issues.append(
                QualityIssue(
                    code="FILE_READING_WARNING",
                    severity="warning",
                    message=str(warning),
                )
            )

        health_score = self._calculate_health_score(
            total_cells=total_cells,
            total_rows=total_rows,
            missing_cells=total_missing,
            duplicate_rows=total_duplicates,
            invalid_values=total_invalid,
        )

        quality_summary = QualitySummary(
            total_cells=total_cells,
            missing_cells=total_missing,
            duplicate_rows=total_duplicates,
            invalid_values=total_invalid,
            total_issues=len(all_issues),
            status=self._determine_status(
                total_cells,
                all_issues,
            ),
            health_score=health_score,
        )

        return SchemaAnalysisResult(
            dataset=dataset_schema,
            quality=quality_summary,
            issues=all_issues,
            recommendations=self._build_recommendations(
                all_issues
            ),
        )

    def _infer_columns(
        self,
        dataframe: pd.DataFrame,
    ) -> list[ColumnSchema]:
        columns: list[ColumnSchema] = []

        for position in range(dataframe.shape[1]):
            series = dataframe.iloc[:, position]
            name = str(dataframe.columns[position])

            inferred: dict[str, Any] = self.type_inference.infer(
                series,
                column_name=name,
            )

            semantic_type = self._enum_value(
                SemanticType,
                inferred.get("semantic_type"),
                SemanticType.UNKNOWN,
            )

            semantic_role = self._enum_value(
                SemanticRole,
                inferred.get("semantic_role"),
                SemanticRole.UNKNOWN,
            )

            columns.append(
                ColumnSchema(
                    name=name,
                    position=position,
                    physical_type=str(series.dtype),
                    semantic_type=semantic_type,
                    semantic_role=semantic_role,
                    confidence=inferred.get("confidence"),
                    evidence=inferred.get("evidence", []),
                    reasoning=inferred.get("reasoning"),
                    row_count=len(series),
                    non_null_count=inferred.get(
                        "non_null_count", 0
                    ),
                    missing_count=inferred.get(
                        "missing_count", 0
                    ),
                    missing_percentage=inferred.get(
                        "missing_percentage", 0.0
                    ),
                    unique_count=inferred.get("unique_count", 0),
                    invalid_count=inferred.get("invalid_count", 0),
                    is_constant=inferred.get("is_constant", False),
                    sample_values=inferred.get(
                        "sample_values", []
                    ),
                )
            )

        return columns

    @staticmethod
    def _prepare_dataframe(
        dataframe: pd.DataFrame,
        structure: Any,
    ) -> pd.DataFrame:
        """Create an analysis view without modifying the raw DataFrame."""

        header_row = structure.header_row
        data_start_row = structure.data_start_row

        if data_start_row is not None:
            start_row = data_start_row
        elif header_row is not None:
            start_row = header_row + 1
        else:
            start_row = 0

        result = dataframe.iloc[start_row:].copy()

        names = structure.column_names

        if names and len(names) == result.shape[1]:
            result.columns = names
        else:
            result.columns = [
                f"Unnamed_{index + 1}"
                for index in range(result.shape[1])
            ]

        return result.reset_index(drop=True)

    @staticmethod
    def _enum_value(
        enum_class: type,
        value: Any,
        default: Any,
    ) -> Any:
        if isinstance(value, enum_class):
            return value

        try:
            return enum_class(value)
        except (ValueError, TypeError):
            return default

    @staticmethod
    def _get_file_type(value: Any) -> FileType:
        try:
            return FileType(str(value).lower())
        except ValueError:
            return FileType.UNKNOWN

    @staticmethod
    def _calculate_health_score(
        total_cells: int,
        total_rows: int,
        missing_cells: int,
        duplicate_rows: int,
        invalid_values: int,
    ) -> float:
        if total_cells == 0 or total_rows == 0:
            return 100.0

        missing_ratio = missing_cells / total_cells
        duplicate_ratio = duplicate_rows / total_rows
        invalid_ratio = invalid_values / total_cells

        penalty = (missing_ratio * 0.5) + (duplicate_ratio * 0.3) + (invalid_ratio * 0.2)
        score = max(0.0, min(100.0, round((1.0 - penalty) * 100, 1)))
        return score

    @staticmethod
    def _determine_status(
        total_cells: int,
        issues: list[QualityIssue],
    ) -> DatasetStatus:
        if total_cells == 0:
            return DatasetStatus.UNKNOWN

        if any(
            issue.severity == "critical"
            or issue.severity == "error"
            for issue in issues
        ):
            return DatasetStatus.CRITICAL

        if issues:
            return DatasetStatus.WARNING

        return DatasetStatus.HEALTHY

    @staticmethod
    def _build_recommendations(
        issues: list[QualityIssue],
    ) -> list[str]:
        recommendations = {
            issue.recommendation
            for issue in issues
            if issue.recommendation
        }

        return sorted(recommendations)


schema_analyzer = SchemaAnalyzer()
