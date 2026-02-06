@echo off
cd /d "%~dp0"
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo Starting Next.js server on http://localhost:3000
echo.
pnpm run dev












