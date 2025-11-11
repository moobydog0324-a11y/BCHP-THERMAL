# 🚀 Flask + ExifTool 설정 가이드

## ⚠️ ExifTool이 필요합니다!

Flask 서버가 시작되었지만, **ExifTool**이 없으면 이미지 메타데이터를 추출할 수 없습니다.

## 📥 ExifTool 다운로드 및 설치

### 방법 1: 이 폴더에 설치 (권장)

1. **ExifTool 다운로드**
   - 공식 사이트: https://exiftool.org/
   - Windows용: **"Windows Executable"** 클릭
   - `exiftool-12.XX.zip` 파일 다운로드

2. **압축 해제**
   - 다운로드한 ZIP 파일 압축 해제
   - `exiftool(-k).exe` 파일을 찾으세요

3. **파일 이름 변경**
   ```
   exiftool(-k).exe  →  exiftool.exe
   ```

4. **이 폴더에 복사**
   ```
   C:\Users\GSENR\Desktop\BCHP-THERMA\python-backend\exiftool.exe
   ```

5. **서버 재시작**
   - 현재 실행 중인 Flask 서버 종료 (Ctrl+C)
   - 다시 시작: `python app.py`

### 방법 2: 시스템 PATH에 설치

1. ExifTool 다운로드 (위와 동일)
2. `exiftool.exe`를 `C:\Windows\System32\` 폴더에 복사
3. 또는 원하는 폴더에 넣고 시스템 PATH에 추가

## ✅ 설치 확인

### 터미널에서 확인:
```bash
exiftool -ver
```

출력 예시:
```
12.70
```

### Flask 서버 로그 확인:
서버 시작 시 다음 메시지가 보이면 성공:
```
✅ ExifTool 발견: C:\Users\...\python-backend\exiftool.exe
🚀 Flask 서버 시작...
```

### 웹에서 확인:
1. 브라우저 열기
2. `http://localhost:3000/exif-test` 접속
3. **"Flask 상태 확인"** 버튼 클릭
4. `exiftool_available: true` 확인

## 🧪 테스트

1. 열화상 이미지 준비 (JPG, PNG, TIFF)
2. ExifTool 테스트 페이지에서 업로드
3. 메타데이터가 표시되는지 확인

## ❓ 문제 해결

### "ExifTool을 찾을 수 없습니다" 오류

**증상:**
```
⚠️ 경고: exiftool.exe를 찾을 수 없습니다.
```

**해결:**
1. `exiftool.exe` 파일이 `python-backend/` 폴더에 있는지 확인
2. 파일 이름이 정확히 `exiftool.exe`인지 확인 (확장자 포함)
3. 서버 재시작

### Flask 서버 연결 실패

**증상:**
```
Flask 서버에 연결할 수 없습니다.
```

**해결:**
1. Flask 서버가 실행 중인지 확인:
   ```bash
   # 터미널에서
   cd python-backend
   python app.py
   ```

2. 포트 5000이 사용 중인지 확인:
   ```bash
   netstat -ano | findstr :5000
   ```

3. 방화벽에서 포트 5000 허용

### CORS 오류

**증상:**
```
Access to fetch at 'http://localhost:5000' has been blocked by CORS policy
```

**해결:**
- Flask 서버를 재시작하세요
- `flask-cors`가 설치되어 있는지 확인:
  ```bash
  pip install flask-cors
  ```

## 📂 최종 폴더 구조

```
python-backend/
├── app.py              ✅ Flask 서버
├── requirements.txt    ✅ Python 패키지 목록
├── exiftool.exe       ⚠️ 이 파일을 다운로드해야 함!
├── SETUP.md           📖 이 파일
└── README.md          📖 사용 설명서
```

## 🎯 다음 단계

1. ✅ Python 패키지 설치 완료
2. ⚠️ **ExifTool 다운로드 및 설치** ← 지금 여기!
3. ✅ Flask 서버 실행
4. ✅ Next.js 서버 실행
5. 🧪 테스트 페이지에서 확인

## 📞 지원

문제가 계속되면:
1. Flask 서버 로그 확인
2. 브라우저 콘솔 (F12) 확인
3. ExifTool 버전 확인: `exiftool -ver`


