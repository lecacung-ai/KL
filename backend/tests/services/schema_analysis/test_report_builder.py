
from app.services.schema_analysis.models.column import (
    ColumnSchema,
    SemanticRole,
    SemanticType,
)
from app.services.schema_analysis.models.dataset import (
    DatasetSchema,
    FileType,
    SheetSchema,
)
from app.services.schema_analysis.models.quality import (
    DatasetStatus,
    IssueSeverity,
    QualityIssue,
    QualitySummary,
)
from app.services.schema_analysis.models.report import (
    SchemaAnalysisResult,
)
from app.services.schema_analysis.report_builder import (
    ReportBuilder,
)


def make_analysis_result():
    column = ColumnSchema(
        name="Doanh thu",
        position=0,
        physical_type="object",
        semantic_type=SemanticType.FLOAT,
        semantic_role=SemanticRole.MEASURE,
        missing_count=2,
        missing_percentage=20.0,
        unique_count=8,
    )

    sheet = SheetSchema(
        name="Sales",
        position=0,
        row_count=10,
        column_count=1,
        columns=[column],
    )

    dataset = DatasetSchema(
        filename="sales.xlsx",
        file_type=FileType.XLSX,
        sheet_count=1,
        total_row_count=10,
        total_column_count=1,
        sheets=[sheet],
    )

    quality = QualitySummary(
        total_cells=10,
        missing_cells=2,
        duplicate_rows=0,
        invalid_values=1,
        total_issues=1,
        status=DatasetStatus.WARNING,
    )

    issue = QualityIssue(
        code="INVALID_VALUE_TYPE",
        severity=IssueSeverity.WARNING,
        message="Có 1 giá trị không hợp lệ.",
        column_name="Doanh thu",
        affected_count=1,
    )

    return SchemaAnalysisResult(
        dataset=dataset,
        quality=quality,
        issues=[issue],
        recommendations=["Kiểm tra giá trị không hợp lệ."],
    )


def test_report_builder_creates_overview():
    result = make_analysis_result()

    report = ReportBuilder().build(result)

    assert report["overview"]["filename"] == "sales.xlsx"
    assert report["overview"]["status"] == "warning"
    assert report["overview"]["total_rows"] == 10


def test_report_builder_calculates_missing_percentage():
    result = make_analysis_result()

    report = ReportBuilder().build(result)

    assert report["quality"]["missing_percentage"] == 20.0


def test_report_builder_includes_column_information():
    result = make_analysis_result()

    report = ReportBuilder().build(result)

    column = report["sheets"][0]["columns"][0]

    assert column["name"] == "Doanh thu"
    assert column["semantic_type"] == "Float"
    assert column["missing_count"] == 2


def test_report_builder_includes_issues():
    result = make_analysis_result()

    report = ReportBuilder().build(result)

    assert len(report["issues"]) == 1
    assert report["issues"][0]["code"] == "INVALID_VALUE_TYPE"
    assert report["issues"][0]["affected_count"] == 1


def test_report_builder_includes_recommendations():
    result = make_analysis_result()

    report = ReportBuilder().build(result)

    assert len(report["recommendations"]) == 1
    assert "Kiểm tra" in report["recommendations"][0]
