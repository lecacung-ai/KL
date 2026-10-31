"""Application service for item CRUD and ownership rules."""

import uuid

from sqlmodel import Session

from app.dto.request.item import ItemCreate, ItemUpdate
from app.entities.item import Item
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.item_repository import ItemRepository, item_repository


class ItemService:
    def __init__(self, repository: ItemRepository = item_repository) -> None:
        self.repository = repository

    def list(self, session: Session, user: User, *, skip: int, limit: int):
        return self.repository.list_for_owner(session, owner_id=user.id, is_admin=user.is_superuser, skip=skip, limit=limit)

    def get(self, session: Session, item_id: uuid.UUID, user: User) -> Item:
        item = self.repository.get_by_id(session, item_id)
        if not item:
            raise AppException(ErrorCode.RESOURCE_NOT_FOUND, detail="Item not found")
        self._ensure_access(item, user)
        return item

    def create(self, session: Session, user: User, request: ItemCreate) -> Item:
        return self.repository.create(session, request, user.id)

    def update(self, session: Session, item_id: uuid.UUID, user: User, request: ItemUpdate) -> Item:
        item = self.get(session, item_id, user)
        item.sqlmodel_update(request.model_dump(exclude_unset=True))
        return self.repository.save(session, item)

    def delete(self, session: Session, item_id: uuid.UUID, user: User) -> None:
        self.repository.delete(session, self.get(session, item_id, user))

    @staticmethod
    def _ensure_access(item: Item, user: User) -> None:
        if not user.is_superuser and item.owner_id != user.id:
            raise AppException(ErrorCode.FORBIDDEN, detail="Not enough permissions")


item_service = ItemService()
