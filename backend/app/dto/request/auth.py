"""Authentication request payloads."""

from sqlmodel import SQLModel


class TokenPayload(SQLModel):
    sub: str | None = None


__all__ = ["TokenPayload"]
