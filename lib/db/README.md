# 데이터베이스 설정 가이드

## 📊 현재 상태

현재 프로젝트에 `.env.local` 파일이 생성되었습니다.

## 🗄️ 데이터베이스 옵션

### 옵션 1: 로컬 PostgreSQL (개발용 권장)

**설정 방법:**

1. PostgreSQL 설치 (아직 설치하지 않았다면)
   - Windows: https://www.postgresql.org/download/windows/
   - 또는 Docker 사용: `docker run --name therma-postgres -e POSTGRES_PASSWORD=password -p 5432:5432 -d postgres`

2. 데이터베이스 생성:
   ```sql
   CREATE DATABASE therma_twin;
   ```

3. `.env.local` 파일 수정:
   ```
   DATABASE_URL="postgresql://postgres:password@localhost:5432/therma_twin"
   ```

4. 스키마 생성:
   ```bash
   # PostgreSQL에 접속
   psql -U postgres -d therma_twin
   
   # 그리고 scripts/01-create-tables.sql 실행
   # scripts/02-seed-sample-data.sql 실행
   ```

### 옵션 2: Vercel Postgres (프로덕션 권장)

**설정 방법:**

1. Vercel 대시보드 접속: https://vercel.com
2. Storage → Create Database → Postgres 선택
3. 생성된 데이터베이스 연결 정보를 `.env.local`에 복사:
   ```
   POSTGRES_URL="postgres://default:xxxxx@xxxxx.postgres.vercel-storage.com:5432/verceldb"
   POSTGRES_PRISMA_URL="postgres://default:xxxxx@xxxxx.postgres.vercel-storage.com:5432/verceldb?pgbouncer=true&connect_timeout=15"
   POSTGRES_URL_NON_POOLING="postgres://default:xxxxx@xxxxx.postgres.vercel-storage.com:5432/verceldb"
   ```

### 옵션 3: Supabase (무료 티어 사용 가능)

**설정 방법:**

1. Supabase 접속: https://supabase.com
2. 새 프로젝트 생성
3. Settings → Database에서 연결 문자열 복사
4. `.env.local` 파일 수정:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```

## 🚀 테이블 생성 및 샘플 데이터

데이터베이스를 설정한 후, 다음 스크립트를 순서대로 실행하세요:

1. **테이블 생성**: `scripts/01-create-tables.sql`
   - 6개 핵심 테이블 생성 (pipes, inspections, thermal_images, etc.)

2. **샘플 데이터**: `scripts/02-seed-sample-data.sql`
   - 반월공단 A동, B동 샘플 배관 4개
   - 샘플 점검 기록 5개

## 📝 현재 `.env.local` 기본 설정

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/therma_twin"
```

위 설정은 로컬 PostgreSQL 기본값입니다. 실제 환경에 맞게 수정하세요.

## ✅ 연결 확인

데이터베이스 연결을 확인하려면:

1. 개발 서버 재시작: `pnpm dev`
2. 데이터베이스 연결 관련 에러가 없는지 확인

## 🔧 다음 단계

데이터베이스를 설정한 후에는 다음을 구현해야 합니다:

- [ ] DB 연결 유틸리티 함수 (`lib/db/connection.ts`)
- [ ] API Routes (`app/api/`)
- [ ] 데이터 페칭 함수들

