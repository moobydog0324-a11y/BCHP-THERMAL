@echo off
chcp 65001 > nul
echo.
echo ═══════════════════════════════════════════════════════════
echo    🔬 온도 데이터 안정성 테스트
echo ═══════════════════════════════════════════════════════════
echo.
echo 📌 이미지 ID 586의 메타데이터를 3번 연속 조회합니다
echo    값이 모두 같아야 정상입니다!
echo.

set "url=http://localhost:3000/api/debug/raw-metadata?image_id=586"

echo ⏳ 1차 조회...
curl -s "%url%" > test1.json
timeout /t 1 /nobreak > nul

echo ⏳ 2차 조회...
curl -s "%url%" > test2.json
timeout /t 1 /nobreak > nul

echo ⏳ 3차 조회...
curl -s "%url%" > test3.json

echo.
echo ═══════════════════════════════════════════════════════════
echo    📊 결과 비교
echo ═══════════════════════════════════════════════════════════
echo.

echo [1차 조회 결과]
type test1.json
echo.
echo.

echo [2차 조회 결과]
type test2.json
echo.
echo.

echo [3차 조회 결과]
type test3.json
echo.
echo.

echo ═══════════════════════════════════════════════════════════
echo.
echo ✅ 세 결과가 모두 같으면: DB 저장은 정상 (파싱 문제)
echo ❌ 세 결과가 다르면: DB가 계속 재저장되고 있음 (심각)
echo.
echo 💡 특히 actual_temp_stats의 min_temp, max_temp를 비교하세요
echo.

pause

del test1.json test2.json test3.json 2>nul





