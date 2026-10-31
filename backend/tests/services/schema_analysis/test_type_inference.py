
import pandas as pd

from app.services.schema_analysis.type_inference import TypeInference
from app.services.schema_analysis.models.column import SemanticType


def test_infer_integer():
    series = pd.Series([10, 20, 30, 40])

    result = TypeInference().infer(series, "Age")

    assert result["semantic_type"] == SemanticType.INTEGER


def test_infer_vietnamese_boolean():
    series = pd.Series(["Có", "Không", "Có", "Không"])

    result = TypeInference().infer(series, "Đã thanh toán")

    assert result["semantic_type"] == SemanticType.BOOLEAN


def test_infer_identifier():
    series = pd.Series(["KH001", "KH002", "KH003"])

    result = TypeInference().infer(series, "Customer ID")

    assert result["semantic_type"] == SemanticType.IDENTIFIER


def test_infer_currency_from_column_name():
    series = pd.Series([100000, 200000, 300000])

    result = TypeInference().infer(series, "Doanh thu")

    assert result["semantic_type"] == SemanticType.CURRENCY


def test_infer_categorical():
    series = pd.Series([
        "Hà Nội",
        "Hồ Chí Minh",
        "Hà Nội",
        "Hồ Chí Minh",
    ])

    result = TypeInference().infer(series, "Khu vực")

    assert result["semantic_type"] == SemanticType.CATEGORICAL


def test_all_missing_column():
    series = pd.Series([None, None, None])

    result = TypeInference().infer(series, "Unknown")

    assert result["semantic_type"] == SemanticType.UNKNOWN
    assert result["confidence"] == 0.0
