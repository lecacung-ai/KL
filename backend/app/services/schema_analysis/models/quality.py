"""Models for data quality issues and metrics."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class IssueSeverity(str, Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class DatasetStatus(str, Enum):
    HEALTHY = "healthy"
    WARNING = "warning"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class QualityIssue(BaseModel):
    """Represent one detected data quality issue."""

    model_config = ConfigDict(extra="forbid")

    code: str
    severity: IssueSeverity

    message: str

    column_name: str | None = None
    sheet_name: str | None = None

    affected_count: int = Field(default=0, ge=0)
    affected_percentage: float = Field(default=0, ge=0, le=100)

    evidence: list[str] = Field(default_factory=list)
    recommendation: str | None = None


class QualitySummary(BaseModel):
    """Summarize dataset quality metrics."""

    model_config = ConfigDict(extra="forbid")

    total_cells: int = Field(default=0, ge=0)
    missing_cells: int = Field(default=0, ge=0)

    duplicate_rows: int = Field(default=0, ge=0)

    invalid_values: int = Field(default=0, ge=0)

    total_issues: int = Field(default=0, ge=0)

    status: DatasetStatus = DatasetStatus.UNKNOWN

    health_score: float | None = Field(
        default=None,
        ge=0,
        le=100,
    )