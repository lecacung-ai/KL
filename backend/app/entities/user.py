"""User persistence entity."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship

from app.entities.base import UserBase, get_datetime_utc


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list["Item"] = Relationship(back_populates="owner", cascade_delete=True)


__all__ = ["User"]
