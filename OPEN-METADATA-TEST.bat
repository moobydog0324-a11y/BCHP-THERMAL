@echo off
chcp 65001 > nul
echo.
echo ═══════════════════════════════════════════════════════════
echo    📊 ExifTool 메타데이터 추출 테스트 페이지 열기
echo ═══════════════════════════════════════════════════════════
echo.
echo ✅ 브라우저에서 테스트 페이지를 엽니다...
echo.
echo 📌 이 테스트는:
echo    - 이미지에서 메타데이터를 추출합니다
echo    - 사람이 읽기 편한 구조로 표시합니다
echo    - ⚠️  DB에 저장하지 않습니다 (테스트 전용)
echo.
echo 📋 주요 기능:
echo    🔥 실제 측정 온도가 맨 위에 크게 표시!
echo    📍 GPS 위치 정보 바로 확인 가능
echo    📊 열화상 비교에 필수적인 정보만 상단에
echo    📂 세부 정보는 접기/펼치기 가능
echo    💻 원본 JSON도 깔끔하게 볼 수 있음
echo.

start "" "TEST-METADATA-FORMAT.html"

echo.
echo ✅ 브라우저가 열렸습니다!
echo.
echo 📋 사용 방법:
echo    1. "이미지 파일 선택" 버튼 클릭
echo    2. 열화상 이미지 선택
echo    3. 메타데이터가 카테고리별로 표시됩니다
echo.
echo ⚠️  주의: Next.js 서버가 실행 중이어야 합니다 (localhost:3000)
echo.

timeout /t 3 /nobreak > nul

