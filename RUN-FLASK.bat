@echo off
cd /d "%~dp0\python-backend"
taskkill /F /IM python.exe 2>nul
timeout /t 2 /nobreak >nul
set PYTHONIOENCODING=utf-8
echo Starting Flask server on http://localhost:5000
echo.
python app.py






