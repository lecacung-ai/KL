"""Dataset entity to response DTO mappings."""

from app.dto.response.dataset import DatasetPublic, DatasetsPublic
from app.entities.dataset import Dataset


def to_dataset_response(entity: Dataset) -> DatasetPublic:
    return DatasetPublic.model_validate(entity)


def to_datasets_response(entities: list[Dataset], count: int | None = None) -> DatasetsPublic:
    return DatasetsPublic(
        data=[to_dataset_response(entity) for entity in entities],
        count=len(entities) if count is None else count,
    )
