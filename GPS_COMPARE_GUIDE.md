# 📍 GPS 기반 시계열 이미지 비교 가이드

## ✨ 핵심 기능

동일한 GPS 위치에서 **서로 다른 날짜**에 촬영된 열화상 이미지를 자동으로 매칭하고 비교합니다!

### 왜 GPS 기반 비교인가요?

배관 시스템을 점검할 때:
1. 📍 **정확히 같은 위치**에서 촬영해야 의미있는 온도 비교 가능
2. 📅 **시간대별 변화**를 추적하여 이상 징후 조기 발견
3. 🎯 **자동 매칭**으로 수작업 비교 불필요

---

## 🚀 사용 방법

### 1️⃣ 페이지 접속

```
http://localhost:3000/gps-compare
```

### 2️⃣ 구역 선택
- A-1 ~ G-2 중 선택
- 해당 구역의 모든 GPS 위치 표시

### 3️⃣ 촬영 위치 선택
- 좌측 패널에서 GPS 위치 클릭
- 각 위치마다 촬영된 이미지 개수 표시
- 첫 촬영일 ~ 최근 촬영일 표시

### 4️⃣ 날짜 선택
- 비교할 날짜 2개 선택
- 같은 GPS 좌표의 서로 다른 날짜 이미지 비교

---

## 🔧 작동 원리

### GPS 좌표 매칭

```javascript
// 1. 이미지 업로드 시 GPS 정보 자동 추출
{
  "GPSLatitude": "37 deg 19' 0.41\" N",
  "GPSLongitude": "126 deg 45' 46.03\" E",
  "GPSPosition": "37 deg 19' 0.41\" N, 126 deg 45' 46.03\" E"
}

// 2. 십진수 좌표로 변환
{
  "latitude": 37.31678,
  "longitude": 126.76279
}

// 3. 허용 오차 범위 내의 이미지 매칭 (기본 5m)
const latTolerance = 5 / 111000  // 위도 오차
const lonTolerance = 5 / (111000 * cos(lat))  // 경도 오차
```

### 거리 계산

대략적으로:
- **위도 1도** ≈ 111km
- **경도 1도** ≈ 111km × cos(위도)
- **허용 오차 5m** = 위치 오차를 고려한 실용적 범위

---

## 📊 API 사용법

### 1. GPS 위치 목록 조회

```javascript
GET /api/thermal-images/by-gps-location?section=A-1

// 응답:
{
  "success": true,
  "count": 3,
  "locations": [
    {
      "section_category": "A-1",
      "gps_position": "37 deg 19' 0.41\" N, 126 deg 45' 46.03\" E",
      "latitude_decimal": 37.31678,
      "longitude_decimal": 126.76279,
      "image_count": 15,
      "first_capture": "2025-10-23T15:14:57",
      "last_capture": "2025-11-10T10:30:00"
    },
    ...
  ]
}
```

### 2. 특정 위치의 시계열 이미지 조회

```javascript
POST /api/thermal-images/by-gps-location

Body:
{
  "section": "A-1",
  "latitude": 37.31678,
  "longitude": 126.76279,
  "tolerance": 5  // 미터 단위
}

// 응답:
{
  "success": true,
  "location": {
    "latitude": 37.31678,
    "longitude": 126.76279,
    "section": "A-1",
    "tolerance_meters": 5
  },
  "total_matches": 15,
  "dates": ["2025-10-23", "2025-10-25", "2025-11-10"],
  "grouped_by_date": {
    "2025-10-23": [
      {
        "image_id": 1,
        "image_url": "...",
        "capture_timestamp": "2025-10-23T15:14:57",
        "thermal_data_json": {
          "AtmosphericTemperature": "20.0 C",
          "GPSPosition": "37 deg 19' 0.41\" N, 126 deg 45' 46.03\" E",
          ...
        }
      },
      ...
    ],
    "2025-11-10": [...]
  }
}
```

---

## 🎯 실제 사용 시나리오

### 시나리오 1: 정기 점검
```
1주차: A-1 구역 특정 위치 촬영 (10월 23일)
2주차: 같은 위치에서 재촬영 (10월 30일)
3주차: 같은 위치에서 재촬영 (11월 6일)

→ GPS 비교 페이지에서 자동으로 매칭됨
→ 온도 변화 추이 확인 가능
```

### 시나리오 2: 이상 감지
```
10월 23일: 정상 온도 (20°C)
11월 10일: 온도 상승 (35°C)

→ 같은 위치의 이미지를 비교하여 정확한 온도 변화 확인
→ 배관 이상 징후 조기 발견
```

---

## ⚙️ 설정

### 허용 오차 조정

기본값: **5미터**

더 정밀한 매칭이 필요하면:
```javascript
// API 호출 시 tolerance 조정
{
  "tolerance": 2  // 2미터 허용 오차 (더 엄격)
}
```

더 넓은 범위가 필요하면:
```javascript
{
  "tolerance": 10  // 10미터 허용 오차 (더 관대)
}
```

---

## 📝 필수 조건

### 1. 메타데이터 테이블 생성
```sql
-- scripts/05-add-metadata-table.sql 실행
CREATE TABLE IF NOT EXISTS image_metadata ...
```

### 2. GPS 정보 포함된 이미지 업로드
- DJI XT2 등 GPS 기능이 있는 열화상 카메라 사용
- 업로드 시 ExifTool이 자동으로 GPS 추출
- `thermal_data_json`에 GPS 좌표 저장

### 3. Flask 서버 실행 (업로드 시에만 필요)
- 메타데이터 추출용
- 조회 시에는 불필요 (DB에서 바로 가져옴)

---

## 🔍 GPS 데이터 예시

### DJI XT2에서 추출되는 GPS 정보

```json
{
  "GPSLatitude": "37 deg 19' 0.41\" N",
  "GPSLatitudeRef": "North",
  "GPSLongitude": "126 deg 45' 46.03\" E",
  "GPSLongitudeRef": "East",
  "GPSAltitude": "-15.6 m Above Sea Level",
  "GPSPosition": "37 deg 19' 0.41\" N, 126 deg 45' 46.03\" E",
  "AbsoluteAltitude": -15.626266,
  "RelativeAltitude": 59.900002,
  "GimbalPitchDegree": -90,
  "GimbalYawDegree": -69.900002
}
```

### 변환된 십진수 좌표
```javascript
{
  latitude: 37.316780,   // 37°19'0.41"N
  longitude: 126.762786  // 126°45'46.03"E
}
```

---

## 💡 활용 팁

### 1. 정기 점검 루틴
- 매주 같은 시간, 같은 위치에서 촬영
- 드론 GPS 자동 기록 활용
- 시계열 데이터 축적

### 2. 이상 감지
- 온도가 급격히 변한 위치 찾기
- 같은 위치의 과거 데이터와 비교
- 추세 분석

### 3. 보고서 작성
- GPS 위치별로 그룹핑
- 시간대별 변화 그래프
- 이상 구간 하이라이트

---

## 🐛 문제 해결

### Q: GPS 위치가 표시되지 않아요
A: 
1. 이미지에 GPS 정보가 있는지 확인 (ExifTool 테스트 페이지)
2. `image_metadata` 테이블이 생성되었는지 확인
3. 메타데이터가 저장되었는지 확인

### Q: 매칭되는 이미지가 없어요
A:
1. 허용 오차(tolerance)를 늘려보세요 (5m → 10m)
2. 실제로 같은 위치에서 촬영했는지 확인
3. GPS 좌표가 정확한지 확인

### Q: 좌표가 이상하게 나와요
A:
- DMS(도분초) 형식이 정확한지 확인
- `parseDMS()` 함수가 제대로 작동하는지 확인
- 콘솔에서 `latitude_decimal` 값 확인

---

## 📍 지도 연동 (향후 개선)

### TODO: 지도에 GPS 위치 표시
```javascript
// Google Maps 또는 Kakao Maps API 사용
import { GoogleMap } from 'google-maps-react'

<GoogleMap
  center={{ lat: 37.31678, lng: 126.76279 }}
  markers={locations.map(loc => ({
    position: { lat: loc.latitude_decimal, lng: loc.longitude_decimal },
    count: loc.image_count
  }))}
/>
```

---

## ✅ 완료!

이제 GPS 좌표 기반으로 **동일한 위치의 시계열 이미지**를 자동으로 비교할 수 있습니다! 🎉

**테스트:** `http://localhost:3000/gps-compare`


