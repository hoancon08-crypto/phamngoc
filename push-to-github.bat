@echo off
title Day code len GitHub - phamngoc
cd /d "%~dp0"
echo ========================================================
echo   DANG DAY MA NGUON LEN GITHUB (hoancon08-crypto/phamngoc)
echo ========================================================
echo.
git push -u origin main --force
echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo [THANH CONG] Da day code len GitHub thanh cong!
) else (
    echo [CHUA XONG] Neu co cua so dang nhap GitHub hien len, ban hay bam dong y nhe.
)
echo ========================================================
pause
