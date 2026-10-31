"""Filesystem storage operations for uploaded datasets."""

import os
import shutil
import uuid
from typing import BinaryIO


def _get_default_upload_dir() -> str:
    env_dir = os.getenv("UPLOAD_DIR")
    if env_dir:
        return env_dir
    if os.name != "nt" and os.path.exists("/app"):
        return "/app/uploads"
    if os.path.exists("backend/uploads"):
        return os.path.abspath("backend/uploads")
    return os.path.abspath("uploads")


UPLOAD_DIR = _get_default_upload_dir()
os.makedirs(UPLOAD_DIR, exist_ok=True)


class DatasetFileStorage:
    def __init__(self, upload_dir: str = UPLOAD_DIR) -> None:
        self.upload_dir = upload_dir
        os.makedirs(self.upload_dir, exist_ok=True)

    def save_upload(self, file_stream: BinaryIO, original_filename: str) -> tuple[str, int]:
        saved_filename = f"{uuid.uuid4().hex}_{original_filename}"
        saved_path = os.path.join(self.upload_dir, saved_filename)
        with open(saved_path, "wb") as buffer:
            shutil.copyfileobj(file_stream, buffer)
        return saved_path, os.path.getsize(saved_path)

    def exists(self, file_path: str) -> bool:
        return os.path.exists(file_path)

    def size(self, file_path: str) -> int:
        return os.path.getsize(file_path)

    def delete(self, file_path: str) -> None:
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass


file_storage = DatasetFileStorage()
