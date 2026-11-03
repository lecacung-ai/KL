"""Exceptions for workbook inspection operations."""


class WorkbookInspectionError(Exception):
    """Base exception for all workbook inspection errors."""

    def __init__(self, message: str, details: dict | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class WorkbookNotFoundError(WorkbookInspectionError, FileNotFoundError):
    """Raised when the specified workbook file does not exist."""


class UnsupportedFileFormatError(WorkbookInspectionError, ValueError):
    """Raised when the workbook format is not supported by the inspector."""


class CorruptedWorkbookError(WorkbookInspectionError):
    """Raised when the workbook file is corrupted or cannot be parsed."""


class WorkbookSizeExceededError(WorkbookInspectionError):
    """Raised when the file size exceeds the configured safety threshold."""


class WorkbookAccessError(WorkbookInspectionError, PermissionError):
    """Raised when permission issues prevent accessing the workbook file."""


class SheetInspectionError(WorkbookInspectionError):
    """Raised when an unrecoverable error occurs while inspecting a specific sheet."""

    def __init__(
        self,
        sheet_name: str,
        message: str,
        original_error: Exception | None = None,
    ) -> None:
        super().__init__(
            f"Lỗi khi kiểm tra sheet '{sheet_name}': {message}",
            details={"sheet_name": sheet_name, "error": str(original_error)},
        )
        self.sheet_name = sheet_name
        self.original_error = original_error
