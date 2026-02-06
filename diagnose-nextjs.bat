@echo off
chcp 65001 >nul
cls
echo.
echo ========================================
echo    Next.js 문제 진단
echo ========================================
echo.

cd /d "%~dp0"

echo [1] 현재 디렉토리 확인
echo    %CD%
echo.

echo [2] package.json 파일 확인
if exist "package.json" (
    echo    [OK] package.json 있음
) else (
    echo    [오류] package.json 없음!
    pause
    exit /b 1
)
echo.

echo [3] node_modules 폴더 확인
if exist "node_modules" (
    echo    [OK] node_modules 있음
) else (
    echo    [오류] node_modules 없음! 
    echo    해결: pnpm install 실행 필요
    echo.
    choice /C YN /M "지금 pnpm install을 실행하시겠습니까?"
    if errorlevel 2 goto skip_install
    if errorlevel 1 (
        echo.
        echo    패키지 설치 중... (시간이 걸릴 수 있습니다)
        pnpm install
        echo.
        echo    설치 완료!
    )
    :skip_install
)
echo.

echo [4] pnpm 확인
pnpm --version >nul 2>&1
if %errorlevel% equ 0 (
    echo    [OK] pnpm 설치됨
    pnpm --version
) else (
    echo    [오류] pnpm이 설치되지 않음!
    echo    해결: npm install -g pnpm 실행
    pause
    exit /b 1
)
echo.

echo [5] Node.js 확인
node --version >nul 2>&1
if %errorlevel% equ 0 (
    echo    [OK] Node.js 설치됨
    node --version
) else (
    echo    [오류] Node.js가 설치되지 않음!
    pause
    exit /b 1
)
echo.

echo [6] 포트 3000 사용 확인
netstat -ano | findstr ":3000" >nul
if %errorlevel% equ 0 (
    echo    [경고] 포트 3000이 이미 사용 중입니다!
    echo    사용 중인 프로세스:
    netstat -ano | findstr ":3000"
    echo.
    choice /C YN /M "포트를 사용 중인 프로세스를 종료하시겠습니까?"
    if errorlevel 2 goto skip_kill
    if errorlevel 1 (
        taskkill /F /IM node.exe 2>nul
        echo    프로세스 종료됨
    )
    :skip_kill
) else (
    echo    [OK] 포트 3000 사용 가능
)
echo.

echo ========================================
echo    진단 완료
echo ========================================
echo.
choice /C YN /M "Next.js 서버를 지금 시작하시겠습니까?"
if errorlevel 2 goto end
if errorlevel 1 (
    echo.
    echo ========================================
    echo    Next.js 서버 시작 중...
    echo ========================================
    echo.
    pnpm run dev
)

:end
echo.
pause












