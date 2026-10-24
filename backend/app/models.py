import uuid
from datetime import UTC, datetime

from pydantic import EmailStr
from sqlalchemy import DateTime
from sqlmodel import Field, Relationship, SQLModel


def get_datetime_utc() -> datetime:
    return datetime.now(UTC)


# Shared properties
class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=255)
    is_active: bool = True
    is_superuser: bool = False
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on creation
class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserRegister(SQLModel):
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(default=None, max_length=255)


# Properties to receive via API on update, all are optional
class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=255)
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = Field(default=None, max_length=255)
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=255)
    email: EmailStr | None = Field(default=None, max_length=255)


class UpdatePassword(SQLModel):
    current_password: str = Field(min_length=8, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


# Database model, database table inferred from class name
class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    hashed_password: str
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    items: list[Item] = Relationship(back_populates="owner", cascade_delete=True)


# Properties to return via API, id is always required
class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime | None = None


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


# Shared properties
class ItemBase(SQLModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Properties to receive on item creation
class ItemCreate(ItemBase):
    pass


# Properties to receive on item update
class ItemUpdate(SQLModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=255)


# Database model, database table inferred from class name
class Item(ItemBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship(back_populates="items")


# Properties to return via API, id is always required
class ItemPublic(ItemBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class ItemsPublic(SQLModel):
    data: list[ItemPublic]
    count: int


# Generic message
class Message(SQLModel):
    message: str


# JSON payload containing access token
class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


# Contents of JWT token
class TokenPayload(SQLModel):
    sub: str | None = None


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


# Dataset Models for Module 2: Quản lý kho dữ liệu kinh doanh
class DatasetBase(SQLModel):
    filename: str = Field(min_length=1, max_length=255)
    file_type: str = Field(default="csv", max_length=50)
    size_bytes: int = Field(default=0)
    row_count: int = Field(default=0)
    column_count: int = Field(default=0)
    version: int = Field(default=1)
    status: str = Field(default="ready", max_length=50)
    description: str | None = Field(default=None, max_length=500)
    schema_info: str | None = Field(default=None)
    sample_data: str | None = Field(default=None)


class Dataset(DatasetBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    owner_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    owner: User | None = Relationship()
    file_path: str = Field(max_length=500)


class DatasetPublic(DatasetBase):
    id: uuid.UUID
    owner_id: uuid.UUID
    created_at: datetime | None = None


class DatasetsPublic(SQLModel):
    data: list[DatasetPublic]
    count: int


# Analysis History Models for Module 9: Giám sát truy vấn & tài nguyên
class AnalysisHistoryBase(SQLModel):
    dataset_name: str = Field(max_length=255)
    query: str = Field(max_length=1000)
    ai_code: str | None = Field(default=None)
    stdout: str | None = Field(default=None)
    status: str = Field(default="success", max_length=50)  # "success", "error"
    error_message: str | None = Field(default=None)
    execution_time_ms: float = Field(default=0.0)
    memory_mb: float = Field(default=0.0)
    chart_image: str | None = Field(default=None)
    scope_columns: str | None = Field(default=None, max_length=500)


class AnalysisHistory(AnalysisHistoryBase, table=True):
    __tablename__ = "analysis_history"
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    created_at: datetime | None = Field(
        default_factory=get_datetime_utc,
        sa_type=DateTime(timezone=True),  # type: ignore
    )
    user_id: uuid.UUID = Field(
        foreign_key="user.id", nullable=False, ondelete="CASCADE"
    )
    dataset_id: uuid.UUID | None = Field(
        default=None, foreign_key="dataset.id", ondelete="SET NULL"
    )
    user: User | None = Relationship()


class AnalysisHistoryPublic(AnalysisHistoryBase):
    id: uuid.UUID
    user_id: uuid.UUID
    dataset_id: uuid.UUID | None = None
    created_at: datetime | None = None


class AnalysisHistoriesPublic(SQLModel):
    data: list[AnalysisHistoryPublic]
    count: int

