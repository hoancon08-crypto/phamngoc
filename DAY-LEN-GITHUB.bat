@echo off
cd /d "%~dp0"
echo ========================================================
echo DANG DAY CODE LEN GITHUB: hoancon08-crypto/phamngoc
echo ========================================================
echo.
git add -A
git commit -m "Cap nhat tinh nang thu muc va bao mat trang QR"
git push -u origin main
echo.
echo ========================================================
if %errorlevel% equ 0 (
    echo [THANH CONG] Da day toan bo code len GitHub thanh cong!
) else (
    echo [THONG BAO] Neu co cua so dang nhap, ban hay dang nhap bang trinh duyet nhe.
)
echo ========================================================
pause
