@echo off
cd /d "%~dp0"
echo ========================================================
echo DANG DAY CODE LEN GITHUB: hoancon08-crypto/phamngoc
echo ========================================================
echo.
git add -A
git commit -m "Cap nhat tinh nang thu muc va bao mat trang QR"
git push -u origin main --force
echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo [THANH CONG] Da day toan bo code len GitHub thanh cong!
) else (
    echo [LOI] Khong the day len GitHub, vui long kiem tra ket noi.
)
echo ========================================================
pause
