@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo === CubeNexus Expo (LAN) ===
echo 1) Mo Expo Go tren dien thoai
echo 2) Bam "Enter URL manually"
echo 3) Go dung:
echo.
echo    exp://10.10.88.90:8088
echo.
echo Neu khong vao duoc WiFi truong:
echo  - Bat hotspot dien thoai
echo  - PC join hotspot
echo  - Chay lai npm start, dung IP moi trong QR
echo.

set BROWSER=none
npx expo start --lan --port 8088
