-- ============================================
-- v3 마이그레이션: KPI 목표 관리 + 일별 변동 추적 + 고유 컬럼
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. 연간 목표 테이블
CREATE TABLE IF NOT EXISTS branch_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  branch TEXT NOT NULL,
  target_new INT NOT NULL DEFAULT 0,          -- 신규 인입 목표
  target_open INT NOT NULL DEFAULT 0,         -- 개설 완료 목표
  target_linkage INT NOT NULL DEFAULT 0,      -- ERP 연계 목표
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  UNIQUE(year, branch)
);

ALTER TABLE branch_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "targets_select" ON branch_targets FOR SELECT
  USING (TRUE);

CREATE POLICY "targets_insert" ON branch_targets FOR INSERT
  WITH CHECK (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "targets_update" ON branch_targets FOR UPDATE
  USING (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "targets_delete" ON branch_targets FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN');

CREATE TRIGGER trg_targets_updated_at
  BEFORE UPDATE ON branch_targets FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. customers 테이블에 원본 상태 + 확장 컬럼 추가
ALTER TABLE customers ADD COLUMN IF NOT EXISTS status_original TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}';

-- 기존 데이터의 status_original을 현재 status로 채우기
UPDATE customers SET status_original = status WHERE status_original IS NULL;
