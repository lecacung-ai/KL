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


user_service = UserService()

