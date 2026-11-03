"""Workbook Reader module: safe opening, format verification, and resource management."""

import logging
import zipfile
from contextlib import contextmanager
from pathlib import Path
from typing import Generator

import openpyxl
from openpyxl.workbook import Workbook

from app.services.schema_analysis.workbook_inspector.exceptions import (
    CorruptedWorkbookError,
    UnsupportedFileFormatError,
    WorkbookAccessError,
    WorkbookNotFoundError,
    WorkbookSizeExceededError,
)

logger = logging.getLogger(__name__)


class WorkbookReader:
    """Safely opens Excel workbooks using OpenPyXL and manages resource cleanup."""

    SUPPORTED_EXTENSIONS = {".xlsx", ".xlsm", ".xltx", ".xltm"}
    MACRO_EXTENSIONS = {".xlsm", ".xltm"}
    LEGACY_EXTENSIONS = {".xls"}
    DEFAULT_MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024  # 100 MB

    def __init__(self, max_file_size_bytes: int = DEFAULT_MAX_FILE_SIZE_BYTES) -> None:
        self.max_file_size_bytes = max_file_size_bytes

    def validate_file(self, file_path: str | Path) -> Path:
        """Validate existence, format, and size of the workbook file."""
        path = Path(file_path)

        if not path.exists():
            raise WorkbookNotFoundError(f"Tệp không tồn tại: {path}")

        if not path.is_file():
            raise WorkbookNotFoundError(f"Đường dẫn không phải là tệp: {path}")

        ext = path.suffix.lower()

        if ext in self.LEGACY_EXTENSIONS:
            raise UnsupportedFileFormatError(
                f"Định dạng Excel cũ '{ext}' (BIFF8) không được hỗ trợ bởi OpenPyXL. "
                "Vui lòng chuyển đổi tệp sang định dạng .xlsx để tiếp tục phân tích."
            )

        if ext not in self.SUPPORTED_EXTENSIONS:
            raise UnsupportedFileFormatError(
                f"Định dạng tệp không được hỗ trợ: '{ext}'. "
                f"Chỉ hỗ trợ các định dạng: {', '.join(sorted(self.SUPPORTED_EXTENSIONS))}"
            )

        try:
            size_bytes = path.stat().st_size
        except OSError as exc:
            raise WorkbookAccessError(f"Không thể đọc thông tin tệp: {exc}") from exc

        if size_bytes > self.max_file_size_bytes:
            raise WorkbookSizeExceededError(
                f"Kích thước tệp ({size_bytes} bytes) vượt quá giới hạn cho phép "
                f"({self.max_file_size_bytes} bytes)."
            )

        return path

    def load_workbook(self, file_path: str | Path, data_only: bool = False) -> Workbook:
        """Load an OpenPyXL workbook instance with appropriate safety flags."""
        path = self.validate_file(file_path)
        ext = path.suffix.lower()
        is_macro = ext in self.MACRO_EXTENSIONS

        logger.info(
            "Đang mở workbook '%s' (data_only=%s, is_macro=%s, size=%d bytes)",
            path.name,
            data_only,
            is_macro,
            path.stat().st_size,
        )

        try:
            return openpyxl.load_workbook(
                filename=str(path),
                data_only=data_only,
                read_only=False,
                keep_vba=is_macro,
            )
        except (WorkbookNotFoundError, UnsupportedFileFormatError, WorkbookSizeExceededError):
            raise
        except PermissionError as exc:
            logger.error("Không có quyền truy cập tệp '%s': %s", path, exc)
            raise WorkbookAccessError(f"Không có quyền đọc tệp: {path}") from exc
        except (zipfile.BadZipFile, openpyxl.utils.exceptions.InvalidFileException) as exc:
            logger.error("Tệp Excel bị hỏng hoặc không đúng định dạng OOXML '%s': %s", path, exc)
            raise CorruptedWorkbookError(
                f"Tệp Excel bị hỏng hoặc không thể phân tích cấu trúc: {exc}"
            ) from exc
        except Exception as exc:
            logger.error("Lỗi không xác định khi mở workbook '%s': %s", path, exc)
            raise CorruptedWorkbookError(
                f"Không thể mở workbook do lỗi bất thường: {exc}"
            ) from exc

    def close_workbook(self, wb: Workbook | None) -> None:
        """Safely close an open workbook instance."""
        if wb is not None:
            try:
                wb.close()
            except Exception as close_exc:
                logger.warning("Lỗi khi đóng workbook: %s", close_exc)

    @contextmanager
    def open_workbook(
        self,
        file_path: str | Path,
        data_only: bool = False,
    ) -> Generator[Workbook, None, None]:
        """Context manager to open an Excel workbook and guarantee proper closure."""
        wb: Workbook | None = None
        try:
            wb = self.load_workbook(file_path, data_only=data_only)
            yield wb
        finally:
            self.close_workbook(wb)
