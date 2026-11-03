"""Development-only helper endpoints."""

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.deps import SessionDep
from app.dto.request.user import UserCreate
from app.dto.response.user import UserPublic
from app.mappers.user_mapper import to_user_response
from app.services.user_service import user_service

router = APIRouter(tags=["private"], prefix="/private")


class PrivateUserCreate(BaseModel):
    email: str
    password: str
    full_name: str
    is_verified: bool = False


@router.post("/users/", response_model=UserPublic)
def create_user(user_in: PrivateUserCreate, session: SessionDep) -> UserPublic:
    request = UserCreate(email=user_in.email, password=user_in.password, full_name=user_in.full_name)
    user = user_service.create(session, request)
    return to_user_response(user)
