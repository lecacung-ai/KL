from app.services.schema_analysis.models import (
    DataLayout,
    LayoutInference,
    SheetSchema,
)


def test_layout_inference_creation():
    layout = LayoutInference(
        layout=DataLayout.TRANSPOSED,
        confidence=0.95,
        evidence=[
            "First column contains metric names",
            "Remaining columns contain monthly values",
        ],
        reasoning="Metrics are organized by rows.",
        requires_transformation=True,
    )

    assert layout.layout == DataLayout.TRANSPOSED
    assert layout.confidence == 0.95
    assert layout.requires_transformation is True


def test_sheet_schema_has_default_layout():
    sheet = SheetSchema(
        name="Sales",
        position=0,
        row_count=100,
        column_count=5,
    )

    assert sheet.layout.layout == DataLayout.UNKNOWN