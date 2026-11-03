"""HTTP controller for user management endpoints."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends

from app.api.deps import (
    CurrentUser,
    SessionDep,
    get_current_active_superuser,
)
from app.dto.request.user import UpdatePassword, UserCreate, UserRegister, UserUpdate, UserUpdateMe
from app.dto.response.common import Message
from app.dto.response.user import UserPublic, UsersPublic
from app.mappers.user_mapper import to_user_response, to_users_response
from app.services.email_service import send_email
from app.services.user_service import user_service

router = APIRouter(prefix="/users", tags=["users"])


@router.get(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UsersPublic,
)
def read_users(session: SessionDep, skip: int = 0, limit: int = 100) -> UsersPublic:
    """Retrieve users list (superuser only)."""
    users, count = user_service.list(session, skip=skip, limit=limit)
    return to_users_response(users, count)


@router.post(
    "/",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def create_user(*, session: SessionDep, user_in: UserCreate) -> UserPublic:
    """Create a new user (superuser only)."""
    user = user_service.create(session, user_in)
    return to_user_response(user)


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    *, session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> UserPublic:
    """Update current user profile."""
    updated = user_service.update_me(session, current_user, user_in)
    return to_user_response(updated)


@router.patch("/me/password", response_model=Message)
def update_password_me(
    *, session: SessionDep, body: UpdatePassword, current_user: CurrentUser
) -> Message:
    """Update current user password."""
    user_service.change_password(session, current_user, body)
    return Message(message="Password updated successfully")


@router.get("/me", response_model=UserPublic)
def read_user_me(current_user: CurrentUser) -> UserPublic:
    """Get current authenticated user profile."""
    return to_user_response(current_user)


@router.delete("/me", response_model=Message)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> Message:
    """Delete current authenticated user account."""
    user_service.delete_me(session, current_user)
    return Message(message="User deleted successfully")


@router.post("/signup", response_model=UserPublic)
def register_user(session: SessionDep, user_in: UserRegister) -> UserPublic:
    """Public self-registration for new users."""
    user = user_service.register(session, user_in)
    return to_user_response(user)


@router.get("/{user_id}", response_model=UserPublic)
def read_user_by_id(
    user_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> UserPublic:
    """Get a specific user by ID."""
    user = user_service.get_user_by_id(session, user_id, current_user)
    return to_user_response(user)


@router.patch(
    "/{user_id}",
    dependencies=[Depends(get_current_active_superuser)],
    response_model=UserPublic,
)
def update_user(
    *,
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> UserPublic:
    """Update a user by ID (superuser only)."""
    updated = user_service.update_user(session, user_id, user_in)
    return to_user_response(updated)


@router.delete("/{user_id}", dependencies=[Depends(get_current_active_superuser)])
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> Message:
    """Delete a user by ID (superuser only)."""
    user_service.delete_user(session, user_id, current_user)
    return Message(message="User deleted successfully")
