@echo off
chcp 65001 > nul
echo.
echo ═══════════════════════════════════════════════════════════
echo    🔍 DB에 실제 저장된 메타데이터 확인
echo ═══════════════════════════════════════════════════════════
echo.
echo 📌 이 테스트는 10월 23일 이미지가 DB에 제대로 저장되었는지 확인합니다
echo.

echo ⏳ 이미지 ID 636의 DB 저장 데이터 확인 중...
curl -s "http://localhost:3000/api/debug/raw-metadata?image_id=636" > db_check_636.json

echo ⏳ 이미지 ID 637의 DB 저장 데이터 확인 중...
curl -s "http://localhost:3000/api/debug/raw-metadata?image_id=637" > db_check_637.json

echo.
echo ✅ 조회 완료!
echo.
echo ═══════════════════════════════════════════════════════════
echo    📊 이미지 ID 636 (10월 23일)
echo ═══════════════════════════════════════════════════════════
type db_check_636.json
echo.
echo.

echo ═══════════════════════════════════════════════════════════
echo    📊 이미지 ID 637 (10월 23일)
echo ═══════════════════════════════════════════════════════════
type db_check_637.json
echo.
echo.

echo ═══════════════════════════════════════════════════════════
echo    🎯 확인 사항
echo ═══════════════════════════════════════════════════════════
echo.
echo ✅ 정상:
echo    - "has_thermal_data": true
echo    - "temperature_data"에 actual_temp_stats가 있음
echo    - metadata_created_at과 metadata_updated_at이 같음
echo.
echo ❌ 문제:
echo    - "has_thermal_data": false
echo    - "temperature_data": null
echo    - metadata_updated_at이 created_at보다 나중
echo.
echo 💡 문제가 있으면:
echo    1. 업로드 로직이 DB에 저장을 안 함
echo    2. 또는 프론트엔드가 DB 대신 Flask를 직접 호출
echo.

pause

del db_check_636.json db_check_637.json 2>nul





