"""Item response DTOs."""

from datetime import datetime
import uuid

from sqlmodel import Field, SQLModel


class ItemPublic(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


__all__ = ["ItemPublic", "ItemsPublic"]
