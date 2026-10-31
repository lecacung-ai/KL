"""Persistence and query operations for analysis history."""

import uuid

from sqlmodel import Session, func, select

from app.entities.analysis_history import AnalysisHistory


class AnalysisHistoryRepository:
    def add(self, session: Session, history: AnalysisHistory) -> AnalysisHistory:
        session.add(history)
        session.commit()
        session.refresh(history)
        return history

    def list_for_user(
        self, session: Session, *, user_id: uuid.UUID, is_admin: bool,
        skip: int, limit: int, search: str | None, status_filter: str | None,
    ) -> tuple[list[AnalysisHistory], int]:
        statement = select(AnalysisHistory)
        count_statement = select(func.count()).select_from(AnalysisHistory)
        if not is_admin:
            statement = statement.where(AnalysisHistory.user_id == user_id)
            count_statement = count_statement.where(AnalysisHistory.user_id == user_id)
        if search:
            pattern = f"%{search}%"
            condition = (AnalysisHistory.query.ilike(pattern) |
                         AnalysisHistory.dataset_name.ilike(pattern) |
                         AnalysisHistory.stdout.ilike(pattern))
            statement = statement.where(condition)
            count_statement = count_statement.where(condition)
        if status_filter in ("success", "error"):
            statement = statement.where(AnalysisHistory.status == status_filter)
            count_statement = count_statement.where(AnalysisHistory.status == status_filter)
        total = session.exec(count_statement).one()
        records = session.exec(statement.order_by(AnalysisHistory.created_at.desc()).offset(skip).limit(limit)).all()
        return records, total

    def list_for_user_all(self, session: Session, *, user_id: uuid.UUID, is_admin: bool) -> list[AnalysisHistory]:
        statement = select(AnalysisHistory)
        if not is_admin:
            statement = statement.where(AnalysisHistory.user_id == user_id)
        return session.exec(statement).all()

    def get_by_id(self, session: Session, history_id: uuid.UUID) -> AnalysisHistory | None:
        return session.get(AnalysisHistory, history_id)

    def delete(self, session: Session, history: AnalysisHistory) -> None:
        session.delete(history)
        session.commit()

    def delete_all_for_user(self, session: Session, *, user_id: uuid.UUID, is_admin: bool) -> None:
        for record in self.list_for_user_all(session, user_id=user_id, is_admin=is_admin):
            session.delete(record)
        session.commit()


analysis_history_repository = AnalysisHistoryRepository()
