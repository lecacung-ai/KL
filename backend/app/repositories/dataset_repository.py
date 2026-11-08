"""Database access for Dataset entities."""

import uuid

from sqlmodel import Session, func, select

from app.entities.dataset import Dataset


class DatasetRepository:
    def list_for_owner(
        self,
        session: Session,
        *,
        owner_id: uuid.UUID,
        is_admin: bool,
        skip: int,
        limit: int,
    ) -> tuple[list[Dataset], int]:
        count_statement = select(func.count()).select_from(Dataset)
        statement = select(Dataset)

        if not is_admin:
            count_statement = count_statement.where(Dataset.owner_id == owner_id)
            statement = statement.where(Dataset.owner_id == owner_id)

        count = session.exec(count_statement).one()
        datasets = session.exec(
            statement.order_by(Dataset.created_at.desc()).offset(skip).limit(limit)
        ).all()
        return datasets, count

    def get_by_id(self, session: Session, dataset_id: uuid.UUID) -> Dataset | None:
        return session.get(Dataset, dataset_id)

    def get_latest_by_filename(
        self, session: Session, *, owner_id: uuid.UUID, filename: str
    ) -> Dataset | None:
        statement = (
            select(Dataset)
            .where(Dataset.owner_id == owner_id, Dataset.filename == filename)
            .order_by(Dataset.version.desc())
        )
        return session.exec(statement).first()

    def add(self, session: Session, dataset: Dataset) -> Dataset:
        session.add(dataset)
        session.commit()
        session.refresh(dataset)
        return dataset

    def save(self, session: Session, dataset: Dataset) -> Dataset:
        session.add(dataset)
        session.commit()
        session.refresh(dataset)
        return dataset

    def delete(self, session: Session, dataset: Dataset) -> None:
        session.delete(dataset)
        session.commit()


repository = DatasetRepository()
dataset_repository = repository
