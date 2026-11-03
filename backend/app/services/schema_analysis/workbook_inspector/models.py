"""Data models and contracts for Excel workbook inspection."""

from enum import Enum
from pydantic import BaseModel, ConfigDict, Field


class SheetVisibility(str, Enum):
    """Visibility state of an Excel worksheet."""

    VISIBLE = "visible"
    HIDDEN = "hidden"
    VERY_HIDDEN = "very_hidden"


class InspectionStatus(str, Enum):
    """Status of the workbook inspection process."""

    SUCCESS = "success"
    PARTIAL_SUCCESS = "partial_success"
    FAILED = "failed"


class WorkbookFormat(str, Enum):
    """Excel workbook container formats."""

    XLSX = "xlsx"
    XLSM = "xlsm"
    XLTX = "xltx"
    XLTM = "xltm"
    XLS = "xls"
    UNKNOWN = "unknown"


class WorksheetDimensions(BaseModel):
    """Worksheet dimensions as declared by Excel sheet properties."""

    model_config = ConfigDict(extra="forbid")

    min_row: int = Field(default=1, ge=1)
    max_row: int = Field(default=1, ge=1)
    min_column: int = Field(default=1, ge=1)
    max_column: int = Field(default=1, ge=1)


class DataBoundaries(BaseModel):
    """Actual non-empty data boundaries discovered by inspecting cell contents."""

    model_config = ConfigDict(extra="forbid")

    min_row: int | None = Field(default=None, ge=1)
    max_row: int | None = Field(default=None, ge=1)
    min_column: int | None = Field(default=None, ge=1)
    max_column: int | None = Field(default=None, ge=1)


class SheetMetadata(BaseModel):
    """Physical structure metadata for a single Excel worksheet."""

    model_config = ConfigDict(extra="forbid")

    sheet_name: str
    sheet_index: int = Field(ge=0)
    visibility: SheetVisibility = SheetVisibility.VISIBLE

    # Dimensions
    max_row: int = Field(default=0, ge=0)
    max_column: int = Field(default=0, ge=0)
    worksheet_dimensions: WorksheetDimensions | None = None
    actual_boundaries: DataBoundaries | None = None
    data_range: str | None = None

    # Cell and data metrics
    non_empty_cell_count: int = Field(default=0, ge=0)
    empty_row_count: int = Field(default=0, ge=0)
    empty_column_count: int = Field(default=0, ge=0)
    has_data: bool = False

    # Formulas
    has_formula: bool = False
    formula_count: int = Field(default=0, ge=0)
    formula_cells: list[str] = Field(default_factory=list)
    cached_formula_value_count: int = Field(default=0, ge=0)

    # Merged cells
    has_merged_cells: bool = False
    merged_ranges: list[str] = Field(default_factory=list)

    # Hidden structures
    hidden_rows: list[int] = Field(default_factory=list)
    hidden_columns: list[str] = Field(default_factory=list)

    # Empty structural elements within actual boundaries
    empty_rows: list[int] = Field(default_factory=list)
    empty_columns: list[str] = Field(default_factory=list)

    # Sheet-level warnings and errors
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


class WorkbookMetadata(BaseModel):
    """Metadata describing the overall Excel workbook container."""

    model_config = ConfigDict(extra="forbid")

    file_name: str
    file_type: str
    file_size: int = Field(ge=0)
    sheet_count: int = Field(default=0, ge=0)
    sheet_names: list[str] = Field(default_factory=list)
    workbook_format: str
    inspection_status: InspectionStatus = InspectionStatus.SUCCESS
    inspection_warnings: list[str] = Field(default_factory=list)
    is_macro_enabled: bool = False
    has_external_links: bool = False


class WorkbookInspectionResult(BaseModel):
    """Consolidated physical inspection report for an Excel workbook."""

    model_config = ConfigDict(extra="forbid")

    workbook_metadata: WorkbookMetadata
    sheets: list[SheetMetadata] = Field(default_factory=list)
    total_sheets: int = Field(default=0, ge=0)
    total_non_empty_cells: int = Field(default=0, ge=0)
    total_formula_count: int = Field(default=0, ge=0)
    warnings: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
    inspection_duration: float = Field(default=0.0, ge=0.0)
