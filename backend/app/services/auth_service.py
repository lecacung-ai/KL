"""Authentication application service following Devteria's AuthenticationService pattern."""

from datetime import timedelta
from typing import Any

from fastapi.responses import HTMLResponse
from sqlmodel import Session

from app.core import security
from app.core.config import settings
from app.core.security import (
    generate_password_reset_token,
    get_password_hash,
    verify_password,
    verify_password_reset_token,
)
from app.dto.request.user import NewPassword
from app.dto.response.common import Message, Token
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.user_repository import UserRepository, user_repository
from app.services.email_service import generate_reset_password_email, send_email

DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


class AuthService:
    """Service handling authentication, password recovery, and token management."""

    def __init__(self, repository: UserRepository = user_repository) -> None:
        self.repository = repository

    def authenticate_user(self, session: Session, email: str, password: str) -> User:
        """Authenticate user with email and password, throwing AppException if invalid."""
        user = self.repository.get_by_email(session, email)
        if not user:
            verify_password(password, DUMMY_HASH)
            raise AppException(ErrorCode.INVALID_CREDENTIALS)

        verified, updated_hash = verify_password(password, user.hashed_password)
        if not verified:
            raise AppException(ErrorCode.INVALID_CREDENTIALS)

        if updated_hash:
            user.hashed_password = updated_hash
            self.repository.save(session, user)

        if not user.is_active:
            raise AppException(ErrorCode.INACTIVE_USER)

        return user

    def login(self, session: Session, username: str, password: str) -> Token:
        """Authenticate user and generate access token."""
        user = self.authenticate_user(session, username, password)
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        token = security.create_access_token(
            user.id, expires_delta=access_token_expires
        )
        return Token(access_token=token)

    def recover_password(self, session: Session, email: str) -> Message:
        """Send a password recovery email if the user exists."""
        user = self.repository.get_by_email(session, email)
        if user:
            password_reset_token = generate_password_reset_token(email=email)
            email_data = generate_reset_password_email(
                email_to=user.email, email=email, token=password_reset_token
            )
            send_email(
                email_to=user.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
        return Message(
            message="If that email is registered, we sent a password recovery link"
        )

    def reset_password(self, session: Session, body: NewPassword) -> Message:
        """Reset user password using token."""
        email = verify_password_reset_token(token=body.token)
        if not email:
            raise AppException(ErrorCode.INVALID_TOKEN)

        user = self.repository.get_by_email(session, email)
        if not user:
            raise AppException(ErrorCode.INVALID_TOKEN)
        if not user.is_active:
            raise AppException(ErrorCode.INACTIVE_USER)

        user.hashed_password = get_password_hash(body.new_password)
        self.repository.save(session, user)
        return Message(message="Password updated successfully")

    def recover_password_html_content(self, session: Session, email: str) -> HTMLResponse:
        """Generate HTML preview for password recovery email (superuser only)."""
        user = self.repository.get_by_email(session, email)
        if not user:
            raise AppException(
                ErrorCode.USER_NOT_FOUND,
                detail="The user with this username does not exist in the system.",
            )

        password_reset_token = generate_password_reset_token(email=email)
        email_data = generate_reset_password_email(
            email_to=user.email, email=email, token=password_reset_token
        )
        return HTMLResponse(
            content=email_data.html_content, headers={"subject:": email_data.subject}
        )


auth_service = AuthService()
