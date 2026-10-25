from pathlib import Path

import sentry_sdk
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.cors import CORSMiddleware

from app.api.main import api_router
from app.core.config import settings
from app.exceptions.app_exception import AppException
from app.exceptions.global_exception_handler import (
    app_exception_handler,
    http_exception_handler,
    unhandled_exception_handler,
    validation_exception_handler,
)
FRONTEND_DIR = Path(__file__).parent / "frontend"


def custom_generate_unique_id(route: APIRoute) -> str:
    return f"{route.tags[0]}-{route.name}"


if settings.SENTRY_DSN and settings.FASTAPI_ENV != "development":
    sentry_sdk.init(dsn=str(settings.SENTRY_DSN), enable_tracing=True)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
)

app.add_exception_handler(AppException, app_exception_handler)
app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_HOST],
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1)(:\d+)?"
        if settings.FASTAPI_ENV == "development"
        else None
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)
app.frontend("/", directory=FRONTEND_DIR)
