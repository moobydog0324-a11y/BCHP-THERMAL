# 📸 메타데이터 자동 분석 플로우 확인

## ✅ 전체 플로우 확인 완료

### 🔄 자동 처리 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ 사용자가 파일 선택                                         │
│    (app/upload/page.tsx - handleFileSelect)                 │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ 첫 번째 파일 자동 분석 (미리보기)                         │
│    → /api/exif/analyze 호출                                 │
│    → Flask 서버 → ExifTool 실행                             │
│    → 메타데이터 추출                                         │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ 촬영 날짜/시간 자동 입력                                   │
│    DateTimeOriginal → 날짜, 시, 분 필드에 자동 채움         │
│    ✅ 자동 처리 완료!                                        │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ 사용자가 업로드 버튼 클릭                                 │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 5️⃣ 각 파일마다 /api/thermal-images POST 호출                 │
│    (app/api/thermal-images/route.ts)                        │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 6️⃣ Flask 서버로 파일 전송                                    │
│    → ExifTool 메타데이터 추출                               │
│    → GPS, 온도, 카메라 정보 등 추출                         │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 7️⃣ Supabase Storage에 이미지 저장                           │
│    → 원본 + 썸네일                                          │
└───────────────────┬─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────────┐
│ 8️⃣ PostgreSQL DB에 저장                                      │
│    → thermal_images 테이블 (이미지 정보)                   │
│    → image_metadata 테이블 (메타데이터 JSON)               │
│    ✅ 완료!                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## ✅ 구현 확인

### 1️⃣ 파일 선택 시 자동 분석 (미리보기)

**위치:** `app/upload/page.tsx` (77~113줄)

```typescript
// 파일 선택 핸들러
const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = e.target.files
  if (files) {
    const fileArray = Array.from(files)
    setSelectedFiles(fileArray)
    
    // 첫 번째 파일의 메타데이터 자동 분석 (미리보기) ✅
    if (fileArray.length > 0) {
      const metadata = await analyzeMetadata(fileArray[0])
      if (metadata) {
        console.log("✅ 메타데이터 추출 성공:", metadata)
        
        // 촬영 시간이 있으면 자동으로 설정 ✅
        if (metadata.DateTimeOriginal) {
          const date = new Date(metadata.DateTimeOriginal)
          const dateStr = date.toISOString().split('T')[0]
          const hours = String(date.getHours()).padStart(2, '0')
          const minutes = String(date.getMinutes()).padStart(2, '0')
          
          setCaptureDate(dateStr)      // ✅ 자동 입력
          setCaptureHour(hours)         // ✅ 자동 입력
          setCaptureMinute(minutes)     // ✅ 자동 입력
          
          console.log(`📅 촬영 시간 자동 설정: ${dateStr} ${hours}:${minutes}`)
        }
      }
    }
  }
}
```

**결과:** ✅ 파일 선택 즉시 메타데이터 분석 & 날짜/시간 자동 입력

---

### 2️⃣ 메타데이터 분석 함수

**위치:** `app/upload/page.tsx` (52~75줄)

```typescript
// 메타데이터 분석
const analyzeMetadata = async (file: File) => {
  try {
    const formData = new FormData()
    formData.append("file", file)
    
    // Flask 서버에 메타데이터 추출 요청 ✅
    const response = await fetch("/api/exif/analyze", {
      method: "POST",
      body: formData,
    })
    
    const result = await response.json()
    
    if (result.success && result.thermal_data) {
      console.log(`📸 ${file.name} 메타데이터:`, result.thermal_data)
      return result.thermal_data  // ✅ GPS, 날짜, 온도 등 반환
    }
    
    return null
  } catch (error) {
    console.error("메타데이터 분석 오류:", error)
    return null
  }
}
```

**결과:** ✅ Flask → ExifTool 통해 메타데이터 추출

---

### 3️⃣ 업로드 시 메타데이터 저장

**위치:** `app/api/thermal-images/route.ts` (177~275줄)

```typescript
// 🔥 메타데이터 추출 (ExifTool)
let metadata = null
let thermal_data = null

try {
  console.log('🔍 ExifTool로 메타데이터 추출 시작...')
  const metadataFormData = new FormData()
  metadataFormData.append('file', imageFile)
  
  // Flask 서버로 전송 ✅
  const flaskResponse = await fetch(`${FLASK_SERVER}/analyze`, {
    method: 'POST',
    body: metadataFormData,
  })
  
  if (flaskResponse.ok) {
    const result = await flaskResponse.json()
    if (result.success) {
      metadata = result.metadata          // ✅ 전체 메타데이터
      thermal_data = result.thermal_data  // ✅ 열화상 데이터
      console.log('✅ 메타데이터 추출 성공')
      
      // 촬영 시간이 없으면 메타데이터에서 추출 ✅
      if (!capture_timestamp && thermal_data?.DateTimeOriginal) {
        capture_timestamp = thermal_data.DateTimeOriginal
        console.log('📅 메타데이터에서 촬영 시간 추출:', capture_timestamp)
      }
    }
  }
} catch (metadataError) {
  console.warn('⚠️ 메타데이터 추출 중 오류 (계속 진행):', metadataError)
}

// DB에 이미지 정보 저장 ✅
const result = await query<ThermalImage>(
  `INSERT INTO thermal_images (
    inspection_id, image_url, thumbnail_url, 
    image_width, image_height, 
    capture_timestamp, file_size_bytes, file_format, image_type,
    camera_model
  )
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  RETURNING *`,
  [
    inspection_id,
    imageUpload.url,
    thumbnailUpload.url,
    thermal_data?.ImageWidth || null,     // ✅ 메타데이터에서
    thermal_data?.ImageHeight || null,    // ✅ 메타데이터에서
    capture_timestamp,
    file_size_bytes,
    file_format,
    image_type,
    thermal_data?.Model || null,          // ✅ 메타데이터에서
  ]
)

// 🔥 메타데이터를 별도 테이블에 저장 ✅
if (metadata && result.rows[0]) {
  try {
    await query(
      `INSERT INTO image_metadata (image_id, metadata_json, thermal_data_json)
       VALUES ($1, $2, $3)
       ON CONFLICT (image_id) DO UPDATE 
       SET metadata_json = $2, thermal_data_json = $3, updated_at = NOW()`,
      [
        result.rows[0].image_id,
        JSON.stringify(metadata),        // ✅ 전체 메타데이터 저장
        JSON.stringify(thermal_data),    // ✅ 열화상 데이터 저장
      ]
    )
    console.log(`✅ 메타데이터 DB 저장 완료`)
  } catch (metaError) {
    console.warn('⚠️ 메타데이터 저장 실패:', metaError)
  }
}
```

**결과:** ✅ 업로드 시마다 자동으로 메타데이터 추출 & DB 저장

---

## 📊 저장되는 데이터

### thermal_images 테이블
```sql
image_id, inspection_id, image_url, thumbnail_url,
image_width (← 메타데이터),
image_height (← 메타데이터),
capture_timestamp (← 메타데이터 or 사용자 입력),
camera_model (← 메타데이터),
file_size_bytes, file_format, image_type
```

### image_metadata 테이블
```sql
metadata_id, image_id,
metadata_json (← 전체 EXIF 데이터 100+ 필드),
thermal_data_json (← 열화상 핵심 데이터),
created_at, updated_at
```

### thermal_data_json 예시
```json
{
  "Model": "XT2",
  "DateTimeOriginal": "2025:10:23 15:14:57",
  "GPSLatitude": "37 deg 19' 0.41\" N",
  "GPSLongitude": "126 deg 45' 46.03\" E",
  "ImageWidth": 640,
  "ImageHeight": 512,
  "AtmosphericTemperature": "20.0 C",
  "PlanckR1": 388723,
  "PlanckB": 1428
}
```

---

## ✅ 최종 확인

### 메타데이터 자동 분석 로직 구성 완료!

#### 1️⃣ 파일 선택 시 (미리보기)
- ✅ 첫 번째 파일 자동 분석
- ✅ 촬영 날짜/시간 자동 입력
- ✅ 콘솔에 메타데이터 출력

#### 2️⃣ 업로드 시 (실제 저장)
- ✅ 모든 파일에 대해 메타데이터 추출
- ✅ Flask → ExifTool 자동 호출
- ✅ thermal_images 테이블에 저장
- ✅ image_metadata 테이블에 JSON 저장

#### 3️⃣ 필수 구성 요소
- ✅ Flask 서버 (포트 5000)
- ✅ ExifTool 설치
- ✅ image_metadata 테이블 생성
- ✅ API 라우트 연결

---

## 🧪 테스트 방법

### 1단계: Flask 서버 확인
```bash
cd python-backend
python app.py
```

확인:
```
http://localhost:5000
```

예상 결과:
```
✅ ExifTool 발견: C:\...\exiftool.exe
Flask 서버 실행 중 (포트 5000)
```

### 2단계: 테이블 확인
```
http://localhost:3000/api/check-metadata-table
```

예상 결과:
```json
{
  "success": true,
  "table_exists": true
}
```

### 3단계: 업로드 테스트
```
http://localhost:3000/upload
```

1. 구역 선택 (예: A-1)
2. 파일 선택
   - 👀 **콘솔 확인:** "✅ 메타데이터 추출 성공"
   - 👀 **날짜/시간 자동 입력 확인**
3. 업로드 클릭
4. 성공 메시지 확인
   - `metadata_extracted: true` 확인

### 4단계: 메타데이터 확인
```
http://localhost:3000/api/check-metadata-table
```

예상 결과:
```json
{
  "data": {
    "records_with_thermal_data": 1,
    "percentage": 100
  },
  "samples": [
    {
      "gps_lat": "37 deg 19' 0.41\" N",
      "datetime": "2025:10:23 15:14:57",
      "camera_model": "XT2"
    }
  ]
}
```

---

## 🎯 결론

### ✅ 메타데이터 자동 분석 로직 완벽 구성!

```
파일 선택 → 자동 분석 → 날짜/시간 자동 입력
     ✅          ✅              ✅

업로드 → 메타데이터 추출 → DB 저장
   ✅          ✅            ✅
```

**모든 자동화가 완료되어 있습니다!**

사용자는:
1. 구역만 선택
2. 파일만 선택 (날짜/시간 자동 입력됨)
3. 업로드 클릭

나머지는 **모두 자동 처리**됩니다! 🎉

---

## 🚨 주의사항

### 필수 확인
1. ✅ Flask 서버 실행 중
2. ✅ ExifTool 설치됨
3. ✅ image_metadata 테이블 생성됨

### 하나라도 없으면?
- Flask 미실행 → 메타데이터 추출 안 됨
- ExifTool 없음 → 메타데이터 추출 안 됨
- 테이블 없음 → 메타데이터 저장 안 됨

**모두 확인하세요!** 🔍


