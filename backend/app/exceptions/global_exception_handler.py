"""Global FastAPI exception handlers."""

import logging
from typing import Any

from fastapi import Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.dto.response.error import ErrorResponse
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode

logger = logging.getLogger(__name__)


def _error_body(code: ErrorCode, detail: Any | None = None) -> dict[str, Any]:
    return ErrorResponse(
        code=code.code,
        message=code.message,
        detail=code.message if detail is None else detail,
    ).model_dump()


async def app_exception_handler(_request: Request, exc: AppException) -> JSONResponse:
    code = exc.error_code
    return JSONResponse(
        status_code=code.http_status,
        content=jsonable_encoder(_error_body(code, exc.detail)),
    )


async def http_exception_handler(
    _request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    code = ErrorCode.for_http_status(exc.status_code)
    return JSONResponse(
        status_code=exc.status_code,
        content=jsonable_encoder(_error_body(code, exc.detail)),
        headers=exc.headers,
    )


async def validation_exception_handler(
    _request: Request, exc: RequestValidationError
) -> JSONResponse:
    code = ErrorCode.UNPROCESSABLE_ENTITY
    return JSONResponse(
        status_code=code.http_status,
        content=jsonable_encoder(_error_body(code, exc.errors())),
    )


async def unhandled_exception_handler(
    _request: Request, exc: Exception
) -> JSONResponse:
    logger.error(
        "Unhandled application exception",
        exc_info=(type(exc), exc, exc.__traceback__),
    )
    code = ErrorCode.INTERNAL_SERVER_ERROR
    return JSONResponse(
        status_code=code.http_status,
        content=jsonable_encoder(_error_body(code)),
    )
