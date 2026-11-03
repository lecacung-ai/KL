"""HTTP controller for authentication and password lifecycle endpoints."""

from typing import Annotated, Any

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import CurrentUser, SessionDep, get_current_active_superuser
from app.dto.request.user import NewPassword
from app.dto.response.common import Message, Token
from app.dto.response.user import UserPublic
from app.mappers.user_mapper import to_user_response
from app.services.auth_service import auth_service

router = APIRouter(tags=["login"])


@router.post("/login/access-token")
def login_access_token(
    session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]
) -> Token:
    """OAuth2 compatible token login, returns access token for future requests."""
    return auth_service.login(session, form_data.username, form_data.password)


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> UserPublic:
    """Test validity of current access token and return authenticated user."""
    return to_user_response(current_user)


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> Message:
    """Trigger password recovery workflow for the given email address."""
    return auth_service.recover_password(session, email)


@router.post("/reset-password/")
def reset_password(session: SessionDep, body: NewPassword) -> Message:
    """Reset user password using token."""
    return auth_service.reset_password(session, body)


@router.post(
    "/password-recovery-html-content/{email}",
    dependencies=[Depends(get_current_active_superuser)],
    response_class=HTMLResponse,
)
def recover_password_html_content(email: str, session: SessionDep) -> Any:
    """HTML Content for Password Recovery email preview (superuser only)."""
    return auth_service.recover_password_html_content(session, email)
