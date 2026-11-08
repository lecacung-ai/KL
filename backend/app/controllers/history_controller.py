"""HTTP endpoints for analysis history."""

import uuid
from typing import Any
from pydantic import BaseModel

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, SessionDep
from app.dto.response.analysis_history import AnalysisHistoriesPublic, AnalysisHistoryPublic
from app.dto.response.common import Message
from app.mappers.analysis_history_mapper import to_analysis_histories_response, to_analysis_history_response
from app.services.analysis_history_service import analysis_history_service

router = APIRouter()


@router.get("/", response_model=AnalysisHistoriesPublic)
def get_analysis_history(session: SessionDep, current_user: CurrentUser, skip: int = 0, limit: int = 50,
                         search: str | None = Query(default=None), status_filter: str | None = Query(default=None)) -> Any:
    records, count = analysis_history_service.list(
        session, current_user, skip=skip, limit=limit, search=search, status_filter=status_filter
    )
    return to_analysis_histories_response(records, count)


@router.get("/stats")
def get_history_stats(session: SessionDep, current_user: CurrentUser) -> Any:
    return analysis_history_service.stats(session, current_user)


@router.get("/{id}", response_model=AnalysisHistoryPublic)
def get_history_detail(id: uuid.UUID, session: SessionDep, current_user: CurrentUser) -> Any:
    return to_analysis_history_response(analysis_history_service.get(session, id, current_user))


@router.delete("/{id}", response_model=Message)
def delete_history_item(id: uuid.UUID, session: SessionDep, current_user: CurrentUser) -> Any:
    analysis_history_service.delete(session, id, current_user)
    return Message(message="Đã xóa bản ghi lịch sử thành công")


@router.delete("/actions/clear-all", response_model=Message)
def clear_all_history(session: SessionDep, current_user: CurrentUser) -> Any:
    analysis_history_service.clear(session, current_user)
    return Message(message="Đã dọn dẹp sạch toàn bộ lịch sử phân tích")


class BulkDeleteHistoryRequest(BaseModel):
    ids: list[uuid.UUID]


@router.post("/bulk-delete", response_model=Message)
def bulk_delete_history(
    request: BulkDeleteHistoryRequest,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    count = 0
    for history_id in request.ids:
        try:
            analysis_history_service.delete(session, history_id, current_user)
            count += 1
        except Exception:
            pass
    return Message(message=f"Đã xóa thành công {count} bản ghi lịch sử")

