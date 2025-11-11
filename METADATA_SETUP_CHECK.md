# 📋 메타데이터 DB 설정 확인 가이드

## ✅ 현재 상태

### 코드 구현 상태
- ✅ **메타데이터 추출 로직** - `/api/thermal-images` POST에 구현됨
- ✅ **DB 저장 로직** - `image_metadata` 테이블에 자동 저장
- ✅ **SQL 스크립트** - `scripts/05-add-metadata-table.sql` 준비됨
- ✅ **Flask 백엔드** - ExifTool 연동 완료

### 동작 흐름
```
1. 이미지 업로드
   ↓
2. Flask 서버로 전송 → ExifTool 메타데이터 추출
   ↓
3. thermal_images 테이블에 이미지 정보 저장
   ↓
4. image_metadata 테이블에 메타데이터 JSON 저장 ✅
   ↓
5. 완료!
```

---

## 🔍 DB 테이블 생성 확인

### 방법 1: API로 확인 (추천!)

**서버가 실행 중이면:**
```
http://localhost:3000/api/check-metadata-table
```

**예상 결과 (정상):**
```json
{
  "success": true,
  "table_exists": true,
  "data": {
    "total_records": 10,
    "records_with_thermal_data": 10,
    "percentage": 100
  },
  "status": {
    "ready": true,
    "has_data": true,
    "metadata_extraction_working": true
  }
}
```

**예상 결과 (테이블 없음):**
```json
{
  "success": false,
  "table_exists": false,
  "message": "image_metadata 테이블이 생성되지 않았습니다.",
  "action_needed": "05-add-metadata-table.sql 스크립트를 실행해야 합니다."
}
```

---

## 🛠️ 테이블 생성 방법

### ✅ 방법 1: SQL 스크립트 직접 실행 (권장)

**파일 위치:**
```
C:\Users\GSENR\Desktop\BCHP-THERMA\scripts\05-add-metadata-table.sql
```

**실행 방법:**

#### 옵션 A: pgAdmin 사용
1. pgAdmin 실행
2. `therma_twin` 데이터베이스 선택
3. Tools → Query Tool
4. `05-add-metadata-table.sql` 파일 열기
5. ▶️ Execute 클릭

#### 옵션 B: DBeaver 사용
1. DBeaver 실행
2. `therma_twin` 데이터베이스 연결
3. SQL Editor 열기 (Ctrl+])
4. `05-add-metadata-table.sql` 내용 복사 붙여넣기
5. Execute (Ctrl+Enter)

#### 옵션 C: SQL 직접 실행
```sql
-- 이미지 메타데이터 저장 테이블
CREATE TABLE IF NOT EXISTS image_metadata (
    metadata_id SERIAL PRIMARY KEY,
    image_id INTEGER UNIQUE NOT NULL REFERENCES thermal_images(image_id) ON DELETE CASCADE,
    metadata_json JSONB,
    thermal_data_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_image_metadata_image ON image_metadata(image_id);
CREATE INDEX IF NOT EXISTS idx_metadata_json ON image_metadata USING gin(metadata_json);
CREATE INDEX IF NOT EXISTS idx_thermal_data_json ON image_metadata USING gin(thermal_data_json);
```

---

## 🧪 테스트 방법

### 1단계: 테이블 확인
```
http://localhost:3000/api/check-metadata-table
```

### 2단계: 이미지 업로드 테스트
1. Flask 서버 실행 확인
   ```
   http://localhost:5000
   ```
   
2. 이미지 업로드
   ```
   http://localhost:3000/upload
   ```

3. 업로드 후 응답 확인
   ```json
   {
     "success": true,
     "metadata_extracted": true,  // ← 이게 true여야 함!
     "thermal_data": {
       "GPSLatitude": "37 deg 19' 0.41\" N",
       "GPSLongitude": "126 deg 45' 46.03\" E",
       "DateTimeOriginal": "2025:10:23 15:14:57",
       ...
     }
   }
   ```

### 3단계: 메타데이터 저장 확인
```
http://localhost:3000/api/check-metadata-table
```

**확인 사항:**
- `records_with_thermal_data` > 0
- `percentage` = 100%
- `samples` 배열에 GPS, 날짜 등 정보 표시

---

## 📊 저장되는 데이터

### thermal_data_json에 저장되는 주요 정보:

```json
{
  "Model": "XT2",
  "CameraModel": "XT2",
  "DateTimeOriginal": "2025:10:23 15:14:57.727+08:00",
  "GPSLatitude": "37 deg 19' 0.41\" N",
  "GPSLongitude": "126 deg 45' 46.03\" E",
  "GPSPosition": "37 deg 19' 0.41\" N, 126 deg 45' 46.03\" E",
  "ImageWidth": 640,
  "ImageHeight": 512,
  "AtmosphericTemperature": "20.0 C",
  "Emissivity": 1,
  "PlanckR1": 388723,
  "PlanckB": 1428,
  "PlanckF": 1,
  "PlanckO": -162,
  "PlanckR2": 1
}
```

### metadata_json에 저장되는 정보:
- 위 데이터 + 100개 이상의 추가 EXIF 필드
- 카메라 설정, 렌즈 정보, 파일 정보 등

---

## 🔧 문제 해결

### Q: "테이블이 생성되지 않았습니다" 오류
**A:** SQL 스크립트 실행 필요
1. pgAdmin 또는 DBeaver로 `therma_twin` 접속
2. `scripts/05-add-metadata-table.sql` 실행
3. 다시 확인: `http://localhost:3000/api/check-metadata-table`

### Q: "metadata_extracted: false" 나옴
**A:** Flask 서버 미실행
1. Flask 서버 시작
   ```bash
   cd python-backend
   python app.py
   ```
2. 서버 확인
   ```
   http://localhost:5000
   ```
3. 다시 이미지 업로드

### Q: 메타데이터가 null로 저장됨
**A:** ExifTool 미설치 또는 Flask 서버 오류
1. Flask 서버 로그 확인
2. ExifTool 경로 확인
3. `/exif-test` 페이지에서 테스트

---

## ✅ 정상 작동 체크리스트

- [ ] `/api/check-metadata-table` → `table_exists: true`
- [ ] Flask 서버 실행 중 (`http://localhost:5000`)
- [ ] ExifTool 설치 확인 (Flask 로그에 ✅ ExifTool 발견)
- [ ] 이미지 업로드 시 `metadata_extracted: true`
- [ ] `/api/check-metadata-table` → `records_with_thermal_data > 0`
- [ ] GPS, 날짜 정보가 샘플에 표시됨

---

## 🎯 요약

### 구현된 기능
✅ 이미지 업로드 시 자동 메타데이터 추출  
✅ `image_metadata` 테이블에 JSON 형태로 저장  
✅ GPS 좌표, 촬영 시간, 카메라 정보, 온도 데이터 등 저장  
✅ 조회 API에서 메타데이터 함께 가져오기 지원  

### 필요한 작업
1. **테이블 생성 확인**
   ```
   http://localhost:3000/api/check-metadata-table
   ```

2. **테이블 없으면 생성**
   - pgAdmin/DBeaver로 `05-add-metadata-table.sql` 실행

3. **테스트**
   - 이미지 업로드
   - 메타데이터 확인

---

## 🚀 지금 바로 확인하세요!

```
http://localhost:3000/api/check-metadata-table
```

이 API를 호출하면 모든 상태를 한 번에 확인할 수 있습니다! 🎉


