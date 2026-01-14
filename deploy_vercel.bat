@echo off
echo ==========================================
echo      Atari Tetris - Vercel Deployment
echo ==========================================
echo.
echo We are switching to Vercel for more stable hosting.
echo.
echo 1. You may be asked to log in. A browser window will open.
echo 2. Please log in with GitHub, GitLab, or Email.
echo 3. The script will automatically deploy ("--yes" confirmation).
echo.
cd /d "%~dp0"

:: Initializing deployment
call npx vercel --prod --yes

echo.
echo ==========================================
echo      Deployment Process Complete
echo ==========================================
echo If successful, you will see a 'Production' URL above.
echo.
pause
