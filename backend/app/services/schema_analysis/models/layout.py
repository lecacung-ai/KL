"""Models for dataset layout detection."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class DataLayout(str, Enum):
    TABULAR = "tabular"
    TRANSPOSED = "transposed"
    KEY_VALUE = "key_value"
    REPORT = "report"
    UNKNOWN = "unknown"


class LayoutInference(BaseModel):
    """Store the inferred structural layout of a dataset."""

    model_config = ConfigDict(extra="forbid")

    layout: DataLayout = DataLayout.UNKNOWN

    confidence: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
    )

    evidence: list[str] = Field(default_factory=list)

    reasoning: str | None = None

    requires_transformation: bool = False

    warnings: list[str] = Field(default_factory=list)