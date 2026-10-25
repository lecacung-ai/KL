"""Analysis history response DTOs."""

from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel


class AnalysisHistoryPublic(SQLModel):
    dataset_name: str = Field(max_length=255)
    query: str = Field(max_length=1000)
    ai_code: str | None = None
    stdout: str | None = None
    status: str = Field(default="success", max_length=50)
    error_message: str | None = None
    execution_time_ms: float = 0.0
    memory_mb: float = 0.0
    chart_image: str | None = None
    scope_columns: str | None = Field(default=None, max_length=500)
    id: uuid.UUID
    user_id: uuid.UUID
    dataset_id: uuid.UUID | None = None
    created_at: datetime | None = None


class AnalysisHistoriesPublic(SQLModel):
    data: list[AnalysisHistoryPublic]
    count: int


__all__ = ["AnalysisHistoriesPublic", "AnalysisHistoryPublic"]
