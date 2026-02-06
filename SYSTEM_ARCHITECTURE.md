# 🏗️ BCHP-THERMA 시스템 아키텍처

## 📊 전체 데이터 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                         1. 이미지 업로드                          │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
                    ┌────────────────────────┐
                    │  POST /api/thermal-    │
                    │       images           │
                    └────────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
                    ▼                         ▼
        ┌──────────────────┐      ┌──────────────────┐
        │ Supabase Storage │      │ Flask Server     │
        │  이미지 저장      │      │ /analyze         │
        └──────────────────┘      │ 메타데이터 추출  │
                    │              └──────────────────┘
                    │                         │
                    │                         ▼
                    │              ┌──────────────────┐
                    │              │ metadata_json    │
                    │              │ thermal_data_json│
                    │              └──────────────────┘
                    │                         │
                    └──────────┬──────────────┘
                               ▼
                    ┌─────────────────────┐
                    │   PostgreSQL DB     │
                    ├─────────────────────┤
                    │ thermal_images      │ ← 기본 정보
                    │ image_metadata      │ ← 메타데이터
                    └─────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       2. 데이터 조회 & 표시                       │
└─────────────────────────────────────────────────────────────────┘

Frontend Pages                  APIs                       Database
─────────────────────────────────────────────────────────────────

┌──────────────┐                                      
│ /data        │ ──GET──▶ /api/thermal-images/       
│ 데이터 관리   │           by-section/[section]      
└──────────────┘                │                     
                                ▼                     
┌──────────────┐         ┌─────────────┐             
│ /compare     │ ──GET──▶│  JOIN:      │────▶ thermal_images
│ 비교 분석     │         │  - thermal_ │       + 
└──────────────┘         │    images   │      image_metadata
                         │  - image_   │             
┌──────────────┐         │    metadata │      ┌──────────────┐
│ /thermal-    │ ──GET──▶│  - pipes    │ ────▶│ metadata_json│
│  analysis    │         │  - inspec-  │      │ thermal_data │
│ 열화상 분석   │         │    tions    │      └──────────────┘
└──────────────┘         └─────────────┘             
                                │                     
┌──────────────┐                │                     
│ /exif-test   │ ──POST─▶ Flask /analyze (직접)      
│ EXIF 테스트  │                                      
└──────────────┘                                      

## 📋 데이터베이스 스키마

### thermal_images (기본 이미지 정보)
```sql
- image_id (PK)
- inspection_id (FK)
- image_url
- thumbnail_url
- camera_model
- capture_timestamp
- image_type (thermal/real)
- file_size_bytes
- ...
```

### image_metadata (메타데이터 저장)
```sql
- metadata_id (PK)
- image_id (FK, UNIQUE)
- metadata_json (JSONB) ← 전체 EXIF 메타데이터
  └─ GPSLatitude, GPSLongitude, GPSAltitude
  └─ Camera 정보 (Model, Lens, etc.)
  └─ 촬영 설정 (ISO, Shutter, etc.)
- thermal_data_json (JSONB) ← 열화상 특화 데이터
  └─ actual_temp_stats (실제 온도 통계)
     ├─ min_temp
     ├─ max_temp
     ├─ avg_temp
     └─ median_temp
  └─ AtmosphericTemperature
  └─ Emissivity
  └─ PlanckR1, PlanckB, PlanckF, etc.
- file_hash
- created_at, updated_at
```

## 🔄 메타데이터 흐름

### 업로드 시 (정상 케이스)
1. ✅ 사용자가 이미지 업로드
2. ✅ Flask 서버가 `metadata_json` + `thermal_data_json` 추출
3. ✅ `image_metadata` 테이블에 **둘 다** 저장
4. ✅ 모든 페이지에서 메타데이터 사용 가능

### 기존 이미지 (문제 케이스)
1. ❌ 과거에 업로드된 이미지
2. ❌ `metadata_json`이 **비어있음** (NULL)
3. ❌ `thermal_data_json`만 있음 (배치 업데이트로 추가)
4. ⚠️ GPS, 카메라 정보 등 표시 안 됨

## 🛠️ 해결 방법

### 배치 업데이트 API 수정 완료
```typescript
// app/api/batch-update-temperatures/route.ts
INSERT INTO image_metadata (
  image_id, 
  metadata_json,        // ← 추가됨!
  thermal_data_json,
  created_at, 
  updated_at
)
VALUES ($1, $2, $3, NOW(), NOW())
ON CONFLICT (image_id) 
DO UPDATE SET 
  metadata_json = $2,     // ← 업데이트됨!
  thermal_data_json = $3,
  updated_at = NOW()
```

### 실행 방법
1. http://localhost:3000/data 접속
2. "🔥 온도 데이터 재추출" 버튼 클릭
3. 자동으로 모든 이미지 처리
4. `metadata_json` 포함하여 재저장

## 📑 각 페이지별 메타데이터 사용

### /data (데이터 관리)
- **사용 메타데이터**: 
  - `thermal_data_json.actual_temp_stats` (온도)
  - `metadata_json.GPSLatitude/Longitude` (GPS)
- **표시 항목**: 이미지 목록, 온도 범위, 섹션별 통계

### /compare (비교 분석)
- **사용 메타데이터**: 
  - `metadata_json` (GPS, 카메라 정보)
  - `thermal_data_json.actual_temp_stats` (온도)
- **표시 항목**: GPS 그룹별 시계열 비교, 메타데이터 펼쳐보기

### /thermal-analysis (열화상 분석)
- **사용 메타데이터**: 
  - `thermal_data_json` (온도 데이터)
- **표시 항목**: 섹션/날짜별 필터링, 온도 시각화

### /exif-test (EXIF 테스트)
- **사용 메타데이터**: 
  - Flask에서 직접 추출 (DB 조회 안 함)
- **표시 항목**: 전체 메타데이터 상세 보기

## ✅ 점검 체크리스트

- [x] 업로드 API: `metadata_json` + `thermal_data_json` 저장
- [x] 배치 업데이트 API: 둘 다 저장하도록 수정
- [ ] 배치 업데이트 실행: 기존 이미지 메타데이터 복구
- [ ] `/data` 페이지: 메타데이터 정상 표시 확인
- [ ] `/compare` 페이지: GPS 정상 표시 확인
- [ ] 전체 시스템 테스트





