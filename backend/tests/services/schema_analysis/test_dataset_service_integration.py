"""Integration test to verify DatasetService upload preserves original file and executes WorkbookInspector."""

import hashlib
import io
import json
import sys
import tempfile
import uuid
from pathlib import Path
from unittest.mock import MagicMock

# Lightweight mocks for backend infra dependencies if running outside full DB container
for mod in [
    "sqlalchemy",
    "sqlalchemy.orm",
    "sqlmodel",
    "fastapi",
    "fastapi.encoders",
    "pydantic_settings",
    "jwt",
    "emails",
    "pwdlib",
    "pwdlib.hashers",
    "pwdlib.hashers.argon2",
    "pwdlib.hashers.bcrypt",
    "sentry_sdk",
    "app.core.config",
]:
    if mod not in sys.modules:
        sys.modules[mod] = MagicMock()

if "app.entities.dataset" not in sys.modules:
    class MockDataset:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    mock_ds_mod = MagicMock()
    mock_ds_mod.Dataset = MockDataset
    sys.modules["app.entities.dataset"] = mock_ds_mod

if "app.repositories.dataset_repository" not in sys.modules:
    mock_repo_mod = MagicMock()
    mock_repo_mod.DatasetRepository = MagicMock
    mock_repo_mod.repository = MagicMock()
    sys.modules["app.repositories.dataset_repository"] = mock_repo_mod

import openpyxl

from app.services.dataset_file_storage import DatasetFileStorage
from app.services.dataset_service import DatasetService


def _compute_sha256(path: str | Path) -> str:
    hasher = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    return hasher.hexdigest()


def test_dataset_upload_preserves_original_excel_workbook() -> None:
    with tempfile.TemporaryDirectory() as td:
        upload_dir = Path(td) / "uploads"
        storage = DatasetFileStorage(upload_dir=str(upload_dir))

        # Create a mock multi-sheet Excel workbook in memory
        wb = openpyxl.Workbook()
        ws1 = wb.active
        ws1.title = "Sales"
        ws1["A1"] = "Order_ID"
        ws1["B1"] = "Revenue"
        ws1["A2"] = "ORD-001"
        ws1["B2"] = 1500
        ws1["B3"] = "=SUM(B2:B2)"
        ws1.merge_cells("C1:D1")

        ws2 = wb.create_sheet("Archived")
        ws2.sheet_state = "hidden"
        ws2["A1"] = "OldData"

        bio = io.BytesIO()
        wb.save(bio)
        wb.close()
        bio.seek(0)

        original_bytes = bio.getvalue()
        original_hash = hashlib.sha256(original_bytes).hexdigest()

        # Mock repository
        mock_repo = MagicMock()
        mock_repo.get_latest_by_filename.return_value = None
        mock_repo.add.side_effect = lambda session, ds: ds

        service = DatasetService(dataset_repository=mock_repo, storage=storage)

        mock_session = MagicMock()
        mock_user = MagicMock()
        mock_user.id = uuid.uuid4()
        mock_user.is_superuser = False

        dataset = service.upload_dataset(
            session=mock_session,
            user=mock_user,
            file_stream=bio,
            filename="financial_report.xlsx",
            description="Test report",
        )

        assert dataset.status == "ready"
        assert dataset.file_path is not None
        assert Path(dataset.file_path).exists()

        # CRITICAL: Verify file on disk is bit-for-bit identical to uploaded bytes
        saved_file_hash = _compute_sha256(dataset.file_path)
        assert saved_file_hash == original_hash, (
            "CRITICAL BUG: Uploaded file on disk was modified or overwritten! "
            f"Expected {original_hash}, got {saved_file_hash}"
        )

        # Verify workbook inspection was captured
        schema_dict = json.loads(dataset.schema_info)
        assert "workbook_inspection" in schema_dict
        wb_meta = schema_dict["workbook_inspection"]["workbook_metadata"]
        assert wb_meta["sheet_count"] == 2
        assert wb_meta["sheet_names"] == ["Sales", "Archived"]

        # Verify sheets inside inspection
        sheets = schema_dict["workbook_inspection"]["sheets"]
        assert len(sheets) == 2
        assert sheets[0]["sheet_name"] == "Sales"
        assert sheets[0]["has_formula"] is True
        assert sheets[0]["has_merged_cells"] is True
        assert sheets[1]["sheet_name"] == "Archived"
        assert sheets[1]["visibility"] == "hidden"


if __name__ == "__main__":
    print("Running DatasetService upload preservation test...")
    test_dataset_upload_preserves_original_excel_workbook()
    print("PASS: Original Excel workbook preserved and WorkbookInspector executed perfectly!")
