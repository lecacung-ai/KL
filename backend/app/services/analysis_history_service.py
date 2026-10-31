"""Use cases for listing, summarizing, and managing analysis history."""

import uuid

from sqlmodel import Session

from app.entities.analysis_history import AnalysisHistory
from app.entities.user import User
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.repositories.analysis_history_repository import AnalysisHistoryRepository, analysis_history_repository


class AnalysisHistoryService:
    def __init__(self, repository: AnalysisHistoryRepository = analysis_history_repository) -> None:
        self.repository = repository

    def list(self, session: Session, user: User, *, skip: int, limit: int, search: str | None, status_filter: str | None):
        records, count = self.repository.list_for_user(
            session, user_id=user.id, is_admin=user.is_superuser, skip=skip,
            limit=limit, search=search, status_filter=status_filter,
        )
        return records, count

    def stats(self, session: Session, user: User) -> dict:
        records = self.repository.list_for_user_all(session, user_id=user.id, is_admin=user.is_superuser)
        total = len(records)
        if not total:
            return {"total_queries": 0, "success_rate_pct": 100.0, "avg_time_ms": 0.0, "avg_memory_mb": 0.0}
        successes = sum(record.status == "success" for record in records)
        return {
            "total_queries": total,
            "success_rate_pct": round(successes / total * 100, 1),
            "avg_time_ms": round(sum(record.execution_time_ms for record in records) / total, 1),
            "avg_memory_mb": round(sum(record.memory_mb for record in records) / total, 1),
        }

    def get(self, session: Session, history_id: uuid.UUID, user: User) -> AnalysisHistory:
        record = self.repository.get_by_id(session, history_id)
        if not record:
            raise AppException(ErrorCode.HISTORY_NOT_FOUND)
        if not user.is_superuser and record.user_id != user.id:
            raise AppException(ErrorCode.HISTORY_ACCESS_DENIED)
        return record

    def delete(self, session: Session, history_id: uuid.UUID, user: User) -> None:
        record = self.repository.get_by_id(session, history_id)
        if not record:
            raise AppException(ErrorCode.HISTORY_NOT_FOUND)
        if not user.is_superuser and record.user_id != user.id:
            raise AppException(ErrorCode.HISTORY_DELETE_DENIED)
        self.repository.delete(session, record)

    def clear(self, session: Session, user: User) -> None:
        self.repository.delete_all_for_user(session, user_id=user.id, is_admin=user.is_superuser)


analysis_history_service = AnalysisHistoryService()
