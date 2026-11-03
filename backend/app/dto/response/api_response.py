"""Standard API response wrapper following Devteria Spring Boot pattern."""

from typing import Generic, TypeVar
from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    code: int = Field(default=1000, description="Business response code (1000 = success)")
    message: str = Field(default="Success", description="Status or error message")
    result: T | None = Field(default=None, description="Response payload")


__all__ = ["ApiResponse"]
