"""Analysis history persistence entity."""

import uuid
from datetime import datetime

from sqlalchemy import DateTime
from sqlmodel import Field, Relationship

from app.entities.base import AnalysisHistoryBase, get_datetime_utc


class AnalysisHistory(AnalysisHistoryBase, table=True):
    __tablename__ = "analysis_history"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    dataset_id: uuid.UUID | None = Field(
        default=None, foreign_key="dataset.id", ondelete="SET NULL"
    )
    user: "User" = Relationship()


__all__ = ["AnalysisHistory"]
