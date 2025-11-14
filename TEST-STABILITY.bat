@echo off
chcp 65001 > nul
color 0A
echo.
echo ═══════════════════════════════════════════════════════════
echo    🔬 메타데이터 안정성 테스트
echo ═══════════════════════════════════════════════════════════
echo.
echo 📌 목적: 10월 23일 이미지의 메타데이터가 일관되게 저장되어 있는지 확인
echo 📌 방법: 같은 이미지를 3번 조회해서 온도 값이 동일한지 비교
echo.
echo ⚠️  중요: 값이 다르면 재업로드가 필요합니다!
echo.

set "url=http://localhost:3000/api/debug/stability-test?section=C-1&date=2025-10-23"

echo.
echo 📌 참고: Supabase에서 직접 확인하려면
echo    1. 좌측 메뉴에서 'image_metadata' 테이블 선택
echo    2. thermal_data_json 컬럼에서 actual_temp_stats 확인
echo.

echo.
echo ⏳ [1/3] 첫 번째 조회...
curl -s "%url%" > stability_test_1.json
timeout /t 2 /nobreak > nul

echo ⏳ [2/3] 두 번째 조회...
curl -s "%url%" > stability_test_2.json
timeout /t 2 /nobreak > nul

echo ⏳ [3/3] 세 번째 조회...
curl -s "%url%" > stability_test_3.json

echo.
echo ✅ 조회 완료!
echo.
echo ═══════════════════════════════════════════════════════════
echo    📊 결과 분석
echo ═══════════════════════════════════════════════════════════
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [1차 조회 결과]
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type stability_test_1.json
echo.
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [2차 조회 결과]
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type stability_test_2.json
echo.
echo.

echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo [3차 조회 결과]
echo ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
type stability_test_3.json
echo.
echo.

echo ═══════════════════════════════════════════════════════════
echo    🎯 판정 기준
echo ═══════════════════════════════════════════════════════════
echo.
echo ✅ PASS (재업로드 불필요):
echo    - temperature_data의 min_temp, max_temp가 3번 모두 동일
echo    - metadata_timestamps의 updated_at이 created_at과 같음
echo.
echo ❌ FAIL (재업로드 필요):
echo    - temperature_data 값이 매번 다름
echo    - metadata_timestamps의 updated_at이 계속 바뀜
echo.
echo 💡 주의:
echo    - 온도 값은 소수점 둘째자리까지 정확히 일치해야 합니다
echo    - 0.01도 차이도 허용되지 않습니다
echo.

echo.
echo 📋 위 결과를 개발자에게 전달하세요
echo.
pause

del stability_test_1.json stability_test_2.json stability_test_3.json 2>nul

