"""User application service containing business logic and validation."""

import uuid
from sqlmodel import Session

from app.core.config import settings
from app.core.security import get_password_hash, verify_password
from app.dto.request.user import UpdatePassword, UserCreate, UserRegister, UserUpdate, UserUpdateMe
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.user_repository import UserRepository, user_repository
from app.services.email_service import generate_new_account_email, send_email


class UserService:
    """Service encapsulating user management business rules and orchestration."""

    def __init__(self, repository: UserRepository = user_repository) -> None:
        self.repository = repository

    def list(self, session: Session, *, skip: int = 0, limit: int = 100) -> tuple[list[User], int]:
        """List users with pagination."""
        return self.repository.list(session, skip=skip, limit=limit)

    def get_by_id(self, session: Session, user_id: uuid.UUID) -> User | None:
        return self.repository.get_by_id(session, user_id)

    def get_by_email(self, session: Session, email: str) -> User | None:
        return self.repository.get_by_email(session, email)

    def get_user_by_id(
        self, session: Session, user_id: uuid.UUID, current_user: User
    ) -> User:
        """Retrieve user with permission check."""
        user = self.repository.get_by_id(session, user_id)
        if user == current_user:
            return user
        if not current_user.is_superuser:
            raise AppException(
                ErrorCode.FORBIDDEN,
                detail="The user doesn't have enough privileges",
            )
        if user is None:
            raise AppException(ErrorCode.USER_NOT_FOUND)
        return user

    def create(self, session: Session, request: UserCreate) -> User:
        """Create new user, ensure email uniqueness, and optionally send welcome email."""
        if self.repository.get_by_email(session, request.email):
            raise AppException(ErrorCode.USER_ALREADY_EXISTS)

        user = self.repository.create(session, request)
        if settings.emails_enabled and request.email:
            email_data = generate_new_account_email(
                email_to=request.email, username=request.email, password=request.password
            )
            send_email(
                email_to=request.email,
                subject=email_data.subject,
                html_content=email_data.html_content,
            )
        return user

    def register(self, session: Session, request: UserRegister) -> User:
        """Self-registration for new users."""
        if self.repository.get_by_email(session, request.email):
            raise AppException(
                ErrorCode.USER_ALREADY_EXISTS,
                detail="The user with this email already exists in the system",
            )
        user_create = UserCreate.model_validate(request)
        return self.create(session, user_create)

    def update_user(
        self, session: Session, user_id: uuid.UUID, request: UserUpdate
    ) -> User:
        """Update any user by ID (superuser only)."""
        db_user = self.repository.get_by_id(session, user_id)
        if not db_user:
            raise AppException(
                ErrorCode.USER_NOT_FOUND,
                detail="The user with this id does not exist in the system",
            )
        if request.email:
            existing_user = self.repository.get_by_email(session, request.email)
            if existing_user and existing_user.id != user_id:
                raise AppException(ErrorCode.EMAIL_CONFLICT)

        return self.repository.update(session, db_user, request)

    def update_me(
        self, session: Session, current_user: User, request: UserUpdateMe
    ) -> User:
        """Update current authenticated user's profile."""
        if request.email:
            existing_user = self.repository.get_by_email(session, request.email)
            if existing_user and existing_user.id != current_user.id:
                raise AppException(ErrorCode.EMAIL_CONFLICT)

        user_data = request.model_dump(exclude_unset=True)
        current_user.sqlmodel_update(user_data)
        return self.repository.save(session, current_user)

    def change_password(
        self, session: Session, current_user: User, body: UpdatePassword
    ) -> None:
        """Update current user's password verifying old credentials."""
        verified, _ = verify_password(body.current_password, current_user.hashed_password)
        if not verified:
            raise AppException(ErrorCode.INCORRECT_PASSWORD)
        if body.current_password == body.new_password:
            raise AppException(ErrorCode.PASSWORD_UNCHANGED)

        current_user.hashed_password = get_password_hash(body.new_password)
        self.repository.save(session, current_user)

    def delete_me(self, session: Session, current_user: User) -> None:
        """Delete current user account."""
        if current_user.is_superuser:
            raise AppException(ErrorCode.SELF_DELETE_FORBIDDEN)
        self.repository.delete(session, current_user)

    def delete_user(
        self, session: Session, user_id: uuid.UUID, current_user: User
    ) -> None:
        """Delete a user account by ID (superuser only)."""
        user = self.repository.get_by_id(session, user_id)
        if not user:
            raise AppException(ErrorCode.USER_NOT_FOUND)
        if user == current_user:
            raise AppException(ErrorCode.SELF_DELETE_FORBIDDEN)
        self.repository.delete(session, user, include_owned_items=True)

    def save(self, session: Session, user: User) -> User:
        return self.repository.save(session, user)

    def delete(self, session: Session, user: User, *, include_owned_items: bool = False) -> None:
        self.repository.delete(session, user, include_owned_items=include_owned_items)

    def update(self, session: Session, entity: User, request: UserUpdate) -> User:
        return self.repository.update(session, entity, request)

    def authenticate(self, session: Session, email: str, password: str) -> User | None:
        return self.repository.authenticate(session, email, password)


user_service = UserService()
