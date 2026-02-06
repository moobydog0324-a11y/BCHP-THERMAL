-- ============================================================
-- Migration 00: 마이그레이션 추적 테이블 생성
-- ============================================================
-- 이 스크립트는 가장 먼저 실행되어야 합니다.
-- ============================================================

-- 마이그레이션 이력 테이블
CREATE TABLE IF NOT EXISTS schema_migrations (
  version VARCHAR(10) PRIMARY KEY,
  description TEXT NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT NOW(),
  applied_by VARCHAR(255) DEFAULT CURRENT_USER
);

COMMENT ON TABLE schema_migrations IS '데이터베이스 마이그레이션 이력';
COMMENT ON COLUMN schema_migrations.version IS '마이그레이션 버전 (예: 01, 02, 06)';
COMMENT ON COLUMN schema_migrations.description IS '마이그레이션 설명';
COMMENT ON COLUMN schema_migrations.applied_at IS '적용 시각';
COMMENT ON COLUMN schema_migrations.applied_by IS '적용한 사용자';

-- 초기 마이그레이션 기록
INSERT INTO schema_migrations (version, description) 
VALUES ('00', 'Init migrations table')
ON CONFLICT (version) DO NOTHING;

RAISE NOTICE '✅ Migration tracking table created';



