"""Shared entity field bases and timestamp factory."""

from datetime import UTC, datetime

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class DatasetBase(SQLModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: str = Field(default="csv", max_length=50)
    size_bytes: int = Field(default=0)
    row_count: int = Field(default=0)
    column_count: int = Field(default=0)
    version: int = Field(default=1)
    status: str = Field(default="ready", max_length=50)
    description: str | None = Field(default=None, max_length=500)
    schema_info: str | None = Field(default=None)
    sample_data: str | None = Field(default=None)


class AnalysisHistoryBase(SQLModel):
    dataset_name: str = Field(max_length=255)
    query: str = Field(max_length=1000)
    ai_code: str | None = Field(default=None)
    stdout: str | None = Field(default=None)
    status: str = Field(default="success", max_length=50)
    error_message: str | None = Field(default=None)
    execution_time_ms: float = Field(default=0.0)
    memory_mb: float = Field(default=0.0)
    chart_image: str | None = Field(default=None)
    scope_columns: str | None = Field(default=None, max_length=500)


__all__ = [
    "AnalysisHistoryBase",
    "DatasetBase",
    "ItemBase",
    "UserBase",
    "get_datetime_utc",
]
