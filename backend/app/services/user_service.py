"""User application service."""

from sqlmodel import Session

from app.dto.request.user import UserCreate, UserUpdate
from app.entities.user import User
from app.repositories.user_repository import UserRepository, user_repository


class UserService:
    def __init__(self, repository: UserRepository = user_repository) -> None:
        self.repository = repository

    def get_by_email(self, session: Session, email: str) -> User | None:
        return self.repository.get_by_email(session, email)

    def create(self, session: Session, request: UserCreate) -> User:
        return self.repository.create(session, request)

    def update(self, session: Session, entity: User, request: UserUpdate) -> User:
        return self.repository.update(session, entity, request)

    def authenticate(self, session: Session, email: str, password: str) -> User | None:
        return self.repository.authenticate(session, email, password)

    def list(self, session: Session, *, skip: int, limit: int) -> tuple[list[User], int]:
        return self.repository.list(session, skip=skip, limit=limit)

    def get_by_id(self, session: Session, user_id) -> User | None:
        return self.repository.get_by_id(session, user_id)

    def save(self, session: Session, user: User) -> User:
        return self.repository.save(session, user)

    def delete(self, session: Session, user: User, *, include_owned_items: bool = False) -> None:
        self.repository.delete(session, user, include_owned_items=include_owned_items)


user_service = UserService()

