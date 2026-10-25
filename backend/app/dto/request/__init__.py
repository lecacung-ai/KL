"""Request DTOs accepted by the API."""

from app.dto.request.auth import TokenPayload
from app.dto.request.item import ItemCreate, ItemUpdate
from app.dto.request.user import (
    NewPassword,
    UpdatePassword,
    UserCreate,
    UserRegister,
    UserUpdate,
    UserUpdateMe,
)

__all__ = [
    "ItemCreate", "ItemUpdate", "NewPassword", "TokenPayload",
    "UpdatePassword", "UserCreate", "UserRegister", "UserUpdate",
    "UserUpdateMe",
]
