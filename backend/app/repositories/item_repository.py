"""Persistence operations for items."""

import uuid

from sqlmodel import Session, col, func, select

from app.dto.request.item import ItemCreate
from app.entities.item import Item
from app.mappers.item_mapper import to_item_entity


def create_item(*, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
    entity = to_item_entity(item_in, owner_id)
    session.add(entity)
    session.commit()
    session.refresh(entity)
    return entity


class ItemRepository:
    def list_for_owner(self, session: Session, *, owner_id: uuid.UUID, is_admin: bool, skip: int, limit: int):
        count_statement = select(func.count()).select_from(Item)
        statement = select(Item)
        if not is_admin:
            count_statement = count_statement.where(Item.owner_id == owner_id)
            statement = statement.where(Item.owner_id == owner_id)
        count = session.exec(count_statement).one()
        items = session.exec(statement.order_by(col(Item.created_at).desc()).offset(skip).limit(limit)).all()
        return items, count

    def get_by_id(self, session: Session, item_id: uuid.UUID) -> Item | None:
        return session.get(Item, item_id)

    def create(self, session: Session, item_in: ItemCreate, owner_id: uuid.UUID) -> Item:
        return create_item(session=session, item_in=item_in, owner_id=owner_id)

    def save(self, session: Session, item: Item) -> Item:
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    def delete(self, session: Session, item: Item) -> None:
        session.delete(item)
        session.commit()


item_repository = ItemRepository()

