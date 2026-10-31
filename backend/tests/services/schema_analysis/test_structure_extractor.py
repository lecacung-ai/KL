
import pandas as pd

from app.services.schema_analysis.structure_extractor import (
    StructureExtractor,
)


def test_detect_header_after_title():
    dataframe = pd.DataFrame([
        ["BÁO CÁO DOANH THU", None, None],
        ["Tháng", "Sản phẩm", "Doanh thu"],
        ["01/2026", "Laptop", 500000],
        ["02/2026", "Điện thoại", 300000],
    ])

    result = StructureExtractor().extract(dataframe)

    assert result.header_row == 1
    assert result.column_names == [
        "Tháng",
        "Sản phẩm",
        "Doanh thu",
    ]
    assert result.row_count == 2


def test_detect_duplicate_columns():
    dataframe = pd.DataFrame([
        ["Tên", "Tên", "Tuổi"],
        ["An", "Bình", 20],
    ])

    result = StructureExtractor().extract(dataframe)

    assert "Tên" in result.duplicate_columns


def test_detect_unnamed_columns():
    dataframe = pd.DataFrame([
        ["Tên", None, "Tuổi"],
        ["An", 100, 20],
    ])

    result = StructureExtractor().extract(dataframe)

    assert 1 in result.unnamed_columns
    assert result.column_names[1] == "Unnamed_2"
