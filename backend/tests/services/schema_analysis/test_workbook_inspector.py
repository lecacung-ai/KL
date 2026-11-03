"""Unit and integration tests for Workbook Ingestion and Workbook Inspector."""

import contextlib
import hashlib
import tempfile
from pathlib import Path

import openpyxl

try:
    import pytest
except ImportError:
    class _PytestMock:
        @staticmethod
        @contextlib.contextmanager
        def raises(expected_exception):
            try:
                yield
            except expected_exception:
                pass
            except Exception as e:
                raise AssertionError(
                    f"Expected {expected_exception.__name__}, got {type(e).__name__}: {e}"
                )
            else:
                raise AssertionError(
                    f"Expected exception {expected_exception.__name__} was not raised"
                )

    pytest = _PytestMock()

from app.services.schema_analysis.workbook_inspector import (
    CorruptedWorkbookError,
    SheetVisibility,
    UnsupportedFileFormatError,
    WorkbookInspector,
    WorkbookNotFoundError,
    workbook_inspector,
)
from app.services.schema_analysis.workbook_inspector.models import (
    InspectionStatus,
)


def _compute_sha256(path: Path) -> str:
    """Compute sha256 hash of a file to verify immutability."""
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


# ---------------------------------------------------------------------------
# 1. Workbook with single sheet
# ---------------------------------------------------------------------------
def test_workbook_single_sheet(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "MainReport"
    ws["A1"] = "Product"
    ws["B1"] = "Price"
    ws["A2"] = "Laptop"
    ws["B2"] = 1200

    file_path = tmp_path / "single_sheet.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    assert result.workbook_metadata.file_name == "single_sheet.xlsx"
    assert result.workbook_metadata.sheet_count == 1
    assert result.workbook_metadata.sheet_names == ["MainReport"]
    assert result.total_sheets == 1
    assert result.total_non_empty_cells == 4
    assert result.workbook_metadata.inspection_status == InspectionStatus.SUCCESS
    assert result.inspection_duration >= 0.0

    sheet = result.sheets[0]
    assert sheet.sheet_name == "MainReport"
    assert sheet.sheet_index == 0
    assert sheet.has_data is True
    assert sheet.data_range == "A1:B2"
    assert sheet.non_empty_cell_count == 4


# ---------------------------------------------------------------------------
# 2. Workbook with multiple sheets (order and completeness preserved)
# ---------------------------------------------------------------------------
def test_workbook_multiple_sheets_ordered(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "First"
    ws1["A1"] = "Data1"

    ws2 = wb.create_sheet("Second")
    ws2["A1"] = "Data2"

    ws3 = wb.create_sheet("Third")
    ws3["A1"] = "Data3"

    file_path = tmp_path / "multi_sheet.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    assert result.total_sheets == 3
    assert result.workbook_metadata.sheet_names == ["First", "Second", "Third"]
    assert [s.sheet_name for s in result.sheets] == ["First", "Second", "Third"]
    assert [s.sheet_index for s in result.sheets] == [0, 1, 2]


# ---------------------------------------------------------------------------
# 3. Sheet hidden
# ---------------------------------------------------------------------------
def test_sheet_hidden_state(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "VisibleSheet"
    ws1["A1"] = 1

    ws2 = wb.create_sheet("HiddenSheet")
    ws2.sheet_state = "hidden"
    ws2["A1"] = "Secret"

    file_path = tmp_path / "hidden_sheets.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    assert len(result.sheets) == 2
    assert result.sheets[0].visibility == SheetVisibility.VISIBLE
    assert result.sheets[1].visibility == SheetVisibility.HIDDEN


# ---------------------------------------------------------------------------
# 4. Sheet veryHidden
# ---------------------------------------------------------------------------
def test_sheet_very_hidden_state(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Normal"
    ws1["A1"] = "Hi"

    ws2 = wb.create_sheet("VerySecret")
    ws2.sheet_state = "veryHidden"
    ws2["A1"] = "TopSecret"

    file_path = tmp_path / "very_hidden.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    assert result.sheets[1].visibility == SheetVisibility.VERY_HIDDEN
    assert result.sheets[1].has_data is True


# ---------------------------------------------------------------------------
# 5. Sheet completely empty
# ---------------------------------------------------------------------------
def test_sheet_completely_empty(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "EmptySheet"

    file_path = tmp_path / "empty.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    assert sheet.has_data is False
    assert sheet.data_range is None
    assert sheet.actual_boundaries is None
    assert sheet.non_empty_cell_count == 0
    assert sheet.empty_row_count == 0
    assert sheet.empty_column_count == 0
    assert any("hoàn toàn không có dữ liệu" in w for w in sheet.warnings)


# ---------------------------------------------------------------------------
# 6. Sheet with formulas (detection, count, no evaluation)
# ---------------------------------------------------------------------------
def test_sheet_with_formulas(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Formulas"
    ws["A1"] = 10
    ws["A2"] = 20
    ws["A3"] = "=SUM(A1:A2)"
    ws["B3"] = "=AVERAGE(A1:A2)"

    file_path = tmp_path / "formulas.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    assert sheet.has_formula is True
    assert sheet.formula_count == 2
    assert "A3" in sheet.formula_cells
    assert "B3" in sheet.formula_cells
    assert result.total_formula_count == 2


# ---------------------------------------------------------------------------
# 7. Sheet with merged cells (ranges retrieved, not unmerged)
# ---------------------------------------------------------------------------
def test_sheet_merged_cells(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Merged"
    ws["A1"] = "Header Title"
    ws.merge_cells("A1:C1")
    ws.merge_cells("D2:E4")

    file_path = tmp_path / "merged.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    assert sheet.has_merged_cells is True
    assert "A1:C1" in sheet.merged_ranges
    assert "D2:E4" in sheet.merged_ranges
    assert len(sheet.merged_ranges) == 2


# ---------------------------------------------------------------------------
# 8. Sheet with hidden rows
# ---------------------------------------------------------------------------
def test_sheet_hidden_rows(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "HiddenRows"
    ws["A1"] = "Row 1"
    ws["A2"] = "Row 2"
    ws["A3"] = "Row 3"
    ws.row_dimensions[2].hidden = True
    ws.row_dimensions[5].hidden = True

    file_path = tmp_path / "hidden_rows.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    assert 2 in sheet.hidden_rows
    assert 5 in sheet.hidden_rows


# ---------------------------------------------------------------------------
# 9. Sheet with hidden columns
# ---------------------------------------------------------------------------
def test_sheet_hidden_columns(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "HiddenCols"
    ws["A1"] = "Col A"
    ws["B1"] = "Col B"
    ws["C1"] = "Col C"
    ws.column_dimensions["B"].hidden = True

    file_path = tmp_path / "hidden_cols.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    assert "B" in sheet.hidden_columns


# ---------------------------------------------------------------------------
# 10. Sheet with empty rows and columns inside actual data boundaries
# ---------------------------------------------------------------------------
def test_sheet_empty_rows_and_columns_in_boundaries(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Gaps"
    # Row 1: A1, C1
    ws["A1"] = "A1"
    ws["C1"] = "C1"
    # Row 2: Completely empty
    # Row 3: A3, C3
    ws["A3"] = "A3"
    ws["C3"] = "C3"

    file_path = tmp_path / "gaps.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    assert sheet.actual_boundaries is not None
    assert sheet.actual_boundaries.min_row == 1
    assert sheet.actual_boundaries.max_row == 3
    assert sheet.actual_boundaries.min_column == 1
    assert sheet.actual_boundaries.max_column == 3
    assert sheet.data_range == "A1:C3"

    # Row 2 is completely empty inside boundary [1, 3]
    assert 2 in sheet.empty_rows
    assert sheet.empty_row_count == 1

    # Column B (index 2) is completely empty inside boundary [1, 3]
    assert "B" in sheet.empty_columns
    assert sheet.empty_column_count == 1


# ---------------------------------------------------------------------------
# 11. Distinction between worksheet reported dimensions vs actual boundaries
# ---------------------------------------------------------------------------
def test_bloated_dimensions_distinction(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Bloated"
    ws["A1"] = "RealData1"
    ws["B2"] = "RealData2"
    # Simulate Excel bloated dimensions by setting a blank formatted cell far away
    ws.cell(row=500, column=20, value="")

    file_path = tmp_path / "bloated.xlsx"
    wb.save(file_path)
    wb.close()

    result = workbook_inspector.inspect(file_path)

    sheet = result.sheets[0]
    # Worksheet declared dimension reflects row 500
    assert sheet.worksheet_dimensions is not None
    assert sheet.worksheet_dimensions.max_row >= 500
    assert sheet.worksheet_dimensions.max_column >= 20

    # Actual non-empty data boundary must be only A1:B2
    assert sheet.actual_boundaries is not None
    assert sheet.actual_boundaries.min_row == 1
    assert sheet.actual_boundaries.max_row == 2
    assert sheet.actual_boundaries.min_column == 1
    assert sheet.actual_boundaries.max_column == 2
    assert sheet.data_range == "A1:B2"
    assert sheet.non_empty_cell_count == 2


# ---------------------------------------------------------------------------
# 12. Immutability: original file must not be modified after inspection
# ---------------------------------------------------------------------------
def test_original_file_immutability(tmp_path: Path) -> None:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "ReadOnlyCheck"
    ws["A1"] = "Original Content"
    ws["B2"] = "=SUM(1, 2)"
    ws.merge_cells("A1:B1")

    file_path = tmp_path / "immutable.xlsx"
    wb.save(file_path)
    wb.close()

    hash_before = _compute_sha256(file_path)

    result = workbook_inspector.inspect(file_path)
    assert result.workbook_metadata.inspection_status == InspectionStatus.SUCCESS

    hash_after = _compute_sha256(file_path)
    assert hash_before == hash_after, "File gốc đã bị thay đổi sau khi inspect!"


# ---------------------------------------------------------------------------
# 13. Exception handling: File not found
# ---------------------------------------------------------------------------
def test_file_not_found(tmp_path: Path) -> None:
    non_existent = tmp_path / "non_existent.xlsx"
    with pytest.raises(WorkbookNotFoundError):
        workbook_inspector.inspect(non_existent)


# ---------------------------------------------------------------------------
# 14. Exception handling: Unsupported formats (.csv, .txt, legacy .xls)
# ---------------------------------------------------------------------------
def test_unsupported_format(tmp_path: Path) -> None:
    csv_file = tmp_path / "test.csv"
    csv_file.write_text("a,b,c\n1,2,3")
    with pytest.raises(UnsupportedFileFormatError):
        workbook_inspector.inspect(csv_file)

    xls_file = tmp_path / "test.xls"
    xls_file.write_bytes(b"dummy binary")
    with pytest.raises(UnsupportedFileFormatError):
        workbook_inspector.inspect(xls_file)


# ---------------------------------------------------------------------------
# 15. Exception handling: Corrupted file
# ---------------------------------------------------------------------------
def test_corrupted_file(tmp_path: Path) -> None:
    bad_file = tmp_path / "corrupted.xlsx"
    bad_file.write_bytes(b"This is completely invalid zip content")
    with pytest.raises(CorruptedWorkbookError):
        workbook_inspector.inspect(bad_file)


# ---------------------------------------------------------------------------
# Self-runner when executed directly via python
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Running Workbook Inspector tests directly...")
    with tempfile.TemporaryDirectory() as td:
        tpath = Path(td)
        test_fns = [
            ("Single Sheet", test_workbook_single_sheet),
            ("Multiple Sheets Ordered", test_workbook_multiple_sheets_ordered),
            ("Hidden Sheet", test_sheet_hidden_state),
            ("VeryHidden Sheet", test_sheet_very_hidden_state),
            ("Empty Sheet", test_sheet_completely_empty),
            ("Formulas", test_sheet_with_formulas),
            ("Merged Cells", test_sheet_merged_cells),
            ("Hidden Rows", test_sheet_hidden_rows),
            ("Hidden Columns", test_sheet_hidden_columns),
            ("Empty Rows and Columns in Boundary", test_sheet_empty_rows_and_columns_in_boundaries),
            ("Bloated Dimensions Distinction", test_bloated_dimensions_distinction),
            ("Original File Immutability", test_original_file_immutability),
            ("File Not Found", test_file_not_found),
            ("Unsupported Format", test_unsupported_format),
            ("Corrupted File", test_corrupted_file),
        ]

        passed = 0
        failed = 0
        for name, fn in test_fns:
            try:
                fn(tpath)
                print(f"  [PASS] {name}")
                passed += 1
            except Exception as e:
                print(f"  [FAIL] {name}: {e}")
                import traceback

                traceback.print_exc()
                failed += 1

        print(f"\nResult: {passed} passed, {failed} failed.")
        if failed > 0:
            raise RuntimeError(f"{failed} tests failed!")
