# Flask ExifTool 백엔드 서버

이미지 메타데이터 추출을 위한 Flask 백엔드 서버입니다.

## 📋 필요한 것

1. **Python 3.8 이상**
2. **ExifTool** (Windows용 exe 파일)

## 🚀 설치 방법

### 1. Python 패키지 설치

```bash
cd python-backend
pip install -r requirements.txt
```

### 2. ExifTool 다운로드

Windows용 ExifTool을 다운로드하세요:
- 다운로드: https://exiftool.org/
- `exiftool(-k).exe`를 다운받아서 `exiftool.exe`로 이름 변경
- 이 폴더(`python-backend/`)에 `exiftool.exe` 파일을 넣으세요

또는 시스템 PATH에 exiftool을 설치하세요.

### 3. 서버 실행

```bash
python app.py
```

서버가 `http://localhost:5000`에서 실행됩니다.

## 🔌 API 엔드포인트

### GET /
서버 상태 확인

### POST /analyze
단일 이미지 메타데이터 분석

**요청:**
```javascript
const formData = new FormData();
formData.append("file", imageFile);

const response = await fetch("http://localhost:5000/analyze", {
  method: "POST",
  body: formData
});
```

**응답:**
```json
{
  "success": true,
  "metadata": { ... },
  "thermal_data": {
    "Make": "FLIR",
    "Model": "T640",
    "Emissivity": 0.95,
    "ObjectDistance": 1.0,
    ...
  },
  "filename": "thermal_image.jpg"
}
```

### POST /batch-analyze
여러 이미지 일괄 분석

**요청:**
```javascript
const formData = new FormData();
files.forEach(file => formData.append("files", file));

const response = await fetch("http://localhost:5000/batch-analyze", {
  method: "POST",
  body: formData
});
```

## 🔧 테스트

서버가 실행 중인지 확인:
```bash
curl http://localhost:5000
```

이미지 분석 테스트:
```bash
curl -X POST -F "file=@test_image.jpg" http://localhost:5000/analyze
```

## 📝 주의사항

- Flask 서버와 Next.js 서버를 동시에 실행해야 합니다
- CORS가 활성화되어 있어 localhost:3000에서 접근 가능합니다
- 프로덕션 환경에서는 CORS 설정을 수정하세요


