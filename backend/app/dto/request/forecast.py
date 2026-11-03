"""Forecast and classification API request DTOs."""

import uuid
from pydantic import BaseModel


class ForecastRequest(BaseModel):
    dataset_id: uuid.UUID
    target_column: str
    date_column: str | None = None
    horizon: int = 3
    model_type: str = "linear_regression"


class ClassificationRequest(BaseModel):
    dataset_id: uuid.UUID
    target_column: str
    feature_columns: list[str] = []
    test_size: float = 0.25


__all__ = ["ForecastRequest", "ClassificationRequest"]
