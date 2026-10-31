"""Analysis history entity to response DTO mappings."""

from app.dto.response.analysis_history import AnalysisHistoriesPublic, AnalysisHistoryPublic
from app.entities.analysis_history import AnalysisHistory


def to_analysis_history_response(entity: AnalysisHistory) -> AnalysisHistoryPublic:
    return AnalysisHistoryPublic.model_validate(entity)


def to_analysis_histories_response(
    entities: list[AnalysisHistory], count: int | None = None,
) -> AnalysisHistoriesPublic:
    return AnalysisHistoriesPublic(
        data=[to_analysis_history_response(entity) for entity in entities],
        count=len(entities) if count is None else count,
    )
