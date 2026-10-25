"""Standard API error response DTO."""

from typing import Any

from sqlmodel import SQLModel


class ErrorResponse(SQLModel):
    code: str
    message: str
    detail: Any


__all__ = ["ErrorResponse"]
