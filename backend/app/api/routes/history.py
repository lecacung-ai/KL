import uuid
from typing import Any
from fastapi import APIRouter, HTTPException, Query
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    AnalysisHistoriesPublic,
    AnalysisHistory,
    AnalysisHistoryPublic,
    Message,
)

router = APIRouter()


@router.get("/", response_model=AnalysisHistoriesPublic)
def get_analysis_history(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 50,
    search: str | None = Query(default=None),
    status_filter: str | None = Query(default=None),
) -> Any:
    """
    Module 9: Lấy danh sách lịch sử truy vấn & giám sát tài nguyên
    """
    base_statement = select(AnalysisHistory)
    count_statement = select(func.count()).select_from(AnalysisHistory)

    if not current_user.is_superuser:
        base_statement = base_statement.where(AnalysisHistory.user_id == current_user.id)
        count_statement = count_statement.where(AnalysisHistory.user_id == current_user.id)

    if search:
        search_pattern = f"%{search}%"
        condition = (
            AnalysisHistory.query.ilike(search_pattern)
            | AnalysisHistory.dataset_name.ilike(search_pattern)
            | AnalysisHistory.stdout.ilike(search_pattern)
        )
        base_statement = base_statement.where(condition)
        count_statement = count_statement.where(condition)

    if status_filter and status_filter in ["success", "error"]:
        base_statement = base_statement.where(AnalysisHistory.status == status_filter)
        count_statement = count_statement.where(AnalysisHistory.status == status_filter)

    total_count = session.exec(count_statement).one()
    statement = (
        base_statement.order_by(AnalysisHistory.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    records = session.exec(statement).all()

    return AnalysisHistoriesPublic(data=records, count=total_count)


@router.get("/stats")
def get_history_stats(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Module 9: Đo lường tổng hợp tài nguyên Sandbox và tỷ lệ phân tích thành công
    """
    statement = select(AnalysisHistory)
    if not current_user.is_superuser:
        statement = statement.where(AnalysisHistory.user_id == current_user.id)

    records = session.exec(statement).all()
    total = len(records)
    if total == 0:
        return {
            "total_queries": 0,
            "success_rate_pct": 100.0,
            "avg_time_ms": 0.0,
            "avg_memory_mb": 0.0,
        }

    success_count = sum(1 for r in records if r.status == "success")
    total_time = sum(r.execution_time_ms for r in records)
    total_memory = sum(r.memory_mb for r in records)

    return {
        "total_queries": total,
        "success_rate_pct": round((success_count / total * 100), 1),
        "avg_time_ms": round(total_time / total, 1),
        "avg_memory_mb": round(total_memory / total, 1),
    }


@router.get("/{id}", response_model=AnalysisHistoryPublic)
def get_history_detail(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Xem chi tiết một bản ghi lịch sử phân tích
    """
    item = session.get(AnalysisHistory, id)
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi lịch sử")
    if not current_user.is_superuser and (item.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không có quyền truy cập bản ghi này")
    return item


@router.delete("/{id}", response_model=Message)
def delete_history_item(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Xóa một bản ghi lịch sử
    """
    item = session.get(AnalysisHistory, id)
    if not item:
        raise HTTPException(status_code=404, detail="Không tìm thấy bản ghi lịch sử")
    if not current_user.is_superuser and (item.user_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không có quyền xóa bản ghi này")

    session.delete(item)
    session.commit()
    return Message(message="Đã xóa bản ghi lịch sử thành công")


@router.delete("/actions/clear-all", response_model=Message)
def clear_all_history(
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Dọn dẹp toàn bộ lịch sử phân tích của người dùng hiện tại
    """
    statement = select(AnalysisHistory)
    if not current_user.is_superuser:
        statement = statement.where(AnalysisHistory.user_id == current_user.id)

    records = session.exec(statement).all()
    for rec in records:
        session.delete(rec)
    session.commit()
    return Message(message="Đã dọn dẹp sạch toàn bộ lịch sử phân tích")
