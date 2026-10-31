"""Models for schema analysis reports."""

from datetime import UTC, datetime

from pydantic import BaseModel, ConfigDict, Field

from app.services.schema_analysis.models.dataset import DatasetSchema
from app.services.schema_analysis.models.quality import (
    QualityIssue,
    QualitySummary,
)


class SchemaAnalysisResult(BaseModel):
    """Complete result of dataset schema and quality analysis."""

    model_config = ConfigDict(extra="forbid")

    analysis_version: str = "1.0"

    analyzed_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC)
    )

    dataset: DatasetSchema

    quality: QualitySummary = Field(
        default_factory=QualitySummary
    )

    issues: list[QualityIssue] = Field(
        default_factory=list
    )

    recommendations: list[str] = Field(
        default_factory=list
    )