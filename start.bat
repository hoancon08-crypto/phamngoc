@echo off
title Kot Nha Decor - Cong cu xac thuc tranh nghe thuat
cd /d "%~dp0"
echo ========================================================
echo   KOT NHA DECOR - HE THONG TAO & XAC THUC TRANH QR
echo ========================================================
echo.
echo Dang khoi dong may chu...
start http://localhost:3000
node server.js
pause
