from fastapi import APIRouter

from app.controllers import auth_controller as login
from app.controllers import dataset_controller
from app.controllers import files_controller
from app.controllers import analytics_controller, forecast_controller, history_controller, items_controller
from app.controllers import private_controller, utils_controller
from app.controllers import users_controller as users
from app.core.config import settings

api_router = APIRouter()
api_router.include_router(login.router)
api_router.include_router(users.router)
api_router.include_router(
    dataset_controller.router, prefix="/datasets", tags=["datasets"]
)
api_router.include_router(files_controller.router, prefix="/files", tags=["files"])
api_router.include_router(forecast_controller.router, prefix="/forecast", tags=["forecast"])
api_router.include_router(analytics_controller.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(history_controller.router, prefix="/history", tags=["history"])
api_router.include_router(utils_controller.router)
api_router.include_router(items_controller.router)


if settings.FASTAPI_ENV == "development":
    api_router.include_router(private_controller.router)

