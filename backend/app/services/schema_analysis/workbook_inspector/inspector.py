"""Workbook Inspector: orchestrates reader and sheet inspectors into a unified result."""

import logging
import time
from pathlib import Path

from app.services.schema_analysis.workbook_inspector.exceptions import (
    WorkbookInspectionError,
)
from app.services.schema_analysis.workbook_inspector.models import (
    InspectionStatus,
    SheetMetadata,
    WorkbookInspectionResult,
    WorkbookMetadata,
)
from app.services.schema_analysis.workbook_inspector.reader import WorkbookReader
from app.services.schema_analysis.workbook_inspector.sheet_inspector import (
    SheetInspector,
)

logger = logging.getLogger(__name__)


class WorkbookInspector:
    """Coordinates workbook reading and individual sheet inspections."""

    def __init__(
        self,
        reader: WorkbookReader | None = None,
        sheet_inspector: SheetInspector | None = None,
    ) -> None:
        self.reader = reader or WorkbookReader()
        self.sheet_inspector = sheet_inspector or SheetInspector()

    def inspect(self, file_path: str | Path) -> WorkbookInspectionResult:
        """Inspect all worksheets of an Excel workbook and produce a consolidated report."""
        start_time = time.perf_counter()
        path = self.reader.validate_file(file_path)

        logger.info("Bắt đầu kiểm tra workbook: '%s'", path)

        file_name = path.name
        file_type = path.suffix.lower().lstrip(".")
        file_size = path.stat().st_size
        is_macro = file_type in {"xlsm", "xltm"}

        sheet_metadata_list: list[SheetMetadata] = []
        global_warnings: list[str] = []
        global_errors: list[str] = []

        try:
            with self.reader.open_workbook(path, data_only=False) as wb:
                sheet_names = list(wb.sheetnames)
                has_external_links = bool(getattr(wb, "external_values", []))

                # Optionally attempt to open data_only workbook for cached values
                cached_wb = None
                try:
                    cached_wb = self.reader.load_workbook(path, data_only=True)
                except Exception as cache_exc:
                    logger.debug("Không thể mở cached workbook view: %s", cache_exc)

                try:
                    for index, sheet in enumerate(wb.worksheets):
                        cached_ws = (
                            cached_wb[sheet.title]
                            if cached_wb and sheet.title in cached_wb.sheetnames
                            else None
                        )
                        try:
                            sheet_meta = self.sheet_inspector.inspect(
                                worksheet=sheet,
                                sheet_index=index,
                                cached_worksheet=cached_ws,
                            )
                            sheet_metadata_list.append(sheet_meta)
                        except Exception as sheet_err:
                            logger.error(
                                "Lỗi khi kiểm tra sheet '%s' trong workbook '%s': %s",
                                sheet.title,
                                path.name,
                                sheet_err,
                                exc_info=True,
                            )
                            fallback_meta = SheetMetadata(
                                sheet_name=sheet.title,
                                sheet_index=index,
                                errors=[
                                    f"Không thể kiểm tra toàn diện sheet '{sheet.title}': {sheet_err}"
                                ],
                            )
                            sheet_metadata_list.append(fallback_meta)
                            global_warnings.append(
                                f"Sheet '{sheet.title}' gặp lỗi trong quá trình kiểm tra."
                            )
                finally:
                    if cached_wb is not None:
                        self.reader.close_workbook(cached_wb)

        except WorkbookInspectionError:
            raise
        except Exception as exc:
            logger.error("Lỗi nghiêm trọng khi kiểm tra workbook '%s': %s", path, exc, exc_info=True)
            global_errors.append(f"Lỗi kiểm tra cấp workbook: {exc}")
            duration = round(time.perf_counter() - start_time, 4)
            return WorkbookInspectionResult(
                workbook_metadata=WorkbookMetadata(
                    file_name=file_name,
                    file_type=file_type,
                    file_size=file_size,
                    sheet_count=0,
                    sheet_names=[],
                    workbook_format=file_type,
                    inspection_status=InspectionStatus.FAILED,
                    inspection_warnings=global_warnings,
                    is_macro_enabled=is_macro,
                ),
                sheets=[],
                total_sheets=0,
                total_non_empty_cells=0,
                total_formula_count=0,
                warnings=global_warnings,
                errors=global_errors,
                inspection_duration=duration,
            )

        # Aggregate warnings and errors
        all_warnings = list(global_warnings)
        all_errors = list(global_errors)

        total_cells = 0
        total_formulas = 0

        for sm in sheet_metadata_list:
            total_cells += sm.non_empty_cell_count
            total_formulas += sm.formula_count
            for w in sm.warnings:
                all_warnings.append(f"[{sm.sheet_name}] {w}")
            for e in sm.errors:
                all_errors.append(f"[{sm.sheet_name}] {e}")

        # Determine overall inspection status
        if all_errors:
            status = InspectionStatus.PARTIAL_SUCCESS if sheet_metadata_list else InspectionStatus.FAILED
        else:
            status = InspectionStatus.SUCCESS

        workbook_meta = WorkbookMetadata(
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
            sheet_count=len(sheet_metadata_list),
            sheet_names=sheet_names,
            workbook_format=file_type,
            inspection_status=status,
            inspection_warnings=global_warnings,
            is_macro_enabled=is_macro,
            has_external_links=has_external_links,
        )

        duration = round(time.perf_counter() - start_time, 4)

        logger.info(
            "Hoàn thành kiểm tra workbook '%s' trong %.4f giây. "
            "Sheets: %d, Cells: %d, Formulas: %d, Status: %s",
            file_name,
            duration,
            len(sheet_metadata_list),
            total_cells,
            total_formulas,
            status.value,
        )

        return WorkbookInspectionResult(
            workbook_metadata=workbook_meta,
            sheets=sheet_metadata_list,
            total_sheets=len(sheet_metadata_list),
            total_non_empty_cells=total_cells,
            total_formula_count=total_formulas,
            warnings=all_warnings,
            errors=all_errors,
            inspection_duration=duration,
        )


workbook_inspector = WorkbookInspector()
