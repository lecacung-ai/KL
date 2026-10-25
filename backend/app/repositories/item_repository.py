"""Persistence operations for items."""

import uuid

from sqlmodel import Session

from app.dto.request.item import ItemCreate
from app.entities.item import Item


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    entity = Item.model_validate(item_in, update={"owner_id": owner_id})
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


class ItemRepository:
    def create(self, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
        return create_item(session=session, item_in=item_in, owner_id=owner_id)


item_repository = ItemRepository()

