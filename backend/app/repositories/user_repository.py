"""User persistence operations.

The repository delegates to the existing CRUD implementation so current
callers keep exactly the same database behavior while adopting the new layer.
"""

from sqlmodel import Session

from app.core.security import get_password_hash, verify_password
from app.dto.request.user import UserCreate, UserUpdate
from app.entities.user import User


DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"


def get_user_by_email(*, session: Session, email: str) -> User | None:
    from sqlmodel import select

    return session.exec(select(User).where(User.email == email)).first()


def create_user(*, session: Session, user_create: UserCreate) -> User:
    db_obj = User.model_validate(
        user_create, update={"hashed_password": get_password_hash(user_create.password)}
    )
    session.add(db_obj)
    session.commit()
    session.refresh(db_obj)
    return db_obj


def update_user(*, session: Session, db_user: User, user_in: UserUpdate) -> User:
    user_data = user_in.model_dump(exclude_unset=True)
    extra_data = {}
    if "password" in user_data:
        password = user_data["password"]
        extra_data["hashed_password"] = get_password_hash(password)
    db_user.sqlmodel_update(user_data, update=extra_data)
    session.add(db_user)
    session.commit()
    session.refresh(db_user)
    return db_user


def authenticate(*, session: Session, email: str, password: str) -> User | None:
    user = get_user_by_email(session=session, email=email)
    if not user:
        verify_password(password, DUMMY_HASH)
        return None
    verified, updated_hash = verify_password(password, user.hashed_password)
    if not verified:
        return None
    if updated_hash:
        user.hashed_password = updated_hash
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


class UserRepository:
    def get_by_email(self, session: Session, email: str) -> User | None:
        return get_user_by_email(session=session, email=email)

    def create(self, session: Session, user: UserCreate) -> User:
        return create_user(session=session, user_create=user)

    def update(self, session: Session, entity: User, values: UserUpdate) -> User:
        return update_user(session=session, db_user=entity, user_in=values)

    def authenticate(self, session: Session, email: str, password: str) -> User | None:
        return authenticate(session=session, email=email, password=password)


user_repository = UserRepository()

