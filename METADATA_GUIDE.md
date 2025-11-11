# 🔥 메타데이터 자동 저장 시스템

## ✅ 완료된 기능

### 1️⃣ **업로드 시 메타데이터 자동 추출**
- ExifTool로 이미지에서 모든 메타데이터 추출
- 촬영 시간, GPS, 온도, 카메라 정보 등 자동 추출
- DB에 JSON 형태로 저장

### 2️⃣ **조회 시 ExifTool 불필요**
- 한 번 업로드하면 메타데이터가 DB에 저장됨
- 이후 조회 시 DB에서 바로 가져옴
- Flask 서버 없이도 조회 가능!

---

## 🚀 사용 방법

### 📤 이미지 업로드 (메타데이터 자동 추출)

```javascript
// 클라이언트에서 업로드
const formData = new FormData();
formData.append('inspection_id', inspectionId);
formData.append('image_type', 'thermal');
formData.append('image_file', file);
formData.append('capture_timestamp', timestamp); // 선택사항 (없으면 메타데이터에서 추출)

const response = await fetch('/api/thermal-images', {
  method: 'POST',
  body: formData
});

const result = await response.json();
// result.metadata_extracted: true면 메타데이터 추출 성공
// result.thermal_data: 주요 온도 데이터
```

### 🔍 이미지 조회 (메타데이터 포함)

```javascript
// 메타데이터 포함해서 조회
const response = await fetch('/api/thermal-images?with_metadata=true');
const data = await response.json();

// data.data[0].thermal_data_json: 온도 정보
// data.data[0].metadata_json: 전체 EXIF 데이터
```

### 📍 구역별 조회 (메타데이터 포함)

```javascript
// 특정 구역의 이미지 + 메타데이터
const response = await fetch('/api/thermal-images/by-section/A-1?with_metadata=true&image_type=thermal');
const data = await response.json();
```

---

## 🗄️ 데이터베이스 설정

### 필수: 메타데이터 테이블 생성

**방법 1: SQL 직접 실행**

PostgreSQL에 접속 후:
```sql
-- scripts/05-add-metadata-table.sql 내용 실행
CREATE TABLE IF NOT EXISTS image_metadata (
    metadata_id SERIAL PRIMARY KEY,
    image_id INTEGER UNIQUE NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    metadata_json JSONB,
    thermal_data_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_image_metadata_image ON image_metadata(image_id);
CREATE INDEX IF NOT EXISTS idx_metadata_json ON image_metadata USING gin(metadata_json);
CREATE INDEX IF NOT EXISTS idx_thermal_data_json ON image_metadata USING gin(thermal_data_json);
```

**방법 2: psql 명령어**
```bash
psql -U postgres -d therma_twin -f scripts/05-add-metadata-table.sql
```

---

## 📊 저장되는 데이터

### thermal_images 테이블
```sql
- image_id
- inspection_id
- image_url
- thumbnail_url
- image_width (메타데이터에서 자동)
- image_height (메타데이터에서 자동)
- capture_timestamp (메타데이터에서 자동 추출 가능)
- camera_model (메타데이터에서 자동)
- ...
```

### image_metadata 테이블 (새로 추가)
```sql
- metadata_id
- image_id
- metadata_json (전체 EXIF 데이터)
- thermal_data_json (주요 온도 데이터)
```

### thermal_data_json 예시
```json
{
  "Make": "DJI",
  "Model": "XT2",
  "DateTimeOriginal": "2025:10:23 15:14:57",
  "AtmosphericTemperature": "20.0 C",
  "CameraTemperatureRangeMax": "135.0 C",
  "CameraTemperatureRangeMin": "-25.0 C",
  "Emissivity": 1,
  "GPSPosition": "37 deg 19' 0.41\" N, 126 deg 45' 46.03\" E",
  "PlanckR1": 388723,
  "PlanckB": 1428,
  ...
}
```

---

## 🔍 메타데이터 검색

JSONB 타입이라 SQL로 직접 검색 가능!

### 특정 카메라 모델 찾기
```sql
SELECT ti.*, im.thermal_data_json
FROM thermal_images ti
JOIN image_metadata im ON ti.image_id = im.image_id
WHERE im.thermal_data_json->>'Model' = 'XT2';
```

### 온도 범위로 찾기
```sql
SELECT *
FROM image_metadata
WHERE (thermal_data_json->>'AtmosphericTemperature')::text LIKE '%20.0%';
```

### GPS 위치로 찾기
```sql
SELECT *
FROM image_metadata
WHERE thermal_data_json->>'GPSPosition' IS NOT NULL;
```

---

## ⚡ 성능 최적화

### 장점
1. **업로드 시 한 번만** ExifTool 실행
2. **조회 시 DB에서 바로** 가져옴 (매우 빠름!)
3. **JSONB 인덱스**로 빠른 검색
4. **Flask 서버 없이도** 메타데이터 조회 가능

### 주의사항
- 메타데이터는 약 50-100KB (JSON 형태)
- 이미지가 많으면 DB 용량 증가
- 필요한 경우 metadata_json (전체 데이터) 제거하고 thermal_data_json만 유지 가능

---

## 🧪 테스트

### 1. 업로드 테스트
```
http://localhost:3000/upload
```
- 이미지 선택
- 업로드 후 콘솔에서 `metadata_extracted: true` 확인

### 2. 조회 테스트
```
http://localhost:3000/api/thermal-images?with_metadata=true
```
- `thermal_data_json` 필드 확인

### 3. 온도 분석 페이지
```
http://localhost:3000/thermal-analysis
```
- 메타데이터가 있는 이미지 표시
- 온도 정보, GPS, 카메라 모델 확인

---

## 🎯 API 엔드포인트

| 엔드포인트 | 메서드 | 설명 |
|----------|--------|------|
| `/api/thermal-images` | GET | 이미지 조회 (`?with_metadata=true`) |
| `/api/thermal-images` | POST | 이미지 업로드 (메타데이터 자동 추출) |
| `/api/thermal-images/by-section/[section]` | GET | 구역별 조회 (`?with_metadata=true`) |
| `/api/exif/analyze` | POST | ExifTool로 메타데이터만 추출 |

---

## 📝 다음 단계

1. ✅ 메타데이터 테이블 생성 (`05-add-metadata-table.sql`)
2. ✅ 업로드 API 수정 완료
3. ✅ 조회 API 수정 완료
4. 🔄 실제 이미지로 테스트
5. 📊 온도 데이터 시각화

---

## 🐛 문제 해결

### Q: 메타데이터가 저장되지 않아요
A: 
1. `image_metadata` 테이블이 생성되었는지 확인
2. Flask 서버가 실행 중인지 확인
3. 업로드 후 터미널에서 "메타데이터 추출 성공" 로그 확인

### Q: 메타데이터 조회가 안 돼요
A: `?with_metadata=true` 쿼리 파라미터 추가했는지 확인

### Q: Flask 서버 없이도 되나요?
A: 
- **업로드 시**: Flask 필요 (메타데이터 추출용)
- **조회 시**: Flask 불필요 (DB에서 바로 가져옴)

---

완료! 🎉 이제 메타데이터가 자동으로 저장됩니다!


