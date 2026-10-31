
import pandas as pd

from app.services.schema_analysis.models.column import (
    ColumnSchema,
    SemanticType,
)
from app.services.schema_analysis.quality_validator import (
    QualityValidator,
)


def make_column(name, position, semantic_type):
    return ColumnSchema(
        name=name,
        position=position,
        physical_type="object",
        semantic_type=semantic_type,
    )


def test_validate_numeric_column():
    df = pd.DataFrame({
        "revenue": ["1000", "2000", "invalid", "3000"],
    })

    columns = [
        make_column("revenue", 0, SemanticType.FLOAT),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.columns_checked == 1
    assert result.invalid_values == 1
    assert result.issues[0].code == "INVALID_VALUE_TYPE"
    assert result.issues[0].affected_count == 1


def test_validate_integer_column():
    df = pd.DataFrame({
        "quantity": ["10", "20", "2.5", "abc"],
    })

    columns = [
        make_column("quantity", 0, SemanticType.INTEGER),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.invalid_values == 2


def test_validate_boolean_column():
    df = pd.DataFrame({
        "status": ["Có", "Không", "true", "invalid"],
    })

    columns = [
        make_column("status", 0, SemanticType.BOOLEAN),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.invalid_values == 1


def test_validate_date_column():
    df = pd.DataFrame({
        "order_date": [
            "2026-10-20",
            "21/10/2026",
            "invalid-date",
        ],
    })

    columns = [
        make_column("order_date", 0, SemanticType.DATE),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.invalid_values == 1


def test_missing_values_are_not_invalid_values():
    df = pd.DataFrame({
        "revenue": ["1000", None, "", "invalid"],
    })

    columns = [
        make_column("revenue", 0, SemanticType.FLOAT),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.invalid_values == 1
    assert result.issues[0].affected_percentage == 50.0


def test_identifier_is_not_rejected():
    df = pd.DataFrame({
        "customer_id": ["KH001", "KH002", "00123"],
    })

    columns = [
        make_column("customer_id", 0, SemanticType.IDENTIFIER),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.columns_checked == 0
    assert result.invalid_values == 0
    assert result.issues == []


def test_duplicate_column_names_are_validated_by_position():
    df = pd.DataFrame(
        [
            ["100", "abc"],
            ["200", "300"],
        ],
        columns=["value", "value"],
    )

    columns = [
        make_column("value", 0, SemanticType.INTEGER),
        make_column("value", 1, SemanticType.INTEGER),
    ]

    result = QualityValidator().validate(df, columns)

    assert result.invalid_values == 1
    assert len(result.issues) == 1
    assert result.issues[0].affected_count == 1


def test_validator_does_not_modify_dataframe():
    df = pd.DataFrame({
        "revenue": ["1000", "invalid", None],
    })
    original = df.copy(deep=True)

    columns = [
        make_column("revenue", 0, SemanticType.FLOAT),
    ]

    QualityValidator().validate(df, columns)

    pd.testing.assert_frame_equal(df, original)
