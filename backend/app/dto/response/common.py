"""Shared response DTOs."""

from sqlmodel import SQLModel


class Message(SQLModel):
    message: str


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


__all__ = ["Message", "Token"]
