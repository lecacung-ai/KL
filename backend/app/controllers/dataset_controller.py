import uuid
from typing import Any

from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser, SessionDep
from app.dto.response.common import Message
from app.dto.response.dataset import DatasetPublic, DatasetsPublic
from app.mappers.dataset_mapper import to_dataset_response, to_datasets_response
import json
import shutil
import tempfile
from pathlib import Path
from app.services.dataset_service import dataset_service
from app.services.interactive_data_service import interactive_data_service

router = APIRouter()


@router.get("/", response_model=DatasetsPublic)
def read_datasets(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> DatasetsPublic:
    datasets, count = dataset_service.list_datasets(
        session, current_user, skip=skip, limit=limit
    )
    return to_datasets_response(datasets, count)


@router.post("/upload", response_model=DatasetPublic)
async def upload_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    description: str | None = Form(default=None),
) -> DatasetPublic:
    filename = file.filename or "data.csv"
    dataset = dataset_service.upload_dataset(
        session,
        current_user,
        file_stream=file.file,
        filename=filename,
        description=description,
    )
    return to_dataset_response(dataset)


@router.post("/inspect-workbook")
async def inspect_workbook(
    file: UploadFile = File(...),
) -> dict[str, Any]:
    filename = file.filename or "data.xlsx"
    ext = Path(filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        return interactive_data_service.inspect_file_for_interaction(tmp_path, filename)
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


@router.post("/upload-interactive", response_model=DatasetPublic)
async def upload_dataset_interactive(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile = File(...),
    config: str = Form(...),
    description: str | None = Form(default=None),
) -> DatasetPublic:
    filename = file.filename or "data.xlsx"
    config_dict = json.loads(config)
    ext = Path(filename).suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        shutil.copyfileobj(file.file, tmp)
        tmp_path = tmp.name
    try:
        dataset = interactive_data_service.apply_interactive_transformations_and_save(
            session,
            user=current_user,
            file_path=tmp_path,
            filename=filename,
            config=config_dict,
            description=description,
        )
        return to_dataset_response(dataset)
    finally:
        try:
            Path(tmp_path).unlink(missing_ok=True)
        except Exception:
            pass


@router.get("/{id}", response_model=DatasetPublic)
def read_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> DatasetPublic:
    return to_dataset_response(dataset_service.get_dataset(session, id, current_user))


@router.get("/{id}/quality-report")
def get_dataset_quality_report(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    return dataset_service.get_quality_report(session, id, current_user)


@router.get("/{id}/schema-analysis")
def get_dataset_schema_analysis(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> dict[str, Any]:
    return dataset_service.get_schema_analysis(session, id, current_user)


@router.post("/{id}/clean", response_model=DatasetPublic)
def clean_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> DatasetPublic:
    return to_dataset_response(dataset_service.clean_dataset(session, id, current_user))


@router.get("/{id}/download")
def download_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> FileResponse:
    dataset = dataset_service.get_downloadable_dataset(session, id, current_user)
    return FileResponse(
        path=dataset.file_path,
        filename=dataset.filename,
    )


@router.delete("/{id}", response_model=Message)
def delete_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Message:
    dataset_service.delete_dataset(session, id, current_user)
    return Message(message="Xóa tệp dữ liệu thành công")
