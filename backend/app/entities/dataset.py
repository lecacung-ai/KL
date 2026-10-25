"""Dataset persistence entity."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship

from app.entities.base import DatasetBase, get_datetime_utc


class Dataset(DatasetBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: "User" = Relationship()
    file_path: str = Field(max_length=500)


__all__ = ["Dataset"]
