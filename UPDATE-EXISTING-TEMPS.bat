@echo off
chcp 65001 > nul
echo.
echo ============================================================
echo 🔄 기존 이미지 실제 온도 데이터 재추출
echo ============================================================
echo.
echo ⚠️  주의: Flask 서버가 실행 중이어야 합니다!
echo.
pause

cd python-backend
python update_existing_temps.py
cd ..

echo.
pause

