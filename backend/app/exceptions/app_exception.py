"""Application-level exception carrying a stable error code."""

from app.exceptions.error_code import ErrorCode


class AppException(Exception):
    def __init__(self, error_code: ErrorCode, detail: str | None = None) -> None:
        self.error_code = error_code
        self.detail = detail if detail is not None else error_code.message
        super().__init__(self.detail)
