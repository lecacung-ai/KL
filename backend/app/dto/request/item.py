"""Request DTOs for generic items."""

from sqlmodel import Field, SQLModel


class ItemCreate(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


__all__ = ["ItemCreate", "ItemUpdate"]
