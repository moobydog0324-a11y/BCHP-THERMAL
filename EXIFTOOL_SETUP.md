# 🔧 ExifTool 설치 및 설정 가이드

## 🚨 현재 상태

Flask 서버는 실행 중이지만 **ExifTool이 없어서 메타데이터 추출이 불가능**합니다.

```json
{
  "exiftool_available": false  ← ⚠️ 문제!
}
```

---

## 📥 ExifTool 다운로드 및 설치

### 1단계: 다운로드
```
https://exiftool.org/
```

**Windows 버전 다운로드:**
- "Windows Executable" 클릭
- `exiftool-12.XX.zip` 다운로드

### 2단계: 압축 해제
1. 다운로드한 ZIP 파일 압축 해제
2. `exiftool(-k).exe` 파일 확인

### 3단계: 파일 이름 변경 (중요!)
```
exiftool(-k).exe  →  exiftool.exe
```
**(괄호 제거!)**

### 4단계: 파일 복사
다음 폴더 중 하나에 복사:

**옵션 1: python-backend 폴더 (권장)**
```
C:\Users\GSENR\Desktop\BCHP-THERMA\python-backend\exiftool.exe
```

**옵션 2: 프로젝트 루트**
```
C:\Users\GSENR\Desktop\BCHP-THERMA\exiftool.exe
```

---

## ✅ 설치 확인

### 1. Flask 서버 재시작
```bash
# 기존 Flask 서버 종료 (Ctrl+C)
cd python-backend
python app.py
```

**기대 출력:**
```
✅ ExifTool 발견: C:\...\python-backend\exiftool.exe
Flask 서버 실행 중 (포트 5000)
```

### 2. API 테스트
```
http://localhost:5000
```

**기대 결과:**
```json
{
  "exiftool_available": true,  ← ✅ 성공!
  "message": "Flask ExifTool 서버가 실행 중입니다.",
  "status": "running"
}
```

---

## 🧪 메타데이터 추출 테스트

### 1. 업로드 페이지 접속
```
http://localhost:3000/upload
```

### 2. 파일 선택
- 열화상 이미지 선택 (DJI XT2 등)
- **F12 콘솔 확인**

**기대 출력:**
```
✅ 메타데이터 추출 성공: {GPSLatitude: "...", DateTimeOriginal: "..."}
📅 메타데이터에서 자동 추출: 2025-10-23 15:14
```

### 3. UI 확인
```
✅ EXIF 메타데이터에서 자동으로 촬영 시간을 추출했습니다
📅 2025-10-23 15:14
```

---

## 🐛 문제 해결

### Q: Flask 서버 재시작 후에도 "exiftool_available: false"
**A:**
1. `exiftool(-k).exe` → `exiftool.exe` 이름 변경 확인
2. `python-backend` 폴더에 파일이 있는지 확인
3. Flask 서버 완전히 종료 후 재시작

### Q: "ExifTool을 찾을 수 없습니다"
**A:**
```bash
# 파일 존재 확인
ls python-backend/exiftool.exe

# 없으면 다시 복사
# C:\Users\GSENR\Downloads\exiftool.exe
# → C:\Users\GSENR\Desktop\BCHP-THERMA\python-backend\
```

### Q: 메타데이터 추출은 되는데 날짜/시간이 자동 입력 안 됨
**A:**
- F12 콘솔에서 오류 확인
- 이미지 파일에 EXIF 데이터가 있는지 확인
- DJI XT2 열화상 이미지인지 확인

---

## 📋 빠른 설치 체크리스트

- [ ] ExifTool 다운로드
- [ ] `exiftool(-k).exe` → `exiftool.exe` 이름 변경
- [ ] `python-backend/` 폴더에 복사
- [ ] Flask 서버 재시작
- [ ] `http://localhost:5000` 확인 → `exiftool_available: true`
- [ ] 업로드 페이지에서 파일 선택
- [ ] 날짜/시간 자동 입력 확인
- [ ] ✅ 완료!

---

## 🎯 현재 vs 설치 후

### Before (현재):
```
파일 선택
  ↓
⚠️ 메타데이터 추출 실패
  ↓
❌ 날짜/시간 수동 입력 필요
```

### After (ExifTool 설치 후):
```
파일 선택
  ↓
✅ 메타데이터 자동 추출
  ↓
✅ 날짜/시간 자동 입력!
```

---

## 💡 참고

- ExifTool은 **무료 오픈소스**입니다
- 크기: 약 20MB
- 100개 이상의 파일 형식 지원
- GPS, 온도, 카메라 정보 등 추출

---

**지금 바로 설치하세요!** 🚀


