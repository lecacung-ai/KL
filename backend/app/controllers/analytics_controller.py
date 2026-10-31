"""HTTP endpoints for analytics use cases."""

from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.dto.request.clustering import ClusteringRequest
from app.services.clustering_service import clustering_service

router = APIRouter()


@router.post("/clustering")
def cluster_dataset(request: ClusteringRequest, session: SessionDep, current_user: CurrentUser) -> Any:
    return clustering_service.analyze(session, current_user, request)
