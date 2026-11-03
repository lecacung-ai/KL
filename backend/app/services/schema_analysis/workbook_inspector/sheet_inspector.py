"""Sheet Inspector module: deep structural and physical inspection of individual worksheets."""

import logging
from typing import Any

from openpyxl.utils import column_index_from_string, get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

from app.services.schema_analysis.workbook_inspector.models import (
    DataBoundaries,
    SheetMetadata,
    SheetVisibility,
    WorksheetDimensions,
)

logger = logging.getLogger(__name__)


class SheetInspector:
    """Performs non-destructive physical inspection of an Excel worksheet."""

    MAX_RECORDED_FORMULA_CELLS = 500

    def inspect(
        self,
        worksheet: Worksheet,
        sheet_index: int,
        cached_worksheet: Worksheet | None = None,
    ) -> SheetMetadata:
        """Inspect a single worksheet and extract its physical structure and metrics."""
        sheet_name = worksheet.title
        logger.debug("Bắt đầu kiểm tra sheet [%d]: '%s'", sheet_index, sheet_name)

        warnings: list[str] = []
        errors: list[str] = []

        # 1. Visibility inspection
        visibility = self._inspect_visibility(worksheet)

        # 2. Worksheet declared dimensions
        worksheet_dims = WorksheetDimensions(
            min_row=worksheet.min_row or 1,
            max_row=worksheet.max_row or 1,
            min_column=worksheet.min_column or 1,
            max_column=worksheet.max_column or 1,
        )

        # 3. Merged cell inspection
        has_merged_cells, merged_ranges = self._inspect_merged_cells(worksheet)

        # 4. Hidden structure inspection
        hidden_rows = self._inspect_hidden_rows(worksheet)
        hidden_columns = self._inspect_hidden_columns(worksheet)

        # 5. Cell-level scanning (Data boundaries, non-empty count, formulas, empty rows/columns)
        (
            has_data,
            non_empty_cell_count,
            actual_boundaries,
            data_range,
            has_formula,
            formula_count,
            formula_cells,
            cached_formula_count,
            empty_rows,
            empty_columns,
        ) = self._inspect_cell_content(
            worksheet=worksheet,
            cached_worksheet=cached_worksheet,
            warnings=warnings,
        )

        if not has_data:
            warnings.append(f"Worksheet '{sheet_name}' hoàn toàn không có dữ liệu.")

        return SheetMetadata(
            sheet_name=sheet_name,
            sheet_index=sheet_index,
            visibility=visibility,
            max_row=worksheet_dims.max_row,
            max_column=worksheet_dims.max_column,
            worksheet_dimensions=worksheet_dims,
            actual_boundaries=actual_boundaries,
            data_range=data_range,
            non_empty_cell_count=non_empty_cell_count,
            empty_row_count=len(empty_rows),
            empty_column_count=len(empty_columns),
            has_data=has_data,
            has_formula=has_formula,
            formula_count=formula_count,
            formula_cells=formula_cells,
            cached_formula_value_count=cached_formula_count,
            has_merged_cells=has_merged_cells,
            merged_ranges=merged_ranges,
            hidden_rows=hidden_rows,
            hidden_columns=hidden_columns,
            empty_rows=empty_rows,
            empty_columns=empty_columns,
            warnings=warnings,
            errors=errors,
        )

    def _inspect_visibility(self, worksheet: Worksheet) -> SheetVisibility:
        """Identify if the sheet is visible, hidden, or veryHidden."""
        state = getattr(worksheet, "sheet_state", "visible")
        if state == "hidden":
            return SheetVisibility.HIDDEN
        if state == "veryHidden":
            return SheetVisibility.VERY_HIDDEN
        return SheetVisibility.VISIBLE

    def _inspect_merged_cells(self, worksheet: Worksheet) -> tuple[bool, list[str]]:
        """Extract merged cell ranges without modifying them."""
        ranges = [str(cell_range) for cell_range in worksheet.merged_cells.ranges]
        return len(ranges) > 0, sorted(ranges)

    def _inspect_hidden_rows(self, worksheet: Worksheet) -> list[int]:
        """Detect all hidden row indices (1-based)."""
        hidden: list[int] = []
        for row_idx, row_dim in worksheet.row_dimensions.items():
            if getattr(row_dim, "hidden", False):
                try:
                    hidden.append(int(row_idx))
                except (ValueError, TypeError):
                    continue
        return sorted(hidden)

    def _inspect_hidden_columns(self, worksheet: Worksheet) -> list[str]:
        """Detect all hidden column letters."""
        hidden: set[str] = set()
        for key, col_dim in worksheet.column_dimensions.items():
            if getattr(col_dim, "hidden", False):
                min_col = getattr(col_dim, "min", None)
                max_col = getattr(col_dim, "max", None)

                if min_col is not None and max_col is not None:
                    for col_idx in range(min_col, max_col + 1):
                        hidden.add(get_column_letter(col_idx))
                elif isinstance(key, str):
                    hidden.add(key.upper())

        def col_sort_key(col_letter: str) -> int:
            try:
                return column_index_from_string(col_letter)
            except Exception:
                return 0

        return sorted(hidden, key=col_sort_key)

    def _inspect_cell_content(
        self,
        worksheet: Worksheet,
        cached_worksheet: Worksheet | None,
        warnings: list[str],
    ) -> tuple[
        bool,
        int,
        DataBoundaries | None,
        str | None,
        bool,
        int,
        list[str],
        int,
        list[int],
        list[str],
    ]:
        """Scan cells to compute actual boundaries, formulas, and empty structures."""
        rows_with_data: set[int] = set()
        cols_with_data: set[int] = set()
        non_empty_count = 0
        formula_count = 0
        formula_cells: list[str] = []
        cached_formula_count = 0

        # Iterating through all cells containing values or formatting
        for row in worksheet.iter_rows():
            for cell in row:
                val = cell.value
                is_formula = (cell.data_type == "f") or (
                    isinstance(val, str) and val.startswith("=")
                )

                is_empty = False
                if val is None and not is_formula:
                    is_empty = True
                elif isinstance(val, str) and not is_formula and val.strip() == "":
                    is_empty = True

                if not is_empty:
                    non_empty_count += 1
                    rows_with_data.add(cell.row)
                    cols_with_data.add(cell.column)

                if is_formula:
                    formula_count += 1
                    if len(formula_cells) < self.MAX_RECORDED_FORMULA_CELLS:
                        formula_cells.append(cell.coordinate)

                    if cached_worksheet is not None:
                        try:
                            cached_cell = cached_worksheet[cell.coordinate]
                            if (
                                cached_cell.value is not None
                                and not str(cached_cell.value).startswith("#")
                            ):
                                cached_formula_count += 1
                        except Exception:
                            pass

        if formula_count > self.MAX_RECORDED_FORMULA_CELLS:
            warnings.append(
                f"Worksheet chứa {formula_count} công thức. "
                f"Chỉ lưu trữ tọa độ của {self.MAX_RECORDED_FORMULA_CELLS} ô đầu tiên."
            )

        has_data = non_empty_count > 0

        if not has_data:
            return (
                False,
                0,
                None,
                None,
                formula_count > 0,
                formula_count,
                formula_cells,
                cached_formula_count,
                [],
                [],
            )

        actual_min_row = min(rows_with_data)
        actual_max_row = max(rows_with_data)
        actual_min_col = min(cols_with_data)
        actual_max_col = max(cols_with_data)

        actual_boundaries = DataBoundaries(
            min_row=actual_min_row,
            max_row=actual_max_row,
            min_column=actual_min_col,
            max_column=actual_max_col,
        )

        start_col_letter = get_column_letter(actual_min_col)
        end_col_letter = get_column_letter(actual_max_col)
        data_range = f"{start_col_letter}{actual_min_row}:{end_col_letter}{actual_max_row}"

        # Detect empty rows within the actual bounded range
        all_row_indices = set(range(actual_min_row, actual_max_row + 1))
        empty_row_indices = sorted(all_row_indices - rows_with_data)

        # Detect empty columns within the actual bounded range
        all_col_indices = set(range(actual_min_col, actual_max_col + 1))
        empty_col_indices = sorted(all_col_indices - cols_with_data)
        empty_col_letters = [get_column_letter(c) for c in empty_col_indices]

        return (
            True,
            non_empty_count,
            actual_boundaries,
            data_range,
            formula_count > 0,
            formula_count,
            formula_cells,
            cached_formula_count,
            empty_row_indices,
            empty_col_letters,
        )
