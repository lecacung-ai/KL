
import pandas as pd

from app.services.schema_analysis.quality_profiler import QualityProfiler


def test_profile_counts_missing_values():
    df = pd.DataFrame({
        "name": ["An", "Bình", None, "Dũng"],
        "age": [20, None, 30, 40],
    })

    result = QualityProfiler().profile(df)

    assert result.row_count == 4
    assert result.column_count == 2
    assert result.total_cells == 8
    assert result.missing_cells == 2

    assert result.columns[0].missing_count == 1
    assert result.columns[1].missing_count == 1


def test_profile_counts_blank_strings_as_missing():
    df = pd.DataFrame({
        "name": ["An", " ", "Bình", ""],
    })

    result = QualityProfiler().profile(df)

    assert result.columns[0].missing_count == 2
    assert result.columns[0].non_null_count == 2


def test_profile_detects_constant_column():
    df = pd.DataFrame({
        "status": ["Active", "Active", "Active"],
        "name": ["An", "Bình", "Cường"],
    })

    result = QualityProfiler().profile(df)

    assert result.columns[0].is_constant is True
    assert result.columns[1].is_constant is False


def test_all_missing_column_is_not_constant():
    df = pd.DataFrame({
        "empty": [None, None, None],
    })

    result = QualityProfiler().profile(df)

    assert result.columns[0].is_constant is False
    assert result.columns[0].unique_count == 0


def test_profile_detects_duplicate_rows():
    df = pd.DataFrame({
        "id": [1, 2, 2, 3],
        "name": ["An", "Bình", "Bình", "Cường"],
    })

    result = QualityProfiler().profile(df)

    assert result.duplicate_rows == 1


def test_profile_handles_duplicate_column_names():
    df = pd.DataFrame(
        [["An", 20], ["Bình", None]],
        columns=["value", "value"],
    )

    result = QualityProfiler().profile(df)

    assert len(result.columns) == 2
    assert result.columns[0].position == 0
    assert result.columns[1].position == 1
    assert result.columns[1].missing_count == 1


def test_profile_does_not_modify_original_dataframe():
    df = pd.DataFrame({
        "name": ["An", None, "Bình"],
    })
    original = df.copy(deep=True)

    QualityProfiler().profile(df)

    pd.testing.assert_frame_equal(df, original)


def test_empty_dataframe():
    df = pd.DataFrame()

    result = QualityProfiler().profile(df)

    assert result.row_count == 0
    assert result.column_count == 0
    assert result.total_cells == 0
    assert result.missing_cells == 0
    assert result.duplicate_rows == 0
