-- BAP밥 배관망관리앱 통합 마이그레이션
-- 기존 pipes 테이블은 수정하지 않음 (열화상 분석 기능 보호)

-- 1. users 테이블 (인증/권한)
CREATE TABLE IF NOT EXISTS users (
  user_id      SERIAL PRIMARY KEY,
  email        VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name         VARCHAR(100) NOT NULL,
  role         VARCHAR(20) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active    BOOLEAN DEFAULT TRUE,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 2. markers 테이블 (맨홀/밸브/센서 등 설비 - BAP marker 시트)
CREATE TABLE IF NOT EXISTS markers (
  marker_id    SERIAL PRIMARY KEY,
  tag_number   VARCHAR(100) UNIQUE NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  spec         VARCHAR(100),
  marker_type  VARCHAR(20) NOT NULL
    CHECK (marker_type IN ('맨홀','밸브','센서','수용가','레듀서','기타')),
  construction_history TEXT,
  construction_link    TEXT,
  is_maintenance       BOOLEAN DEFAULT FALSE,
  maintenance_notes    TEXT,
  is_interest          BOOLEAN DEFAULT FALSE,
  special_notes        TEXT,
  steam_open           VARCHAR(50),
  pipe_asset           VARCHAR(100),
  contact_info         VARCHAR(200),
  self_boiler          VARCHAR(100),
  nav_address          TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_markers_type ON markers(marker_type);
CREATE INDEX IF NOT EXISTS idx_markers_maintenance ON markers(is_maintenance) WHERE is_maintenance = TRUE;
CREATE INDEX IF NOT EXISTS idx_markers_interest ON markers(is_interest) WHERE is_interest = TRUE;
CREATE INDEX IF NOT EXISTS idx_markers_geo ON markers(lat, lng);

-- 3. bap_pipes 테이블 (BAP 배관 라인 - BAP pipe 시트)
CREATE TABLE IF NOT EXISTS bap_pipes (
  bap_pipe_id  SERIAL PRIMARY KEY,
  pipe_tag     VARCHAR(100) UNIQUE NOT NULL,
  lat1         DOUBLE PRECISION NOT NULL,
  lng1         DOUBLE PRECISION NOT NULL,
  lat2         DOUBLE PRECISION NOT NULL,
  lng2         DOUBLE PRECISION NOT NULL,
  color        VARCHAR(20),
  thickness    REAL DEFAULT 1.5,
  spec         VARCHAR(100),
  depth        VARCHAR(50),
  category     VARCHAR(50),
  culvert      VARCHAR(50),
  construction_history TEXT,
  construction_link    TEXT,
  is_maintenance       BOOLEAN DEFAULT FALSE,
  maintenance_notes    TEXT,
  is_interest          BOOLEAN DEFAULT FALSE,
  special_notes        TEXT,
  replacement_year     INTEGER,
  pipe_id      INTEGER REFERENCES pipes(pipe_id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bap_pipes_maintenance ON bap_pipes(is_maintenance) WHERE is_maintenance = TRUE;
CREATE INDEX IF NOT EXISTS idx_bap_pipes_interest ON bap_pipes(is_interest) WHERE is_interest = TRUE;
CREATE INDEX IF NOT EXISTS idx_bap_pipes_year ON bap_pipes(replacement_year);
CREATE INDEX IF NOT EXISTS idx_bap_pipes_category ON bap_pipes(category);

-- 4. gps_photos 테이블 (GPS 현장 사진 - BAP gpsPic 시트)
CREATE TABLE IF NOT EXISTS gps_photos (
  photo_id     SERIAL PRIMARY KEY,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  image_url    TEXT NOT NULL,
  description  TEXT,
  overlay_bounds JSONB,
  taken_at     TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_photos_geo ON gps_photos(lat, lng);

-- 5. reports 테이블 (대시보드 보고서 - BAP report 시트)
CREATE TABLE IF NOT EXISTS reports (
  report_id    SERIAL PRIMARY KEY,
  title        VARCHAR(200) NOT NULL,
  report_type  VARCHAR(50),
  report_data  JSONB,
  created_by   INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- 6. sync_log 테이블 (Google Sheets 동기화 이력)
CREATE TABLE IF NOT EXISTS sync_log (
  sync_id      SERIAL PRIMARY KEY,
  direction    VARCHAR(20) NOT NULL CHECK (direction IN ('to_sheets', 'from_sheets')),
  sheet_name   VARCHAR(50) NOT NULL,
  rows_synced  INTEGER DEFAULT 0,
  status       VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  started_at   TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- updated_at 자동 업데이트 트리거 함수
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 적용
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_updated_at') THEN
    CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_markers_updated_at') THEN
    CREATE TRIGGER trg_markers_updated_at BEFORE UPDATE ON markers
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_bap_pipes_updated_at') THEN
    CREATE TRIGGER trg_bap_pipes_updated_at BEFORE UPDATE ON bap_pipes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_reports_updated_at') THEN
    CREATE TRIGGER trg_reports_updated_at BEFORE UPDATE ON reports
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- 마이그레이션 기록
INSERT INTO schema_migrations (version, description)
VALUES ('007', 'BAP밥 배관망관리앱 통합 - users, markers, bap_pipes, gps_photos, reports, sync_log 테이블 생성')
ON CONFLICT (version) DO NOTHING;
