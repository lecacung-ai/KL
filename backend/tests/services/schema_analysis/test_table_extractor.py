"""Comprehensive Unit and Integration Tests for Phase 2:

Header Detection, Layout Detection & Table Region Extraction.
"""

import contextlib
import tempfile
from pathlib import Path

import openpyxl
import pandas as pd

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

from app.services.schema_analysis.models.layout import DataLayout
from app.services.schema_analysis.table_extractor import (
    HeaderDetectionResult,
    HeaderType,
    SheetStructureAnalysisResult,
    TableRegion,
    header_detector,
    layout_classifier,
    table_region_extractor,
)


# ---------------------------------------------------------------------------
# 1. Single Row Header
# ---------------------------------------------------------------------------
def test_single_row_header() -> None:
    df = pd.DataFrame([
        ["Mã hàng", "Tên sản phẩm", "Số lượng", "Đơn giá"],
        ["SP001", "Bàn làm việc", 10, 1500000],
        ["SP002", "Ghế công thái học", 25, 2300000],
        ["SP003", "Tủ hồ sơ", 5, 3200000],
    ])

    res = header_detector.detect(df)

    assert res.header_type == HeaderType.SINGLE_ROW_HEADER
    assert res.header_rows == [0]
    assert res.header_start_row == 0
    assert res.header_end_row == 0
    assert res.column_names == ["Mã hàng", "Tên sản phẩm", "Số lượng", "Đơn giá"]
    assert res.confidence >= 0.8
    assert len(res.evidence) > 0


# ---------------------------------------------------------------------------
# 2. Multi-Row Header with Merged Cell Hierarchy
# ---------------------------------------------------------------------------
def test_multi_row_header() -> None:
    df = pd.DataFrame([
        ["Khu vực", "Doanh thu", None, "Chi phí", None],
        [None, "Kế hoạch", "Thực tế", "Kế hoạch", "Thực tế"],
        ["Miền Bắc", 1000, 1200, 800, 750],
        ["Miền Nam", 2000, 1900, 1500, 1600],
    ])
    # Simulated merged ranges: B1:C1 for "Doanh thu", D1:E1 for "Chi phí", A1:A2 for "Khu vực"
    merged = ["B1:C1", "D1:E1", "A1:A2"]

    res = header_detector.detect(df, merged_ranges=merged)

    assert res.header_type == HeaderType.MULTI_ROW_HEADER
    assert res.header_rows == [0, 1]
    assert res.header_start_row == 0
    assert res.header_end_row == 1
    assert len(res.header_levels) == 2
    assert "Doanh thu_Kế hoạch" in res.column_names
    assert "Doanh thu_Thực tế" in res.column_names
    assert res.confidence >= 0.85


# ---------------------------------------------------------------------------
# 3. No Header (Pure data matrix from row 0)
# ---------------------------------------------------------------------------
def test_no_header() -> None:
    df = pd.DataFrame([
        [101.5, 204.2, 550.0],
        [105.0, 201.8, 560.5],
        [102.3, 203.4, 555.2],
        [108.1, 207.0, 570.0],
    ])

    res = header_detector.detect(df)

    assert res.header_type == HeaderType.NO_HEADER
    assert res.header_rows == []
    assert res.header_start_row is None
    assert res.column_names == ["Column_1", "Column_2", "Column_3"]
    assert res.confidence >= 0.7


# ---------------------------------------------------------------------------
# 4. Sheet with Report Title Banner (Title Suppression)
# ---------------------------------------------------------------------------
def test_header_after_report_title() -> None:
    df = pd.DataFrame([
        ["BÁO CÁO TÌNH HÌNH KINH DOANH NĂM 2026", None, None, None],
        [None, None, None, None],
        ["Mã đơn", "Ngày đặt", "Khách hàng", "Thành tiền"],
        ["ORD-1", "2026-01-01", "Công ty ABC", 50000000],
        ["ORD-2", "2026-01-02", "Công ty XYZ", 75000000],
    ])

    res = table_region_extractor.extract_regions(df)

    # Must extract 1 main table, starting at row index 2 (ignoring title row 0 and blank row 1)
    assert res.table_count == 1
    table = res.table_regions[0]
    assert table.start_row == 2
    assert table.end_row == 4
    assert table.header_info.header_type == HeaderType.SINGLE_ROW_HEADER
    assert table.header_info.column_names == ["Mã đơn", "Ngày đặt", "Khách hàng", "Thành tiền"]


# ---------------------------------------------------------------------------
# 5. Header after metadata/notes rows
# ---------------------------------------------------------------------------
def test_header_after_notes_rows() -> None:
    df = pd.DataFrame([
        ["Đơn vị: Chi nhánh Hà Nội", None, None],
        ["Ngày xuất báo cáo: 01/11/2026", None, None],
        [None, None, None],
        ["Nhân viên", "Phòng ban", "Lương cơ bản"],
        ["Nguyễn Văn A", "Kỹ thuật", 25000000],
        ["Trần Thị B", "Kinh doanh", 22000000],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 1
    table = res.table_regions[0]
    assert table.start_row == 3
    assert table.header_info.column_names == ["Nhân viên", "Phòng ban", "Lương cơ bản"]


# ---------------------------------------------------------------------------
# 6. Ambiguous signals returning NEEDS_CONFIRMATION
# ---------------------------------------------------------------------------
def test_needs_confirmation_header() -> None:
    # A table where row 0 is ambiguous: mixed alphanumeric codes with no obvious text label
    df = pd.DataFrame([
        ["12A", "99B", "88C"],
        ["14A", "95B", "82C"],
        ["18A", "92B", "80C"],
    ])

    res = header_detector.detect(df)

    # Because all rows are identical alphanumeric formats, confidence is low
    assert res.header_type in {HeaderType.NEEDS_CONFIRMATION, HeaderType.NO_HEADER}
    assert res.confidence < 0.85
    assert len(res.evidence) > 0


# ---------------------------------------------------------------------------
# 7. Two Tables Stacked Vertically (Separated by blank row)
# ---------------------------------------------------------------------------
def test_two_tables_stacked_vertically() -> None:
    df = pd.DataFrame([
        # Table 1 (rows 0-2)
        ["Sản phẩm", "Doanh thu"],
        ["Laptop", 5000],
        ["Điện thoại", 3000],
        # Blank row (row 3)
        [None, None],
        # Table 2 (rows 4-6)
        ["Chi nhánh", "Nhân sự"],
        ["Hà Nội", 45],
        ["Đà Nẵng", 20],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 2
    assert res.overall_layout == DataLayout.MULTI_TABLE

    t1, t2 = res.table_regions[0], res.table_regions[1]
    assert t1.start_row == 0
    assert t1.end_row == 2
    assert t1.header_info.column_names == ["Sản phẩm", "Doanh thu"]

    assert t2.start_row == 4
    assert t2.end_row == 6
    assert t2.header_info.column_names == ["Chi nhánh", "Nhân sự"]


# ---------------------------------------------------------------------------
# 8. Two Tables Side-by-Side (Separated by blank column)
# ---------------------------------------------------------------------------
def test_two_tables_side_by_side() -> None:
    df = pd.DataFrame([
        # Table 1 (cols 0-1) | Blank col 2 | Table 2 (cols 3-4)
        ["Tháng", "Thu", None, "Tháng", "Chi"],
        ["T1", 100, None, "T1", 80],
        ["T2", 120, None, "T2", 90],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 2
    assert res.overall_layout == DataLayout.MULTI_TABLE

    t1 = res.table_regions[0]
    assert t1.start_column == 0
    assert t1.end_column == 1
    assert t1.header_info.column_names == ["Tháng", "Thu"]

    t2 = res.table_regions[1]
    assert t2.start_column == 3
    assert t2.end_column == 4
    assert t2.header_info.column_names == ["Tháng", "Chi"]


# ---------------------------------------------------------------------------
# 9. Table with Merged Cells inside data body
# ---------------------------------------------------------------------------
def test_table_with_merged_cells() -> None:
    df = pd.DataFrame([
        ["Mã dự án", "Giai đoạn", "Ngân sách"],
        ["PRJ-01", "Giai đoạn 1", 500000000],
        ["PRJ-01", "Giai đoạn 2", 300000000],
    ])
    # A2:A3 is merged for PRJ-01
    merged = ["A2:A3"]

    res = table_region_extractor.extract_regions(df, merged_ranges=merged)

    assert res.table_count == 1
    t = res.table_regions[0]
    assert t.start_row == 0
    assert t.end_row == 2
    assert t.range == "A1:C3"


# ---------------------------------------------------------------------------
# 10. Table with Totals / Summary Row
# ---------------------------------------------------------------------------
def test_table_with_totals_row() -> None:
    df = pd.DataFrame([
        ["Mục", "Số tiền"],
        ["Tiền phòng", 5000000],
        ["Tiền điện", 1200000],
        ["Tổng cộng", 6200000],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 1
    t = res.table_regions[0]
    assert t.end_row == 3
    assert t.non_empty_cell_count == 8


# ---------------------------------------------------------------------------
# 11. Key-Value Layout Detection
# ---------------------------------------------------------------------------
def test_key_value_layout() -> None:
    df = pd.DataFrame([
        ["Mã khách hàng", "CUST-992"],
        ["Tên công ty", "Tập đoàn Viễn thông ABC"],
        ["Mã số thuế", "0101234567"],
        ["Đại diện pháp luật", "Lê Văn Hùng"],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 1
    t = res.table_regions[0]
    assert t.layout_type == DataLayout.KEY_VALUE
    assert res.overall_layout == DataLayout.KEY_VALUE


# ---------------------------------------------------------------------------
# 12. Crosstab / Pivot Matrix Layout Detection
# ---------------------------------------------------------------------------
def test_crosstab_layout() -> None:
    df = pd.DataFrame([
        ["Khu vực / Quý", "Q1", "Q2", "Q3", "Q4"],
        ["Miền Bắc", 500, 620, 710, 850],
        ["Miền Trung", 300, 350, 400, 480],
        ["Miền Nam", 900, 950, 1100, 1300],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 1
    t = res.table_regions[0]
    assert t.layout_type == DataLayout.CROSSTAB
    assert res.overall_layout == DataLayout.CROSSTAB


# ---------------------------------------------------------------------------
# 13. Transposed Layout Detection
# ---------------------------------------------------------------------------
def test_transposed_layout() -> None:
    df = pd.DataFrame([
        ["Chỉ tiêu", "2023", "2024", "2025"],
        ["Tổng doanh thu", 1000000, 1500000, 2200000],
        ["Lợi nhuận sau thuế", 200000, 350000, 500000],
        ["Số lượng nhân sự", 50, 85, 120],
    ])

    res = table_region_extractor.extract_regions(df)

    assert res.table_count == 1
    t = res.table_regions[0]
    assert t.layout_type == DataLayout.TRANSPOSED
    assert res.overall_layout == DataLayout.TRANSPOSED


# ---------------------------------------------------------------------------
# Self-runner when executed directly via python
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Running Phase 2: Table Extractor Test Suite...")
    test_cases = [
        ("Single Row Header", test_single_row_header),
        ("Multi-Row Header", test_multi_row_header),
        ("No Header", test_no_header),
        ("Header After Report Title", test_header_after_report_title),
        ("Header After Notes Rows", test_header_after_notes_rows),
        ("Needs Confirmation Header", test_needs_confirmation_header),
        ("Two Tables Stacked Vertically", test_two_tables_stacked_vertically),
        ("Two Tables Side-by-Side", test_two_tables_side_by_side),
        ("Table With Merged Cells", test_table_with_merged_cells),
        ("Table With Totals Row", test_table_with_totals_row),
        ("Key-Value Layout", test_key_value_layout),
        ("Crosstab Layout", test_crosstab_layout),
        ("Transposed Layout", test_transposed_layout),
    ]

    passed = 0
    failed = 0
    for name, fn in test_cases:
        try:
            fn()
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
