"""User entity to response DTO mapping."""

from app.dto.response.user import UserPublic
from app.entities.user import User


def to_user_response(entity: User) -> UserPublic:
    return UserPublic.model_validate(entity)

