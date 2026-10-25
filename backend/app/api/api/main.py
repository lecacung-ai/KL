from fastapi import APIRouter

from app.api.routes import items, login, private, users, utils
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
from app.api.routes import analytics, datasets, files, forecast, history
api_router.include_router(datasets.router, prefix="/datasets", tags=["datasets"])
api_router.include_router(files.router, prefix="/files", tags=["files"])
api_router.include_router(forecast.router, prefix="/forecast", tags=["forecast"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
api_router.include_router(utils.router)
api_router.include_router(items.router)


if settings.FASTAPI_ENV == "development":
    api_router.include_router(private.router)

