"""Dataset response DTOs."""

from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel


class DatasetPublic(SQLModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: str = Field(default="csv", max_length=50)
    size_bytes: int = 0
    row_count: int = 0
    column_count: int = 0
    version: int = 1
    status: str = Field(default="ready", max_length=50)
    description: str | None = Field(default=None, max_length=500)
    schema_info: str | None = None
    sample_data: str | None = None
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class DatasetsPublic(SQLModel):
    data: list[DatasetPublic]
    count: int


__all__ = ["DatasetPublic", "DatasetsPublic"]
