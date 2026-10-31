"""HTTP endpoints for forecasting use cases."""

from typing import Any

from fastapi import APIRouter

from app.api.deps import CurrentUser, SessionDep
from app.dto.request.forecast import ForecastRequest
from app.services.forecast_service import forecast_service

router = APIRouter()


@router.post("/predict")
def predict_financial_trend(request: ForecastRequest, session: SessionDep, current_user: CurrentUser) -> Any:
    return forecast_service.predict(session, current_user, request)
