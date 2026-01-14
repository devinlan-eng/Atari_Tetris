@echo off
echo ==========================================
echo      Atari Tetris - Manual Deployment
echo ==========================================
echo.
echo This script will deploy your game to Surge.sh.
echo Domain: atari-tetris-live-v1.surge.sh
echo.
cd /d "%~dp0"

:: Initializing deployment
call npx surge ./ atari-tetris-live-v1.surge.sh

echo.
echo ==========================================
echo      Deployment Attempt Finished
echo ==========================================
echo If you saw "Success", your game is live at:
echo https://atari-tetris-live-v1.surge.sh
echo.
pause
