"""HTTP controller for file inspection and AI analysis uploads."""

import os
import uuid
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, SessionDep
from app.exceptions.app_exception import AppException
from app.exceptions.error_code import ErrorCode
from app.services.ai_analysis_service import ai_analysis_service

router = APIRouter()
EXPORT_DIR = "/tmp/exports"


@router.post("/inspect-columns")
async def inspect_file_columns(
    current_user: CurrentUser, file: UploadFile = File(...)
) -> dict[str, Any]:
    return await ai_analysis_service.inspect_columns(file)


@router.post("/upload")
@router.post("/analyze-dataset-conversational")
async def upload_data_file(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile | None = File(default=None),
    dataset_id: uuid.UUID | None = Form(default=None),
    query: str = Form(default=""),
    scope_columns: str = Form(default=""),
) -> dict[str, Any]:
    return await ai_analysis_service.analyze_upload(
        session,
        current_user,
        file=file,
        dataset_id=dataset_id,
        query=query,
        scope_columns=scope_columns,
    )


@router.get("/download-export/{filename}")
async def download_exported_file(
    filename: str, current_user: CurrentUser
) -> FileResponse:
    safe_name = os.path.basename(filename)
    path = os.path.join(EXPORT_DIR, safe_name)
    if not os.path.exists(path):
        raise AppException(
            ErrorCode.RESOURCE_NOT_FOUND,
            detail=f"Tệp xuất '{safe_name}' không tồn tại hoặc đã bị xóa.",
        )
    return FileResponse(
        path=path,
        filename=safe_name,
        media_type="application/octet-stream",
    )
