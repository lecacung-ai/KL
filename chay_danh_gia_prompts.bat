@echo off
chcp 65001 > nul
title THỰC NGHIỆM ĐỐI SÁNH 5 BIẾN THỂ PROMPT VẼ BIỂU ĐỒ - FINAI

echo ===============================================================================
echo     CHƯƠNG TRÌNH ĐỐI SÁNH 5 BIẾN THỂ PROMPT VẼ BIỂU ĐỒ (FINAI BENCHMARK)
echo     Mục đích: Tìm Prompt tối ưu để AI sinh mã biểu đồ chạy ổn định trên máy chủ
echo ===============================================================================
echo.
echo Hệ thống sẽ chạy 5 phiên bản Prompt vẽ biểu đồ (P1 Baseline -> P5 Tối ưu)
echo qua mô hình AI và thực thi mã trong Secure Sandbox Engine.
echo.
echo [1] Chạy thử nghiệm trên 10 tệp đại diện (100 lượt vẽ biểu đồ, mất khoảng 4-5 phút - Khuyên dùng)
echo [2] Chạy toàn bộ 50 tệp trong thư mục D:\School\KhoaLuan\file (500 lượt vẽ biểu đồ, mất khoảng 25 phút)
echo [3] Tùy chỉnh số lượng tệp
echo [4] Thoát
echo.
set /p choice="Nhập lựa chọn của bạn (1/2/3/4) [Mặc định: 1]: "

if "%choice%"=="" set choice=1
if "%choice%"=="4" exit /b
if "%choice%"=="1" set MAX_FILES=10
if "%choice%"=="2" set MAX_FILES=50
if "%choice%"=="3" (
    set /p MAX_FILES="Nhập số lượng tệp muốn kiểm thử: "
)

echo.
echo [1/3] Đang đồng bộ kịch bản và tệp kiểm thử vào Docker container...
docker cp backend/scripts/benchmark_prompts.py kl-backend-1:/app/backend/scripts/benchmark_prompts.py > nul 2>&1

echo [2/3] Đang tiến hành thực nghiệm (%MAX_FILES% tệp)...
docker exec -it kl-backend-1 python /app/backend/scripts/benchmark_prompts.py --max %MAX_FILES%

echo.
echo [3/3] Đang sao chép kết quả Excel và ảnh biểu đồ ra máy thật...
copy /Y "backend\uploads\Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx" "D:\School\KhoaLuan\file\Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx" > nul 2>&1
copy /Y "backend\uploads\Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx" "Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx" > nul 2>&1

xcopy /E /I /Y "backend\uploads\Ket_Qua_Bieu_Do" "D:\School\KhoaLuan\file\Ket_Qua_Bieu_Do" > nul 2>&1
xcopy /E /I /Y "backend\uploads\Ket_Qua_Bieu_Do" "Ket_Qua_Bieu_Do" > nul 2>&1

echo.
echo ===============================================================================
echo 🎉 HOÀN THÀNH THỰC NGHIỆM THÀNH CÔNG!
echo 1. File thống kê Excel:
echo    - D:\School\KhoaLuan\file\Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx
echo    - .\Ket_Qua_Thuc_Nghiem_5_Prompt.xlsx
echo.
echo 2. Thư mục chứa toàn bộ ảnh biểu đồ sinh ra (để quan sát bằng mắt):
echo    - D:\School\KhoaLuan\file\Ket_Qua_Bieu_Do\
echo    - .\Ket_Qua_Bieu_Do\
echo ===============================================================================
pause
