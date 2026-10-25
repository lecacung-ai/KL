"""User response DTOs."""

from datetime import datetime
import uuid

from pydantic import EmailStr
from sqlmodel import Field, SQLModel


class UserPublic(SQLModel):
    email: EmailStr = Field(max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


__all__ = ["UserPublic", "UsersPublic"]
