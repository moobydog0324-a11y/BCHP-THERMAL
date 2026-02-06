# 🔧 문제 해결 가이드

## ✅ 수정 완료된 내용

### 1️⃣ Next.js 15 호환성 문제 해결
**문제:** 구역 선택 시 오류 발생  
**원인:** Next.js 15에서 동적 라우트의 `params`가 Promise로 변경됨  
**해결:**
- ✅ `/api/thermal-images/by-section/[section]/route.ts` 수정
- ✅ `/api/sections/[category]/route.ts` 수정
- ✅ 비교 페이지 React 훅 최적화

---

## 🧪 테스트 방법

### 1️⃣ 서버 상태 확인
```
http://localhost:3000/api/quick-check
```

**확인할 내용:**
```json
{
  "success": true,
  "counts": {
    "pipes": 14,          // 구역 개수
    "images": 50,         // 이미지 개수
    "inspections": 10     // 점검 개수
  },
  "health_check": {
    "has_pipes": true,
    "has_images": true,
    "metadata_extraction_working": true
  }
}
```

### 2️⃣ 비교 페이지 테스트
```
http://localhost:3000/compare
```

**테스트 순서:**
1. 구역 선택 (예: A-1)
2. 콘솔에서 오류 확인 (F12 → Console)
3. 날짜가 표시되는지 확인
4. 날짜 2개 선택
5. 이미지가 나란히 표시되는지 확인

### 3️⃣ API 직접 테스트
```
http://localhost:3000/api/thermal-images/by-section/A-1?image_type=thermal
```

**정상 응답:**
```json
{
  "success": true,
  "data": [...],
  "count": 5,
  "section": "A-1"
}
```

---

## 🐛 자주 발생하는 오류

### 오류 1: "params.section is undefined"
**증상:** 구역 선택 시 500 에러  
**원인:** Next.js 15 Promise 처리 누락  
**해결:** ✅ 이미 수정 완료

### 오류 2: "이미지를 불러오는 데 실패했습니다"
**원인:** 데이터베이스에 해당 구역의 이미지가 없음  
**확인 방법:**
```
http://localhost:3000/api/quick-check
```
**해결:**
1. `/upload` 페이지에서 이미지 업로드
2. 구역 선택 시 해당 구역 지정
3. 업로드 후 다시 비교 시도

### 오류 3: "서버와의 통신 중 오류가 발생했습니다"
**원인:** Next.js 서버 미실행 또는 DB 연결 오류  
**확인:**
```bash
# 서버 실행 확인
http://localhost:3000

# 데이터베이스 연결 확인
http://localhost:3000/api/quick-check
```
**해결:**
```bash
# Next.js 재시작
cd C:\Users\GSENR\Desktop\BCHP-THERMA
pnpm run dev
```

### 오류 4: 구역 선택했는데 날짜가 안 나옴
**원인:** 해당 구역에 이미지가 없음  
**확인:**
```
http://localhost:3000/debug
```
**해결:**
1. 디버그 페이지에서 "구역별 이미지 현황" 확인
2. 이미지가 0개인 구역은 업로드 필요
3. `/upload`에서 해당 구역에 이미지 업로드

---

## 📊 데이터베이스 직접 확인

### 구역별 이미지 개수 확인
```sql
SELECT 
  p.section_category,
  COUNT(ti.image_id) as image_count
FROM pipes p
LEFT JOIN inspections i ON p.pipe_id = i.pipe_id
LEFT JOIN thermal_images ti ON i.inspection_id = ti.inspection_id
GROUP BY p.section_category
ORDER BY p.section_category;
```

### 최근 업로드된 이미지 확인
```sql
SELECT 
  ti.image_id,
  p.section_category,
  ti.capture_timestamp,
  ti.image_type
FROM thermal_images ti
JOIN inspections i ON ti.inspection_id = i.inspection_id
JOIN pipes p ON i.pipe_id = p.pipe_id
ORDER BY ti.created_at DESC
LIMIT 10;
```

### 메타데이터 추출 확인
```sql
SELECT 
  im.image_id,
  ti.image_url,
  im.thermal_data_json->>'GPSLatitude' as gps_lat,
  im.thermal_data_json->>'GPSLongitude' as gps_lon,
  im.thermal_data_json->>'DateTimeOriginal' as capture_time
FROM image_metadata im
JOIN thermal_images ti ON im.image_id = ti.image_id
LIMIT 5;
```

---

## 🔄 완전 초기화 방법

### 1️⃣ 서버 재시작
```bash
# Terminal 1: Next.js
cd C:\Users\GSENR\Desktop\BCHP-THERMA
pnpm run dev

# Terminal 2: Flask (업로드 시에만 필요)
cd python-backend
python app.py
```

### 2️⃣ 브라우저 캐시 삭제
- Chrome: `Ctrl + Shift + Delete`
- 또는 시크릿 모드로 테스트

### 3️⃣ 데이터베이스 확인
```
http://localhost:3000/api/quick-check
```

---

## 💡 디버깅 팁

### 브라우저 콘솔 확인
1. F12 키 눌러 개발자 도구 열기
2. Console 탭 선택
3. 구역 선택 후 오류 메시지 확인
4. 빨간색 오류가 있으면 복사해서 분석

### 네트워크 탭 확인
1. F12 → Network 탭
2. "Clear" 버튼 클릭
3. 구역 선택
4. `/api/thermal-images/by-section/` 요청 찾기
5. Status가 200인지 확인
6. Response 탭에서 데이터 확인

### 서버 로그 확인
```bash
# Next.js 서버 실행 중인 터미널 확인
# 구역 선택 시 다음과 같은 로그 출력되어야 함:
구역별 이미지 조회 - 구역: A-1, 타입: thermal, 메타데이터: false
조회 결과: 5개 이미지
```

---

## 🎯 정상 작동 확인 체크리스트

- [ ] `/api/quick-check` 응답 정상
- [ ] `has_pipes: true`
- [ ] `has_images: true`
- [ ] `/compare` 페이지 로드됨
- [ ] 구역 선택 시 오류 없음
- [ ] 날짜 목록이 표시됨
- [ ] 날짜 2개 선택 가능
- [ ] 이미지가 나란히 표시됨
- [ ] 콘솔에 오류 없음

---

## 📞 추가 지원

### 1단계: 빠른 확인
```
http://localhost:3000/api/quick-check
```

### 2단계: 디버그 페이지
```
http://localhost:3000/debug
```

### 3단계: 서버 로그 확인
- Next.js 터미널 로그
- Flask 터미널 로그 (업로드 시)

### 4단계: 브라우저 콘솔
- F12 → Console
- 빨간색 오류 확인

---

## ✅ 현재 상태

- ✅ Next.js 15 호환성 수정 완료
- ✅ 동적 라우트 Promise 처리 완료
- ✅ React 훅 최적화 완료
- ✅ 린트 오류 없음
- ✅ 빠른 확인 API 추가

**이제 정상 작동할 것입니다!** 🎉

테스트 후 문제가 있으면:
1. `/api/quick-check` 결과 확인
2. 브라우저 콘솔 오류 확인
3. 서버 로그 확인


