"""Item entity and DTO mappings."""

import uuid

from app.dto.request.item import ItemCreate
from app.dto.response.item import ItemPublic, ItemsPublic
from app.entities.item import Item


def to_item_response(entity: Item) -> ItemPublic:
    return ItemPublic.model_validate(entity)


def to_item_entity(request: ItemCreate, owner_id: uuid.UUID) -> Item:
    return Item.model_validate(request, update={"owner_id": owner_id})


def to_items_response(entities: list[Item], count: int | None = None) -> ItemsPublic:
    return ItemsPublic(
        data=[to_item_response(entity) for entity in entities],
        count=len(entities) if count is None else count,
    )
