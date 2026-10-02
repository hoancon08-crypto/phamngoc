@echo off
title Kot Nha Decor - He Thong Xac Thuc Tranh Online
cd /d "%~dp0"
echo ========================================================
echo   KOT NHA DECOR - HE THONG TAO & XAC THUC TRANH QR
echo ========================================================
echo.
echo 1. Dang khoi dong may chu noi bo...
start "Node Server" /min node server.js

timeout /t 2 /nobreak >nul

echo 2. Dang ket noi Cloudflare Tunnel (Cho khach quet bang 4G/5G)...
start "Cloudflare Tunnel" /min cloudflared.exe tunnel --url http://localhost:3000

timeout /t 3 /nobreak >nul

echo.
echo Mo trinh duyet quan ly tren may tinh...
start http://localhost:3000

echo.
echo He thong dang hoat dong! De dung he thong, hay dong cua so nay.
pause
