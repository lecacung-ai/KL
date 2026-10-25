"""Forecast API request DTO."""

import uuid

from pydantic import BaseModel


class ForecastRequest(BaseModel):
    dataset_id: uuid.UUID
    target_column: str
    date_column: str | None = None
    horizon: int = 3
    model_type: str = "linear_regression"


__all__ = ["ForecastRequest"]
