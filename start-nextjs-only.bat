@echo off
chcp 65001 >nul
cls
echo.
echo ========================================
echo    Next.js 서버만 시작
echo ========================================
echo.

cd /d "%~dp0"
echo 작업 디렉토리: %CD%
echo.

REM Node 프로세스만 종료
echo [1/2] 기존 Node.js 프로세스 종료...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo       완료!
echo.

REM Next.js 시작
echo [2/2] Next.js 서버 시작 중...
if exist "package.json" (
    echo.
    echo ----------------------------------------
    echo Next.js 서버를 시작합니다...
    echo ----------------------------------------
    echo.
    pnpm run dev
) else (
    echo [오류] package.json을 찾을 수 없습니다!
    echo 현재 위치: %CD%
    pause
    exit /b 1
)







