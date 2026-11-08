$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "[1/2] Đang biên dịch Frontend (React + Vite)..." -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

docker run --rm -v "${PWD}:/workspace" -w /workspace/frontend oven/bun:latest bun run build

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "[LỖI] Quá trình biên dịch Frontend gặp lỗi!" -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "[2/2] Đang khởi động lại Backend (FastAPI)..." -ForegroundColor Yellow
Write-Host "==========================================" -ForegroundColor Cyan

docker compose restart backend

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "[THÀNH CÔNG] Đã cập nhật xong cả Frontend và Backend!" -ForegroundColor Green
Write-Host "Mở trình duyệt tại http://localhost:8000 và bấm Ctrl + F5 để xem thay đổi." -ForegroundColor White
Write-Host "==========================================" -ForegroundColor Green
