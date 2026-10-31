"""User entity to response DTO mapping."""

from app.dto.response.user import UserPublic, UsersPublic
from app.entities.user import User


def to_user_response(entity: User) -> UserPublic:
    return UserPublic.model_validate(entity)


def to_users_response(entities: list[User], count: int | None = None) -> UsersPublic:
    return UsersPublic(
        data=[to_user_response(entity) for entity in entities],
        count=len(entities) if count is None else count,
    )

