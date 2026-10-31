"""Models for dataset and worksheet structure."""

from enum import Enum

from pydantic import BaseModel, ConfigDict, Field

from app.services.schema_analysis.models.column import ColumnSchema

from app.services.schema_analysis.models.layout import LayoutInference


class FileType(str, Enum):
    CSV = "csv"
    XLSX = "xlsx"
    XLS = "xls"
    UNKNOWN = "unknown"


class SheetSchema(BaseModel):
    """Describe one worksheet or one CSV table."""

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
    position: int = Field(ge=0)

    row_count: int = Field(default=0, ge=0)
    column_count: int = Field(default=0, ge=0)

    header_row: int | None = Field(default=None, ge=0)

    columns: list[ColumnSchema] = Field(default_factory=list)

    is_empty: bool = False

    layout: LayoutInference = Field(
        default_factory=LayoutInference
    )


class DatasetSchema(BaseModel):
    """Describe the complete uploaded dataset."""

    model_config = ConfigDict(extra="forbid")

    filename: str
    file_type: FileType = FileType.UNKNOWN

    file_size_bytes: int = Field(default=0, ge=0)

    sheet_count: int = Field(default=0, ge=0)
    total_row_count: int = Field(default=0, ge=0)
    total_column_count: int = Field(default=0, ge=0)

    sheets: list[SheetSchema] = Field(default_factory=list)