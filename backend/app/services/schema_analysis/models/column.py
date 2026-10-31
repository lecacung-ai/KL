"""Models for dataset column schema and semantic inference."""

from enum import Enum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class SemanticType(str, Enum):
    INTEGER = "Integer"
    FLOAT = "Float"
    STRING = "String"
    TEXT = "Text"
    BOOLEAN = "Boolean"
    DATE = "Date"
    DATETIME = "Datetime"
    TIME = "Time"
    CATEGORICAL = "Categorical"
    IDENTIFIER = "Identifier"
    CURRENCY = "Currency"
    PERCENTAGE = "Percentage"
    MIXED = "Mixed"
    UNKNOWN = "Unknown"


class SemanticRole(str, Enum):
    IDENTIFIER = "Identifier"
    TEMPORAL = "Temporal"
    MEASURE = "Measure"
    DIMENSION = "Dimension"
    STATUS = "Status"
    DESCRIPTION = "Description"
    DERIVED = "Derived"
    TECHNICAL = "Technical"
    UNKNOWN = "Unknown"


class ColumnSchema(BaseModel):
    """Describe the structure, type and quality of a dataset column."""

    model_config = ConfigDict(extra="forbid")

    # Original column information
    name: str
    position: int = Field(ge=0)
    normalized_name: str | None = None
    is_duplicate_name: bool = False

    # Physical and semantic types
    physical_type: str
    semantic_type: SemanticType = SemanticType.UNKNOWN
    semantic_role: SemanticRole = SemanticRole.UNKNOWN

    # Type inference information
    confidence: float | None = Field(default=None, ge=0, le=1)
    evidence: list[str] = Field(default_factory=list)
    reasoning: str | None = None

    # Column statistics
    row_count: int = Field(default=0, ge=0)
    non_null_count: int = Field(default=0, ge=0)
    missing_count: int = Field(default=0, ge=0)
    missing_percentage: float = Field(default=0, ge=0, le=100)
    unique_count: int = Field(default=0, ge=0)

    # Data quality information
    invalid_count: int = Field(default=0, ge=0)
    is_constant: bool = False
    sample_values: list[Any] = Field(default_factory=list)