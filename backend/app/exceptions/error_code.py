"""Stable application error codes and their HTTP status."""

from enum import Enum


class ErrorCode(Enum):
    INVALID_CREDENTIALS = ("AUTH_001", "Incorrect email or password", 400)
    INVALID_TOKEN = ("AUTH_002", "Invalid token", 400)
    INACTIVE_USER = ("AUTH_003", "Inactive user", 400)
    INCORRECT_PASSWORD = ("AUTH_004", "Incorrect password", 400)
    PASSWORD_UNCHANGED = (
        "AUTH_005",
        "New password cannot be the same as the current one",
        400,
    )
    FORBIDDEN = ("AUTH_006", "Not enough permissions", 403)
    SELF_DELETE_FORBIDDEN = (
        "AUTH_007",
        "Super users are not allowed to delete themselves",
        403,
    )
    ACCESS_TOKEN_INVALID = (
        "AUTH_008",
        "Could not validate credentials",
        403,
    )
    USER_NOT_FOUND = ("USER_001", "User not found", 404)
    USER_ALREADY_EXISTS = (
        "USER_002",
        "The user with this email already exists in the system.",
        400,
    )
    EMAIL_CONFLICT = ("USER_003", "User with this email already exists", 409)
    DATASET_NOT_FOUND = ("DATASET_001", "Không tìm thấy tệp dữ liệu", 404)
    DATASET_ACCESS_DENIED = (
        "DATASET_002",
        "Không đủ quyền truy cập tệp này",
        403,
    )
    DATASET_FILE_NOT_FOUND = (
        "DATASET_003",
        "Tệp không tồn tại trên hệ thống lưu trữ",
        404,
    )
    UNSUPPORTED_FILE_TYPE = (
        "FILE_001",
        "Định dạng tệp không được hỗ trợ.",
        400,
    )
    DATASET_READ_ERROR = ("DATASET_004", "Không thể đọc dữ liệu", 400)
    DATASET_CLEAN_ERROR = ("DATASET_005", "Lỗi khi làm sạch dữ liệu", 500)
    ANALYSIS_UPLOAD_READ_ERROR = (
        "ANALYSIS_003",
        "Không thể đọc dữ liệu",
        500,
    )
    ANALYSIS_FILE_READ_ERROR = ("ANALYSIS_001", "Không thể đọc file dữ liệu", 400)
    ANALYSIS_ERROR = ("ANALYSIS_002", "Không thể thực hiện phân tích", 400)
    HISTORY_NOT_FOUND = ("HISTORY_001", "Không tìm thấy bản ghi lịch sử", 404)
    HISTORY_ACCESS_DENIED = (
        "HISTORY_002",
        "Không có quyền truy cập bản ghi này",
        403,
    )
    HISTORY_DELETE_DENIED = (
        "HISTORY_003",
        "Không có quyền xóa bản ghi này",
        403,
    )
    BAD_REQUEST = ("HTTP_400", "Bad request", 400)
    UNAUTHORIZED = ("HTTP_401", "Unauthorized", 401)
    NOT_FOUND = ("HTTP_404", "Not found", 404)
    CONFLICT = ("HTTP_409", "Conflict", 409)
    UNPROCESSABLE_ENTITY = ("HTTP_422", "Unprocessable entity", 422)
    INTERNAL_SERVER_ERROR = ("SYS_500", "An unexpected error occurred", 500)
    HTTP_ERROR = ("HTTP_ERROR", "HTTP request failed", 500)

    def __init__(self, code: str, message: str, http_status: int) -> None:
        self.code = code
        self.message = message
        self.http_status = http_status

    @classmethod
    def for_http_status(cls, status_code: int) -> "ErrorCode":
        return {
            400: cls.BAD_REQUEST,
            401: cls.UNAUTHORIZED,
            403: cls.FORBIDDEN,
            404: cls.NOT_FOUND,
            409: cls.CONFLICT,
            422: cls.UNPROCESSABLE_ENTITY,
            500: cls.INTERNAL_SERVER_ERROR,
        }.get(status_code, cls.HTTP_ERROR)
