@echo off
chcp 65001 >nul
echo ==========================================
echo [1/2] Đang biên dịch Frontend (React + Vite)...
echo ==========================================
docker run --rm -v "%cd%:/workspace" -w /workspace/frontend oven/bun:latest bun run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [LỖI] Quá trình biên dịch Frontend gặp lỗi!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ==========================================
echo [2/2] Đang khởi động lại Backend (FastAPI)...
echo ==========================================
docker compose restart backend

echo.
echo ==========================================
echo [THÀNH CÔNG] Đã cập nhật xong cả Frontend và Backend!
echo Mở trình duyệt tại http://localhost:8000 và bấm Ctrl + F5 để xem thay đổi.
echo ==========================================
pause
