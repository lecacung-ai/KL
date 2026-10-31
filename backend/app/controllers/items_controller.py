"""HTTP endpoints for item CRUD."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.dto.request.item import ItemCreate, ItemUpdate
from app.dto.response.common import Message
from app.dto.response.item import ItemPublic, ItemsPublic
from app.mappers.item_mapper import to_item_response, to_items_response
from app.services.item_service import item_service

router = APIRouter(prefix="/items", tags=["items"])


@router.get("/", response_model=ItemsPublic)
def read_items(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 100) -> Any:
    items, count = item_service.list(session, current_user, skip=skip, limit=limit)
    return to_items_response(items, count)


@router.get("/{id}", response_model=ItemPublic)
def read_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    return to_item_response(item_service.get(session, id, current_user))


@router.post("/", response_model=ItemPublic)
def create_item(*, session: SessionDep, current_user: CurrentUser, item_in: ItemCreate) -> Any:
    return to_item_response(item_service.create(session, current_user, item_in))


@router.put("/{id}", response_model=ItemPublic)
def update_item(*, session: SessionDep, current_user: CurrentUser, id: uuid.UUID, item_in: ItemUpdate) -> Any:
    return to_item_response(item_service.update(session, id, current_user, item_in))


@router.delete("/{id}")
def delete_item(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Message:
    item_service.delete(session, id, current_user)
    return Message(message="Item deleted successfully")
