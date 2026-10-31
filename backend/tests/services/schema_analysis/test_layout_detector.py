
import pandas as pd

from app.services.schema_analysis.layout_detector import LayoutDetector
from app.services.schema_analysis.models.layout import DataLayout


def test_detect_tabular_layout():
    dataframe = pd.DataFrame([
        ["Tháng", "Sản phẩm", "Doanh thu"],
        ["Tháng 1", "Laptop", 500000],
        ["Tháng 2", "Điện thoại", 300000],
    ])

    result = LayoutDetector().detect(dataframe)

    assert result.layout == DataLayout.TABULAR


def test_detect_transposed_layout():
    dataframe = pd.DataFrame([
        ["Chỉ tiêu", "Tháng 1", "Tháng 2"],
        ["Doanh thu", 500000, 300000],
        ["Số lượng", 10, 20],
    ])

    result = LayoutDetector().detect(dataframe)

    assert result.layout == DataLayout.TRANSPOSED


def test_detect_key_value_layout():
    dataframe = pd.DataFrame([
        ["Tên", "Nguyễn Văn A"],
        ["Tuổi", 25],
        ["Thành phố", "Hồ Chí Minh"],
    ])

    result = LayoutDetector().detect(dataframe)

    assert result.layout == DataLayout.KEY_VALUE


def test_detect_unknown_layout():
    dataframe = pd.DataFrame([
        [None, None, None],
        ["A", None, None],
    ])

    result = LayoutDetector().detect(dataframe)

    assert result.layout == DataLayout.UNKNOWN
