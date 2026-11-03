"""Unit tests for InteractiveDataService."""

import tempfile
from pathlib import Path

import openpyxl
import pandas as pd

from app.services.interactive_data_service import interactive_data_service


def test_suggest_column_names_heuristics():
    # 1. Dates
    date_series = pd.Series(["2023-01-01", "2023-01-02", "2023-01-03"])
    sugs = interactive_data_service._suggest_column_names(date_series, 0)
    assert any("ngày" in s.lower().replace("_", " ") or "thời gian" in s.lower().replace("_", " ") for s in sugs)

    # 2. Currencies / Large numbers
    money_series = pd.Series([10000000, 25000000, 50000000])
    sugs = interactive_data_service._suggest_column_names(money_series, 1)
    assert any("tiền" in s.lower().replace("_", " ") or "doanh thu" in s.lower().replace("_", " ") for s in sugs)

    # 3. Companies / Organizations
    company_series = pd.Series(["Vinamilk Corp", "FPT Telecom Ltd", "Viettel Group"])
    sugs = interactive_data_service._suggest_column_names(company_series, 2)
    assert any("công ty" in s.lower().replace("_", " ") or "doanh nghiệp" in s.lower().replace("_", " ") for s in sugs)


def test_compute_fill_suggestions():
    # Numeric column with missing
    num_series = pd.Series([10.0, 20.0, 30.0, None])
    fills = interactive_data_service._compute_fill_suggestions(num_series)
    assert fills["mean"] == 20.0
    assert fills["median"] == 20.0
    assert fills["zero"] == 0

    # Categorical column
    cat_series = pd.Series(["Hà Nội", "Hà Nội", "Đà Nẵng", None])
    fills = interactive_data_service._compute_fill_suggestions(cat_series)
    assert fills["mode"] == "Hà Nội"
    assert fills["placeholder"] == "Chưa xác định"


def test_inspect_file_for_interaction_excel(tmp_path: Path):
    excel_file = tmp_path / "test_wb.xlsx"
    wb = openpyxl.Workbook()

    # Sheet 1: Normal tabular
    ws1 = wb.active
    ws1.title = "Standard"
    ws1.append(["Ngày", "Doanh Thu", "Ghi Chú"])
    ws1.append(["2023-05-01", 15000000, "Bình thường"])
    ws1.append(["2023-05-02", None, "Thiếu doanh thu"])

    # Sheet 2: Headerless
    ws2 = wb.create_sheet("NoHeader")
    ws2.append(["2023-06-01", "Công ty ABC", 80000000])
    ws2.append(["2023-06-02", "Công ty XYZ", 95000000])

    wb.save(excel_file)

    inspection = interactive_data_service.inspect_file_for_interaction(
        str(excel_file), "test_wb.xlsx"
    )

    assert inspection["total_sheets"] == 2
    sheet1 = inspection["sheets"][0]
    assert sheet1["name"] == "Standard"
    assert sheet1["has_header"] is True
    assert sheet1["missing_summary"]["total_missing"] == 1
    assert len(sheet1["missing_cells"]) == 1
    assert sheet1["missing_cells"][0]["column_name"] == "Doanh Thu"

    sheet2 = inspection["sheets"][1]
    assert sheet2["name"] == "NoHeader"
    assert sheet2["has_header"] is False
    assert len(sheet2["columns"][0]["suggestions"]) > 0
