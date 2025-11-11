# 🔥 반월 열병합 열배관 관리시스템

열화상 이미지 기반 배관 상태 모니터링 및 시계열 비교 분석 시스템

---

## 🎯 핵심 기능

### 간단한 3단계 워크플로우

```
1. 📤 이미지 업로드 → 2. 📊 자동 비교분석 → 3. ✅ 온도 변화 확인
```

### 주요 기능
- ✅ **자동 메타데이터 추출** - GPS, 온도, 시간 자동 저장
- ✅ **GPS 기반 매칭** - 같은 위치의 이미지 자동 그룹핑
- ✅ **시계열 비교** - 날짜별 온도 변화 추적
- ✅ **간단한 UI** - 클릭 몇 번으로 분석 완료

---

## 🚀 빠른 시작

### 1️⃣ 서버 시작

```bash
# Terminal 1: Next.js 프론트엔드
cd C:\Users\GSENR\Desktop\BCHP-THERMA
pnpm run dev

# Terminal 2: Flask 백엔드 (메타데이터 추출용)
cd python-backend
python app.py
```

### 2️⃣ 접속

- **메인**: http://localhost:3000
- **업로드**: http://localhost:3000/upload
- **비교분석**: http://localhost:3000/compare

---

## 📖 사용 방법

### 📤 이미지 업로드
1. "열화상 이미지" 선택
2. 구역 선택 (A-1 ~ G-2)
3. 파일 선택 (다중 선택 가능)
4. 업로드 클릭
   - **자동으로 GPS, 온도, 시간 추출**

### 📊 비교분석
1. 구역 선택
2. 비교할 날짜 2개 선택
3. 자동으로 나란히 비교 표시
   - **GPS 좌표 기반 자동 매칭**

---

## 🏗️ 시스템 구조

```
📁 BCHP-THERMA/
├── 📁 app/                    # Next.js 프론트엔드
│   ├── 📁 upload/            # 업로드 페이지
│   ├── 📁 compare/           # 비교분석 페이지 (통합)
│   ├── 📁 api/               # API 라우트
│   │   ├── thermal-images/  # 이미지 CRUD
│   │   └── exif/            # 메타데이터 추출
│   └── ...
│
├── 📁 python-backend/         # Flask 백엔드 (ExifTool)
│   ├── app.py               # Flask 서버
│   ├── requirements.txt     # Python 패키지
│   └── exiftool.exe         # 메타데이터 추출 도구
│
├── 📁 scripts/                # 데이터베이스 스크립트
│   ├── 01-create-tables.sql
│   ├── 05-add-metadata-table.sql
│   └── ...
│
└── 📄 SIMPLE_USER_GUIDE.md   # 📖 간단 사용 가이드
```

---

## 🔧 설치

### 필수 요구사항
- Node.js 18+
- Python 3.8+
- PostgreSQL 12+
- ExifTool

### 1. Next.js 설정
```bash
cd C:\Users\GSENR\Desktop\BCHP-THERMA
pnpm install
```

### 2. Flask 설정
```bash
cd python-backend
pip install -r requirements.txt
```

### 3. ExifTool 설치
1. https://exiftool.org/ 다운로드
2. `exiftool.exe`를 `python-backend/` 폴더에 복사

### 4. 데이터베이스 설정

`.env.local` 파일 생성:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/therma_twin"
NEXT_PUBLIC_SUPABASE_URL="your-supabase-url"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

스크립트 실행:
```bash
psql -U postgres -d therma_twin -f scripts/01-create-tables.sql
psql -U postgres -d therma_twin -f scripts/05-add-metadata-table.sql
```

---

## 🎨 주요 페이지

### 📤 업로드 (`/upload`)
- 구역별 이미지 업로드
- 자동 메타데이터 추출
- 업로드 후 즉시 분석 가능

### 📊 비교분석 (`/compare`)
- 구역별 이미지 조회
- 날짜별 나란히 비교
- GPS 자동 매칭
- 온도 정보 표시

### 🐛 디버그 (`/debug`) - 개발자용
- 데이터베이스 상태 확인
- 업로드된 이미지 통계
- 문제 진단 및 해결

---

## 🔥 핵심 기술

### 자동화
- **ExifTool** - 메타데이터 자동 추출
- **GPS 매칭** - 좌표 기반 자동 그룹핑
- **시계열 분석** - 날짜별 자동 정리

### 스택
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Flask (Python), Next.js API Routes
- **Database**: PostgreSQL, Supabase Storage
- **Tools**: ExifTool, DJI Thermal SDK

---

## 📚 문서

- **[📖 간단 사용 가이드](SIMPLE_USER_GUIDE.md)** - 3단계 워크플로우
- **[📋 메타데이터 가이드](METADATA_GUIDE.md)** - 자동 추출 시스템
- **[📍 GPS 비교 가이드](GPS_COMPARE_GUIDE.md)** - GPS 기반 매칭

---

## 🎯 설계 철학

### 단순함 우선
- ✅ 핵심 기능만 제공
- ✅ 자동화 최대한 활용
- ✅ 클릭 최소화

### 사용자 중심
- ✅ 직관적인 3단계 워크플로우
- ✅ 즉각적인 피드백
- ✅ 명확한 안내

### 개발자 친화
- ✅ 개발 도구 숨김 처리
- ✅ 디버그 페이지 분리
- ✅ 상세한 로그

---

## 🆘 문제 해결

### 서버 연결 오류
```bash
# Next.js 확인
http://localhost:3000

# Flask 확인
http://localhost:5000
```

### 메타데이터 추출 안 됨
1. Flask 서버 실행 중인지 확인
2. ExifTool 설치 확인
3. `/exif-test` 페이지에서 테스트

### 이미지가 비교에 안 나옴
1. `/debug` 페이지에서 데이터 확인
2. 구역(section_category) 설정 확인
3. 메타데이터 테이블 생성 확인

---

## 🎉 시작하기

1. **서버 시작** (위 참조)
2. **업로드**: http://localhost:3000/upload
3. **비교**: http://localhost:3000/compare

**간단합니다! 3단계면 끝!** 🚀

---

## 📞 지원

문제가 있으면:
1. `/debug` 페이지에서 상태 확인
2. `SIMPLE_USER_GUIDE.md` 참고
3. 서버 로그 확인

---

**Made with ❤️ for 반월 열병합**
