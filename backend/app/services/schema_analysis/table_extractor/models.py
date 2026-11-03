"""Data models and contracts for Phase 2: Header Detection, Layout Detection & Table Region Extraction."""

from enum import Enum
from pydantic import BaseModel, ConfigDict, Field

from app.services.schema_analysis.models.layout import DataLayout


class HeaderType(str, Enum):
    """Categorization of header presence and structure."""

    SINGLE_ROW_HEADER = "single_row_header"
    MULTI_ROW_HEADER = "multi_row_header"
    NO_HEADER = "no_header"
    UNKNOWN_HEADER = "unknown_header"
    NEEDS_CONFIRMATION = "needs_confirmation"


class HeaderDetectionResult(BaseModel):
    """Detailed result of header detection for a table region."""

    model_config = ConfigDict(extra="forbid")

    header_type: HeaderType = HeaderType.UNKNOWN_HEADER
    header_rows: list[int] = Field(default_factory=list)  # 0-based row indices relative to table region
    header_start_row: int | None = None
    header_end_row: int | None = None
    column_names: list[str] = Field(default_factory=list)
    header_levels: list[list[str]] = Field(default_factory=list)  # Preserves raw levels for multi-row
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    reasoning: str | None = None


class TableRegion(BaseModel):
    """Represents an isolated, distinct data region discovered within a worksheet."""

    model_config = ConfigDict(extra="forbid")

    table_id: str
    start_row: int = Field(ge=0)      # 0-based row index in worksheet
    end_row: int = Field(ge=0)        # 0-based row index in worksheet (inclusive)
    start_column: int = Field(ge=0)   # 0-based column index in worksheet
    end_column: int = Field(ge=0)     # 0-based column index in worksheet (inclusive)
    range: str                        # Excel coordinate range e.g. "A5:E20"
    header_info: HeaderDetectionResult
    layout_type: DataLayout = DataLayout.TABULAR
    non_empty_cell_count: int = Field(default=0, ge=0)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)


class SheetStructureAnalysisResult(BaseModel):
    """Consolidated structural analysis result for a complete worksheet."""

    model_config = ConfigDict(extra="forbid")

    sheet_name: str
    sheet_index: int = Field(ge=0)
    overall_layout: DataLayout = DataLayout.UNKNOWN
    table_regions: list[TableRegion] = Field(default_factory=list)
    table_count: int = Field(default=0, ge=0)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    warnings: list[str] = Field(default_factory=list)
    evidence: list[str] = Field(default_factory=list)
    reasoning: str | None = None
