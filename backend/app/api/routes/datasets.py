import json
import os
import shutil
import uuid
from typing import Any
import pandas as pd
from fastapi import APIRouter, HTTPException, UploadFile, Form
from fastapi.responses import FileResponse
from sqlmodel import func, select

from app.api.deps import CurrentUser, SessionDep
from app.core.data_loader import smart_load_dataframe
from app.models import Dataset, DatasetPublic, DatasetsPublic, Message

router = APIRouter()

UPLOAD_DIR = "/app/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def profile_dataset_schema(df: pd.DataFrame) -> dict:
    """
    Chức năng 3: Phân tích lược đồ dữ liệu chuyên sâu
    - Đọc tên cột, kiểu dữ liệu, các giá trị mẫu
    - Phát hiện cấu trúc không hợp lệ, dữ liệu thiếu (Null/NaN)
    - Phát hiện dòng trùng lặp, cột rỗng/hằng số
    - Chấm điểm chất lượng dữ liệu (Data Health Score)
    - Đưa ra khuyến nghị xử lý và chuẩn hóa dữ liệu
    """
    row_count = int(len(df))
    col_count = int(len(df.columns))
    duplicate_rows = int(df.duplicated().sum())

    total_missing_cells = 0
    total_cells = row_count * col_count if (row_count and col_count) else 1

    columns_meta = []
    for col in df.columns:
        series = df[col]
        missing_count = int(series.isna().sum())
        total_missing_cells += missing_count
        missing_pct = round((missing_count / row_count * 100), 1) if row_count > 0 else 0
        unique_count = int(series.nunique(dropna=True))

        dtype_str = str(series.dtype)
        is_numeric = bool(pd.api.types.is_numeric_dtype(series))
        is_datetime = bool(pd.api.types.is_datetime64_any_dtype(series))

        col_summary: dict[str, Any] = {
            "name": str(col),
            "dtype": dtype_str,
            "type_category": "Số (Numeric)" if is_numeric else ("Thời gian (Datetime)" if is_datetime else "Phân loại (Categorical)"),
            "missing_count": missing_count,
            "missing_percentage": missing_pct,
            "unique_count": unique_count,
            "is_constant": bool(unique_count <= 1 and row_count > 1),
            "sample_values": [str(x) for x in series.dropna().head(3).tolist()],
        }

        if is_numeric and int(series.dropna().count()) > 0:
            try:
                col_summary["min"] = float(series.min())
                col_summary["max"] = float(series.max())
                col_summary["mean"] = round(float(series.mean()), 2)
                col_summary["median"] = round(float(series.median()), 2)
            except Exception:
                pass

        columns_meta.append(col_summary)

    # Tính điểm chất lượng dữ liệu (Data Health Score: 0 - 100%)
    missing_ratio = total_missing_cells / total_cells
    duplicate_ratio = duplicate_rows / row_count if row_count > 0 else 0
    health_score = max(0, min(100, round((1.0 - (missing_ratio * 0.7 + duplicate_ratio * 0.3)) * 100, 1)))

    # Tự động phát hiện bất thường & đưa ra khuyến nghị
    recommendations = []
    if duplicate_rows > 0:
        recommendations.append(f"Phát hiện {duplicate_rows} dòng dữ liệu bị trùng lặp hoàn toàn, khuyến nghị lọc bỏ để không làm lệch mô hình.")
    for c in columns_meta:
        if c["missing_count"] > 0:
            if c["missing_percentage"] > 50:
                recommendations.append(f"Cột '{c['name']}' bị khuyết {c['missing_percentage']}% dữ liệu (>50%), khuyến nghị cân nhắc loại bỏ cột này khi huấn luyện dự báo.")
            elif c["type_category"] == "Số (Numeric)":
                recommendations.append(f"Cột số '{c['name']}' có {c['missing_count']} ô bị trống ({c['missing_percentage']}%), khuyến nghị điền bằng giá trị trung bình ({c.get('mean', 0)}) hoặc trung vị.")
            else:
                recommendations.append(f"Cột phân loại '{c['name']}' có {c['missing_count']} ô bị trống, khuyến nghị điền nhãn 'Chưa xác định'.")
        if c["is_constant"]:
            recommendations.append(f"Cột '{c['name']}' chỉ chứa 1 giá trị duy nhất (hằng số), không mang giá trị thống kê phân tích.")

    if not recommendations:
        recommendations.append("Cấu trúc dữ liệu hoàn hảo! Không phát hiện bản ghi trùng lặp và không có dữ liệu khuyết thiếu.")

    return {
        "row_count": row_count,
        "column_count": col_count,
        "duplicate_rows": duplicate_rows,
        "total_missing_cells": total_missing_cells,
        "health_score": health_score,
        "columns": columns_meta,
        "recommendations": recommendations,
    }


@router.get("/", response_model=DatasetsPublic)
def read_datasets(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    Lấy danh sách tệp dữ liệu của người dùng hiện tại (hoặc tất cả nếu là Admin).
    """
    if current_user.is_superuser:
        count_statement = select(func.count()).select_from(Dataset)
        count = session.exec(count_statement).one()
        statement = select(Dataset).order_by(Dataset.created_at.desc()).offset(skip).limit(limit)
        datasets = session.exec(statement).all()
    else:
        count_statement = (
            select(func.count())
            .select_from(Dataset)
            .where(Dataset.owner_id == current_user.id)
        )
        count = session.exec(count_statement).one()
        statement = (
            select(Dataset)
            .where(Dataset.owner_id == current_user.id)
            .order_by(Dataset.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        datasets = session.exec(statement).all()

    return DatasetsPublic(data=datasets, count=count)


@router.post("/upload", response_model=DatasetPublic)
async def upload_dataset(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile,
    description: str | None = Form(default=None),
) -> Any:
    """
    Tải lên tệp dữ liệu (Excel/CSV), thực hiện phân tích cấu trúc, lưu siêu dữ liệu và phiên bản.
    """
    filename = file.filename or "data.csv"
    file_ext = filename.split(".")[-1].lower() if "." in filename else ""

    if file_ext not in ["csv", "xlsx", "xls"]:
        raise HTTPException(
            status_code=400,
            detail="Định dạng tệp không được hỗ trợ. Vui lòng tải tệp .csv hoặc .xlsx/.xls",
        )

    file_uuid = uuid.uuid4().hex
    saved_filename = f"{file_uuid}_{filename}"
    saved_path = os.path.join(UPLOAD_DIR, saved_filename)

    with open(saved_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    size_bytes = os.path.getsize(saved_path)

    try:
        df = smart_load_dataframe(saved_path)
        # Ghi đè file chuẩn hóa để đảm bảo các tiến trình về sau đọc đúng cấu trúc
        if file_ext == "csv":
            df.to_csv(saved_path, index=False)
        else:
            df.to_excel(saved_path, index=False)
        size_bytes = os.path.getsize(saved_path)

        # Chạy phân tích lược đồ dữ liệu chuyên sâu (Chức năng 3)
        profile = profile_dataset_schema(df)
        row_count = profile["row_count"]
        column_count = profile["column_count"]

        # Dữ liệu xem trước 10 dòng đầu
        sample_rows = df.head(10).fillna("").to_dict(orient="records")
        sample_data_json = json.dumps(sample_rows, ensure_ascii=False, default=str)
        schema_info_json = json.dumps(profile, ensure_ascii=False)
        status = "ready"

    except Exception as e:
        status = "error"
        row_count = 0
        column_count = 0
        schema_info_json = json.dumps({"error": str(e), "columns": [], "recommendations": []})
        sample_data_json = json.dumps([])

    # Tính toán phiên bản (Version)
    existing_dataset = session.exec(
        select(Dataset)
        .where(Dataset.owner_id == current_user.id, Dataset.filename == filename)
        .order_by(Dataset.version.desc())
    ).first()

    version = (existing_dataset.version + 1) if existing_dataset else 1

    dataset = Dataset(
        filename=filename,
        file_type=file_ext,
        size_bytes=size_bytes,
        row_count=row_count,
        column_count=column_count,
        version=version,
        status=status,
        description=description,
        schema_info=schema_info_json,
        sample_data=sample_data_json,
        file_path=saved_path,
        owner_id=current_user.id,
    )

    session.add(dataset)
    session.commit()
    session.refresh(dataset)
    return dataset


@router.get("/{id}", response_model=DatasetPublic)
def read_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Lấy thông tin tệp dữ liệu theo ID kèm lược đồ và dữ liệu mẫu.
    """
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp dữ liệu")
    if not current_user.is_superuser and (dataset.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không đủ quyền truy cập tệp này")
    return dataset


@router.get("/{id}/quality-report")
def get_dataset_quality_report(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Chức năng 3: Lấy báo cáo chi tiết về chất lượng dữ liệu, lược đồ và khuyến nghị làm sạch.
    """
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp dữ liệu")
    if not current_user.is_superuser and (dataset.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không đủ quyền truy cập tệp này")

    try:
        profile = json.loads(dataset.schema_info or "{}")
        if "columns" not in profile and isinstance(profile, list):
            profile = {"columns": profile, "health_score": 100, "recommendations": []}
    except Exception:
        profile = {"columns": [], "health_score": 0, "recommendations": ["Lỗi đọc thông tin cấu trúc tệp."]}

    return {
        "dataset_id": dataset.id,
        "filename": dataset.filename,
        "version": dataset.version,
        "row_count": dataset.row_count,
        "column_count": dataset.column_count,
        "size_bytes": dataset.size_bytes,
        "status": dataset.status,
        "quality_profile": profile,
    }


@router.post("/{id}/clean", response_model=DatasetPublic)
def clean_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Chức năng 3: Tự động chuẩn hóa & làm sạch dữ liệu:
    - Loại bỏ các dòng trùng lặp hoàn toàn
    - Điền dữ liệu thiếu (Trung vị cho cột số, 'Chưa xác định' cho cột văn bản)
    - Cập nhật số dòng, số cột, siêu dữ liệu và nâng điểm Data Health Score lên 100%
    """
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp dữ liệu")
    if not current_user.is_superuser and (dataset.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không đủ quyền truy cập tệp này")

    if not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Tệp không tồn tại trên hệ thống lưu trữ")

    try:
        if dataset.file_type == "csv":
            try:
                df = pd.read_csv(dataset.file_path)
            except UnicodeDecodeError:
                df = pd.read_csv(dataset.file_path, encoding="latin1")
        else:
            df = pd.read_excel(dataset.file_path)

        # 1. Loại bỏ các dòng trùng lặp
        df = df.drop_duplicates()

        # 2. Xử lý các giá trị rỗng/khuyết thiếu
        for col in df.columns:
            if df[col].isna().sum() > 0:
                if pd.api.types.is_numeric_dtype(df[col]):
                    median_val = df[col].median()
                    fill_val = median_val if pd.notna(median_val) else 0
                    df[col] = df[col].fillna(fill_val)
                else:
                    df[col] = df[col].fillna("Chưa xác định")

        # 3. Ghi đè lại file đã làm sạch
        if dataset.file_type == "csv":
            df.to_csv(dataset.file_path, index=False)
        else:
            df.to_excel(dataset.file_path, index=False)

        # 4. Phân tích lại lược đồ sau khi làm sạch
        profile = profile_dataset_schema(df)
        dataset.row_count = profile["row_count"]
        dataset.column_count = profile["column_count"]
        dataset.size_bytes = os.path.getsize(dataset.file_path)
        dataset.schema_info = json.dumps(profile, ensure_ascii=False)
        sample_rows = df.head(10).fillna("").to_dict(orient="records")
        dataset.sample_data = json.dumps(sample_rows, ensure_ascii=False, default=str)
        dataset.status = "ready"

        session.add(dataset)
        session.commit()
        session.refresh(dataset)
        return dataset
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Lỗi khi làm sạch dữ liệu: {str(e)}")


@router.get("/{id}/download")
def download_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Tải về tệp dữ liệu gốc.
    """
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp dữ liệu")
    if not current_user.is_superuser and (dataset.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không đủ quyền truy cập tệp này")

    if not os.path.exists(dataset.file_path):
        raise HTTPException(status_code=404, detail="Tệp không tồn tại trên hệ thống lưu trữ")

    return FileResponse(
        path=dataset.file_path,
        filename=dataset.filename,
        media_type="application/octet-stream",
    )


@router.delete("/{id}", response_model=Message)
def delete_dataset(
    id: uuid.UUID,
    session: SessionDep,
    current_user: CurrentUser,
) -> Any:
    """
    Xóa tệp dữ liệu và giải phóng file trên đĩa.
    """
    dataset = session.get(Dataset, id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Không tìm thấy tệp dữ liệu")
    if not current_user.is_superuser and (dataset.owner_id != current_user.id):
        raise HTTPException(status_code=403, detail="Không đủ quyền truy cập tệp này")

    if os.path.exists(dataset.file_path):
        try:
            os.remove(dataset.file_path)
        except OSError:
            pass

    session.delete(dataset)
    session.commit()
    return Message(message="Xóa tệp dữ liệu thành công")
