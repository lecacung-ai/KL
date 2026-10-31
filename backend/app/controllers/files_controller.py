"""HTTP controller for file inspection and AI analysis uploads."""

from fastapi import APIRouter, File, Form, UploadFile

from app.api.deps import CurrentUser, SessionDep
from app.services.ai_analysis_service import ai_analysis_service

router = APIRouter()


@router.post("/inspect-columns")
async def inspect_file_columns(current_user: CurrentUser, file: UploadFile = File(...)):
    return await ai_analysis_service.inspect_columns(file)


@router.post("/upload")
async def upload_data_file(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    query: str = Form(default=""),
    scope_columns: str = Form(default=""),
):
    return await ai_analysis_service.analyze_upload(
        session, current_user, file=file, query=query, scope_columns=scope_columns
    )
