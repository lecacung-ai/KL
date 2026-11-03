"""HTTP endpoints for forecasting, classification, and model recommendations."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.dto.request.forecast import ClassificationRequest, ForecastRequest
from app.services.forecast_service import forecast_service

router = APIRouter()


@router.get("/recommendations/{dataset_id}")
def get_dataset_recommendations(
    dataset_id: uuid.UUID, session: SessionDep, current_user: CurrentUser
) -> Any:
    return forecast_service.get_recommendations(session, current_user, dataset_id)


@router.post("/predict")
def predict_financial_trend(
    request: ForecastRequest, session: SessionDep, current_user: CurrentUser
) -> Any:
    return forecast_service.predict(session, current_user, request)


@router.post("/classification")
def classify_financial_risk(
    request: ClassificationRequest, session: SessionDep, current_user: CurrentUser
) -> Any:
    return forecast_service.classify(session, current_user, request)
