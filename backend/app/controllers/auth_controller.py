from datetime import timedelta
from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.core import security
from app.core.config import settings
from app.core.security import (
    generate_password_reset_token,
    verify_password_reset_token,
)
from app.dto.request.user import NewPassword, UserUpdate
from app.dto.response.common import Message, Token
from app.dto.response.user import UserPublic
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.services.email_service import generate_reset_password_email, send_email
from app.services.user_service import user_service

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = user_service.authenticate(session, form_data.username, form_data.password)
    if not user:
        raise AppException(ErrorCode.INVALID_CREDENTIALS)
    elif not user.is_active:
        raise AppException(ErrorCode.INACTIVE_USER)
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return Token(
        access_token=security.create_access_token(
            user.id, expires_delta=access_token_expires
        )
    )


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> Any:
    """
    Test access token
    """
    return current_user


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    """
    Password Recovery
    """
    user = user_service.get_by_email(session, email)

    # Always return the same response to prevent email enumeration attacks
    # Only send email if user actually exists
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


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """
    Reset password
    """
    email = verify_password_reset_token(token=body.token)
    if not email:
        raise AppException(ErrorCode.INVALID_TOKEN)
    user = user_service.get_by_email(session, email)
    if not user:
        # Don't reveal that the user doesn't exist - use same error as invalid token
        raise AppException(ErrorCode.INVALID_TOKEN)
    elif not user.is_active:
        raise AppException(ErrorCode.INACTIVE_USER)
    user_in_update = UserUpdate(password=body.new_password)
    user_service.update(session, user, user_in_update)
    return Message(message="Password updated successfully")


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """
    HTML Content for Password Recovery
    """
    user = user_service.get_by_email(session, email)

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
