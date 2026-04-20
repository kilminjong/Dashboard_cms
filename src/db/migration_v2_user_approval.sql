-- ============================================
-- v2 마이그레이션: 사용자 승인 시스템 + 접근 로그
-- Supabase SQL Editor에서 실행
-- ============================================

-- ============================================
-- 1. 브랜치 CHECK 제약 조건 업데이트 (농협, IMBANK 추가)
-- ============================================

-- users 테이블 브랜치 제약 조건 변경
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_branch_check;
ALTER TABLE users ADD CONSTRAINT users_branch_check
  CHECK (branch IN ('IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch', 'NH', 'IMBANK'));

-- customers 테이블 브랜치 제약 조건 변경
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_branch_check;
ALTER TABLE customers ADD CONSTRAINT customers_branch_check
  CHECK (branch IN ('IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch', 'NH', 'IMBANK'));

-- key_contacts 테이블 브랜치 제약 조건 변경
ALTER TABLE key_contacts DROP CONSTRAINT IF EXISTS key_contacts_branch_check;
ALTER TABLE key_contacts ADD CONSTRAINT key_contacts_branch_check
  CHECK (branch IN ('IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch', 'NH', 'IMBANK'));

-- ============================================
-- 2. users 테이블 컬럼 추가
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'PENDING'
  CHECK (status IN ('PENDING', 'ACTIVE', 'REJECTED', 'SUSPENDED'));

ALTER TABLE users ADD COLUMN IF NOT EXISTS position TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS rejected_reason TEXT;

-- 기존 관리자 계정을 ACTIVE로 업데이트
UPDATE users SET status = 'ACTIVE' WHERE role = 'SUPER_ADMIN';

-- ============================================
-- 3. 접근 로그 테이블 생성
-- ============================================

CREATE TABLE IF NOT EXISTS access_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  branch TEXT,
  action_type TEXT NOT NULL,
  -- 액션 유형: LOGIN, CUSTOMER_CREATE, CUSTOMER_UPDATE, CUSTOMER_DELETE,
  --           REPORT_GENERATE, USER_APPROVE, USER_REJECT, ERP_MODIFY, VOC_CREATE
  target_description TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_access_logs_branch ON access_logs(branch);

-- ============================================
-- 4. RLS 정책 전면 재설정
-- ============================================

-- 기존 정책 삭제
DROP POLICY IF EXISTS "users_select" ON users;
DROP POLICY IF EXISTS "users_insert" ON users;
DROP POLICY IF EXISTS "users_update" ON users;
DROP POLICY IF EXISTS "users_delete" ON users;
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;
DROP POLICY IF EXISTS "erp_master_select" ON erp_master;
DROP POLICY IF EXISTS "erp_master_modify" ON erp_master;
DROP POLICY IF EXISTS "key_contacts_select" ON key_contacts;
DROP POLICY IF EXISTS "key_contacts_insert" ON key_contacts;
DROP POLICY IF EXISTS "key_contacts_update" ON key_contacts;
DROP POLICY IF EXISTS "key_contacts_delete" ON key_contacts;
DROP POLICY IF EXISTS "voc_select" ON voc_history;
DROP POLICY IF EXISTS "voc_insert" ON voc_history;
DROP POLICY IF EXISTS "deleted_select" ON customers_deleted;
DROP POLICY IF EXISTS "deleted_insert" ON customers_deleted;
DROP POLICY IF EXISTS "reports_select" ON reports_history;
DROP POLICY IF EXISTS "reports_insert" ON reports_history;

-- 헬퍼 함수 재정의 (ACTIVE 체크 추가)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid() AND status = 'ACTIVE';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_branch()
RETURNS TEXT AS $$
  SELECT branch FROM users WHERE id = auth.uid() AND status = 'ACTIVE';
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_status()
RETURNS TEXT AS $$
  SELECT status FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ---- users 테이블 RLS ----
CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    get_user_role() = 'SUPER_ADMIN'
    OR id = auth.uid()
  );

-- 회원가입 시 자기 자신의 프로필 등록 허용
CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (
    id = auth.uid()
    OR get_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "users_delete" ON users FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN');

-- ---- customers 테이블 RLS (ACTIVE만 접근) ----
CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (
    get_user_role() IN ('SUPER_ADMIN', 'VIEWER')
    OR (get_user_role() IS NOT NULL AND branch = get_user_branch())
  );

CREATE POLICY "customers_insert" ON customers FOR INSERT
  WITH CHECK (
    get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER')
    AND (get_user_role() = 'SUPER_ADMIN' OR branch = get_user_branch())
  );

CREATE POLICY "customers_update" ON customers FOR UPDATE
  USING (
    get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER')
    AND (get_user_role() = 'SUPER_ADMIN' OR branch = get_user_branch())
  );

CREATE POLICY "customers_delete" ON customers FOR DELETE
  USING (
    get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
    AND (get_user_role() = 'SUPER_ADMIN' OR branch = get_user_branch())
  );

-- ---- erp_master 테이블 RLS ----
CREATE POLICY "erp_master_select" ON erp_master FOR SELECT
  USING (get_user_role() IS NOT NULL);

CREATE POLICY "erp_master_insert" ON erp_master FOR INSERT
  WITH CHECK (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "erp_master_update" ON erp_master FOR UPDATE
  USING (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "erp_master_delete" ON erp_master FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN');

-- ---- key_contacts 테이블 RLS ----
CREATE POLICY "key_contacts_select" ON key_contacts FOR SELECT
  USING (get_user_role() IS NOT NULL);

CREATE POLICY "key_contacts_insert" ON key_contacts FOR INSERT
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

CREATE POLICY "key_contacts_update" ON key_contacts FOR UPDATE
  USING (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

CREATE POLICY "key_contacts_delete" ON key_contacts FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN');

-- ---- voc_history 테이블 RLS ----
CREATE POLICY "voc_select" ON voc_history FOR SELECT
  USING (get_user_role() IS NOT NULL);

CREATE POLICY "voc_insert" ON voc_history FOR INSERT
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER'));

-- ---- customers_deleted 테이블 RLS ----
CREATE POLICY "deleted_select" ON customers_deleted FOR SELECT
  USING (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

CREATE POLICY "deleted_insert" ON customers_deleted FOR INSERT
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

-- ---- reports_history 테이블 RLS ----
CREATE POLICY "reports_select" ON reports_history FOR SELECT
  USING (get_user_role() IS NOT NULL);

CREATE POLICY "reports_insert" ON reports_history FOR INSERT
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

-- ---- access_logs 테이블 RLS ----
ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "logs_select" ON access_logs FOR SELECT
  USING (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "logs_insert" ON access_logs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
