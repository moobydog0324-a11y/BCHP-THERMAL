@echo off
chcp 65001 >nul
cls
echo.
echo ========================================
echo    BCHP-THERMA 서버 시작
echo ========================================
echo.

REM 현재 디렉토리 확인
cd /d "%~dp0"
echo 작업 디렉토리: %CD%
echo.

REM 1단계: 기존 프로세스 정리
echo [1/4] 기존 서버 프로세스 종료 중...
taskkill /F /IM python.exe 2>nul
if %errorlevel% equ 0 (
    echo       - Python 프로세스 종료됨
) else (
    echo       - Python 프로세스 없음
)

taskkill /F /IM node.exe 2>nul
if %errorlevel% equ 0 (
    echo       - Node.js 프로세스 종료됨
) else (
    echo       - Node.js 프로세스 없음
)

echo       대기 중 (3초)...
timeout /t 3 /nobreak >nul
echo       완료!
echo.

REM 2단계: Flask 서버 시작
echo [2/4] Flask 서버 시작 중...
if exist "python-backend\app.py" (
    start "Flask FLIR 분석 서버 - 포트 5000" cmd /k "cd python-backend && set PYTHONIOENCODING=utf-8 && echo Flask 서버 시작... && python app.py"
    echo       - Flask 서버 창이 열렸습니다
    echo       - URL: http://localhost:5000
    timeout /t 5 /nobreak >nul
    echo       완료!
) else (
    echo       [오류] python-backend\app.py 파일을 찾을 수 없습니다!
    pause
    exit /b 1
)
echo.

REM 3단계: Next.js 서버 시작
echo [3/4] Next.js 서버 시작 중...
if exist "package.json" (
    start "Next.js 웹 서버 - 포트 3000" cmd /k "echo Next.js 서버 시작... && pnpm run dev"
    echo       - Next.js 서버 창이 열렸습니다
    echo       - URL: http://localhost:3000
    timeout /t 8 /nobreak >nul
    echo       완료!
) else (
    echo       [오류] package.json 파일을 찾을 수 없습니다!
    pause
    exit /b 1
)
echo.

REM 4단계: 서버 상태 확인
echo [4/4] 서버 상태 확인 중...
timeout /t 3 /nobreak >nul

powershell -Command "$flask = $false; $nextjs = $false; try { $r = Invoke-WebRequest -Uri 'http://localhost:5000' -TimeoutSec 3 -UseBasicParsing; $flask = $true; Write-Host '       [OK] Flask 서버: 정상' -ForegroundColor Green } catch { Write-Host '       [대기] Flask 서버: 시작 중...' -ForegroundColor Yellow }; try { $r = Invoke-WebRequest -Uri 'http://localhost:3000' -TimeoutSec 3 -UseBasicParsing; $nextjs = $true; Write-Host '       [OK] Next.js 서버: 정상' -ForegroundColor Green } catch { Write-Host '       [대기] Next.js 서버: 시작 중...' -ForegroundColor Yellow }; if ($flask -and $nextjs) { Write-Host ''; Write-Host '       모든 서버가 정상 작동 중입니다!' -ForegroundColor Green } else { Write-Host ''; Write-Host '       일부 서버가 아직 시작 중입니다. 잠시 기다려주세요.' -ForegroundColor Yellow }"

echo.
echo ========================================
echo    서버 시작 완료!
echo ========================================
echo.
echo 접속 URL:
echo   웹 애플리케이션: http://localhost:3000
echo   Flask API:       http://localhost:5000
echo.
echo 테스트:
echo   1. 브라우저에서 http://localhost:3000 접속
echo   2. 업로드 페이지에서 새 이미지 업로드
echo   3. 비교 페이지에서 정확한 온도 확인
echo.
echo 서버 확인: check-servers.bat 실행
echo 서버 종료: 열린 2개의 명령창을 닫으세요
echo.
pause

