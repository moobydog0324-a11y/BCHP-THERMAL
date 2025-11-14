@echo off
chcp 65001 >nul
cls
echo.
echo ========================================
echo    서버 상태 점검
echo ========================================
echo.

REM Flask 서버 확인 (포트 5000)
echo [1] Flask 서버 (포트 5000)
echo    확인 중...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:5000' -Method Get -TimeoutSec 3 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host '    [OK] Flask 서버 정상 작동' -ForegroundColor Green; Write-Host '        - 상태: 실행 중' -ForegroundColor White; Write-Host '        - URL: http://localhost:5000' -ForegroundColor White; exit 0 } else { Write-Host '    [경고] 비정상 응답' -ForegroundColor Yellow; exit 1 } } catch { Write-Host '    [오류] Flask 서버 응답 없음' -ForegroundColor Red; Write-Host '        - 서버가 시작되지 않았거나 포트 5000이 사용 중입니다' -ForegroundColor Yellow; exit 2 }"

echo.
echo.

REM Next.js 서버 확인 (포트 3000)
echo [2] Next.js 서버 (포트 3000)
echo    확인 중...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:3000' -Method Get -TimeoutSec 3 -UseBasicParsing; if ($response.StatusCode -eq 200) { Write-Host '    [OK] Next.js 서버 정상 작동' -ForegroundColor Green; Write-Host '        - 상태: 실행 중' -ForegroundColor White; Write-Host '        - URL: http://localhost:3000' -ForegroundColor White; exit 0 } else { Write-Host '    [경고] 비정상 응답' -ForegroundColor Yellow; exit 1 } } catch { Write-Host '    [오류] Next.js 서버 응답 없음' -ForegroundColor Red; Write-Host '        - 서버가 시작되지 않았거나 포트 3000이 사용 중입니다' -ForegroundColor Yellow; exit 2 }"

echo.
echo.

REM 포트 사용 확인
echo [3] 포트 사용 상태
netstat -ano | findstr ":3000 :5000" >nul
if %errorlevel% equ 0 (
    echo    포트 3000 또는 5000이 사용 중입니다:
    netstat -ano | findstr ":3000 :5000"
) else (
    echo    포트 3000과 5000이 모두 사용되지 않고 있습니다.
    echo    서버를 시작해야 합니다.
)

echo.
echo ========================================
echo.
echo 결과:
echo   - 두 서버가 모두 정상이면: start-servers.bat를 실행할 필요 없음
echo   - 서버가 응답 없으면: start-servers.bat를 실행하세요
echo.
echo 테스트 URL: http://localhost:3000
echo.
pause

