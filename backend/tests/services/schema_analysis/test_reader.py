import pandas as pd

from app.services.schema_analysis.reader import DataReader


def test_read_vietnamese_csv(tmp_path):
    file_path = tmp_path / "sales.csv"
    file_path.write_text(
        "Mã hàng;Số lượng;Doanh thu\n"
        "SP001;10;500000\n"
        "SP002;20;700000\n",
        encoding="utf-8-sig",
    )

    result = DataReader().read(file_path)

    assert result.metadata.file_type == "csv"
    assert result.metadata.encoding == "utf-8-sig"
    assert result.metadata.delimiter == ";"
    assert len(result.sheets) == 1

    dataframe = result.sheets[0].dataframe

    # Reader must preserve the first row as data.
    assert dataframe.iloc[0, 0] == "Mã hàng"
    assert dataframe.shape == (3, 3)


def test_reader_does_not_remove_empty_columns(tmp_path):
    file_path = tmp_path / "empty_column.csv"
    file_path.write_text(
        "Product,Quantity,\n"
        "A,10,\n"
        "B,20,\n",
        encoding="utf-8",
    )

    result = DataReader().read(file_path)
    dataframe = result.sheets[0].dataframe

    assert dataframe.shape == (3, 3)


def test_reader_preserves_original_column_order(tmp_path):
    file_path = tmp_path / "order.csv"
    file_path.write_text(
        "C,A,B\n"
        "3,1,2\n",
        encoding="utf-8",
    )

    result = DataReader().read(file_path)
    dataframe = result.sheets[0].dataframe

    assert list(dataframe.iloc[0]) == ["C", "A", "B"]