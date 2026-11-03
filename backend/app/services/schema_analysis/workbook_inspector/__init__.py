"""Workbook Inspector package: safe physical ingestion and inspection of Excel workbooks."""

from app.services.schema_analysis.workbook_inspector.exceptions import (
    CorruptedWorkbookError,
    SheetInspectionError,
    UnsupportedFileFormatError,
    WorkbookAccessError,
    WorkbookInspectionError,
    WorkbookNotFoundError,
    WorkbookSizeExceededError,
)
from app.services.schema_analysis.workbook_inspector.inspector import (
    WorkbookInspector,
    workbook_inspector,
)
from app.services.schema_analysis.workbook_inspector.models import (
    DataBoundaries,
    InspectionStatus,
    SheetMetadata,
    SheetVisibility,
    WorkbookFormat,
    WorkbookInspectionResult,
    WorkbookMetadata,
    WorksheetDimensions,
)
from app.services.schema_analysis.workbook_inspector.reader import WorkbookReader
from app.services.schema_analysis.workbook_inspector.sheet_inspector import (
    SheetInspector,
)

__all__ = [
    "CorruptedWorkbookError",
    "DataBoundaries",
    "InspectionStatus",
    "SheetInspectionError",
    "SheetInspector",
    "SheetMetadata",
    "SheetVisibility",
    "UnsupportedFileFormatError",
    "WorkbookAccessError",
    "WorkbookFormat",
    "WorkbookInspectionError",
    "WorkbookInspectionResult",
    "WorkbookInspector",
    "WorkbookMetadata",
    "WorkbookNotFoundError",
    "WorkbookReader",
    "WorkbookSizeExceededError",
    "WorksheetDimensions",
    "workbook_inspector",
]
