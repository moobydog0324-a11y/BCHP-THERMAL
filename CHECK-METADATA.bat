@echo off
chcp 65001 > nul
echo.
echo ═══════════════════════════════════════════════════════════
echo    🔍 원본 메타데이터 검증 (이미지 ID: 586)
echo ═══════════════════════════════════════════════════════════
echo.
echo 📌 이 검사는 DB에 저장된 원본 메타데이터를 확인합니다
echo    (값이 계속 바뀌면 안됩니다!)
echo.
echo ⏳ 확인 중...
echo.

curl -s "http://localhost:3000/api/debug/raw-metadata?image_id=586" > temp_metadata.json

if %errorlevel% equ 0 (
    echo ✅ 메타데이터 조회 완료!
    echo.
    echo ═══════════════════════════════════════════════════════════
    type temp_metadata.json
    echo.
    echo ═══════════════════════════════════════════════════════════
    echo.
    echo 📋 결과가 위에 표시되었습니다
    echo.
    echo ⚠️  주의사항:
    echo    1. actual_temp_stats 값을 기록해두세요
    echo    2. 이 배치 파일을 다시 실행해서 값이 동일한지 확인하세요
    echo    3. GPSAltitude와 GPSAltitudeRef 값을 확인하세요
    echo.
    del temp_metadata.json
) else (
    echo ❌ 오류: 서버가 실행 중인지 확인하세요
    echo    http://localhost:3000
)

echo.
pause





