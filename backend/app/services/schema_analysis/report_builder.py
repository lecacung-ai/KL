
"""Build user-facing reports from schema analysis results."""

from typing import Any

from app.services.schema_analysis.models.report import (
    SchemaAnalysisResult,
)


class ReportBuilder:
    """Convert technical analysis results into frontend-friendly data."""

    def build(
        self,
        result: SchemaAnalysisResult,
    ) -> dict[str, Any]:
        dataset = result.dataset
        quality = result.quality

        return {
            "analysis_version": result.analysis_version,
            "analyzed_at": result.analyzed_at.isoformat(),
            "overview": self._build_overview(dataset, quality),
            "quality": self._build_quality(quality),
            "sheets": [
                self._build_sheet(sheet)
                for sheet in dataset.sheets
            ],
            "issues": [
                self._build_issue(issue)
                for issue in result.issues
            ],
            "recommendations": result.recommendations,
        }

    @staticmethod
    def _build_overview(
        dataset: Any,
        quality: Any,
    ) -> dict[str, Any]:
        return {
            "filename": dataset.filename,
            "file_type": ReportBuilder._enum_value(
                dataset.file_type
            ),
            "file_size_bytes": dataset.file_size_bytes,
            "sheet_count": dataset.sheet_count,
            "total_rows": dataset.total_row_count,
            "total_columns": dataset.total_column_count,
            "status": ReportBuilder._enum_value(
                quality.status
            ),
            "health_score": quality.health_score,
        }

    @staticmethod
    def _build_quality(quality: Any) -> dict[str, Any]:
        return {
            "total_cells": quality.total_cells,
            "missing_cells": quality.missing_cells,
            "missing_percentage": (
                round(
                    quality.missing_cells
                    / quality.total_cells * 100,
                    2,
                )
                if quality.total_cells > 0
                else 0.0
            ),
            "duplicate_rows": quality.duplicate_rows,
            "invalid_values": quality.invalid_values,
            "total_issues": quality.total_issues,
        }

    @staticmethod
    def _build_sheet(sheet: Any) -> dict[str, Any]:
        return {
            "name": sheet.name,
            "position": sheet.position,
            "row_count": sheet.row_count,
            "column_count": sheet.column_count,
            "header_row": sheet.header_row,
            "is_empty": sheet.is_empty,
            "layout": {
                "type": ReportBuilder._enum_value(
                    sheet.layout.layout
                ),
                "confidence": sheet.layout.confidence,
                "evidence": sheet.layout.evidence,
                "reasoning": sheet.layout.reasoning,
            },
            "columns": [
                ReportBuilder._build_column(column)
                for column in sheet.columns
            ],
        }

    @staticmethod
    def _build_column(column: Any) -> dict[str, Any]:
        return {
            "name": column.name,
            "position": column.position,
            "physical_type": column.physical_type,
            "semantic_type": ReportBuilder._enum_value(
                column.semantic_type
            ),
            "semantic_role": ReportBuilder._enum_value(
                column.semantic_role
            ),
            "confidence": column.confidence,
            "missing_count": column.missing_count,
            "missing_percentage": column.missing_percentage,
            "unique_count": column.unique_count,
            "invalid_count": column.invalid_count,
            "is_constant": column.is_constant,
            "sample_values": column.sample_values,
            "evidence": column.evidence,
            "reasoning": column.reasoning,
        }

    @staticmethod
    def _build_issue(issue: Any) -> dict[str, Any]:
        return {
            "code": issue.code,
            "severity": ReportBuilder._enum_value(
                issue.severity
            ),
            "message": issue.message,
            "sheet_name": issue.sheet_name,
            "column_name": issue.column_name,
            "affected_count": issue.affected_count,
            "affected_percentage": issue.affected_percentage,
            "evidence": issue.evidence,
            "recommendation": issue.recommendation,
        }

    @staticmethod
    def _enum_value(value: Any) -> Any:
        if hasattr(value, "value"):
            return value.value
        return value


report_builder = ReportBuilder()
