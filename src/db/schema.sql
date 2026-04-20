-- ============================================
-- 허나사업부 DB Branch 고객현황 관리 시스템
-- Supabase PostgreSQL 스키마 v1.0
-- ============================================

-- 1. 사용자 테이블 (Supabase Auth 연동)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('SUPER_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER', 'VIEWER')),
  branch TEXT CHECK (branch IN ('IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. ERP 마스터 테이블
CREATE TABLE IF NOT EXISTS erp_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_name TEXT NOT NULL,        -- 상품명
  company_name TEXT NOT NULL,        -- 업체명
  manufacturer TEXT NOT NULL,        -- 제조사
  branches TEXT[] NOT NULL DEFAULT '{}', -- 사용 브랜치 배열
  sort_order INT NOT NULL DEFAULT 0, -- 정렬 순서
  is_active BOOLEAN NOT NULL DEFAULT TRUE, -- 활성 여부
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 고객정보 메인 테이블 (27개 컬럼 + 메타)
CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch TEXT NOT NULL CHECK (branch IN ('IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch')),
  type TEXT,                          -- 유형
  product TEXT,                       -- 상품
  company_name TEXT NOT NULL,         -- 업체명
  business_number TEXT,               -- 사업자번호
  contract_date DATE,                 -- 계약일자
  business_type TEXT,                 -- 업태
  industry TEXT,                      -- 업종/주품목
  erp_type TEXT,                      -- ERP종류(상품명)
  erp_company TEXT,                   -- ERP업체
  erp_manufacturer TEXT,              -- ERP제조사(쇼룸)
  db_type TEXT,                       -- DB종류
  erp_link_date DATE,                 -- ERP연계일자
  link_method TEXT,                   -- 연계방식
  cancel_date DATE,                   -- 해지일자
  cancel_reason TEXT,                 -- 해지사유
  work_industry TEXT,                 -- 업종(작업)
  status TEXT NOT NULL CHECK (status IN ('완료', '진행', '대기', '해지')),
  open_date DATE,                     -- 개설완료일자
  consultant_main TEXT,               -- 컨설턴트(주)
  consultant_sub TEXT,                -- 컨설턴트(부)
  revenue NUMERIC,                    -- 매출액(백만)
  affiliate_count INT,                -- 계열사수
  account_count INT,                  -- 계좌수
  card_count INT,                     -- 카드수
  notes TEXT,                         -- 비고
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id),
  updated_by UUID REFERENCES users(id)
);

-- 사업자번호 브랜치 내 중복 방지 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_branch_biz_num
  ON customers (branch, business_number)
  WHERE business_number IS NOT NULL AND business_number != '';

-- 4. 삭제된 고객 이력 보관 테이블
CREATE TABLE IF NOT EXISTS customers_deleted (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id UUID NOT NULL,          -- 원본 고객 ID
  data JSONB NOT NULL,                -- 삭제 시점 전체 row 데이터
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_by UUID REFERENCES users(id)
);

-- 5. 핵심 인력 연락처 테이블
CREATE TABLE IF NOT EXISTS key_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,                  -- 관리 연도
  branch TEXT NOT NULL CHECK (branch IN ('IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch')),
  name TEXT NOT NULL,                 -- 이름
  position TEXT,                      -- 직책
  department TEXT,                    -- 부서
  phone TEXT,                         -- 연락처
  email TEXT,                         -- 이메일
  duty TEXT,                          -- 담당업무
  notes TEXT,                         -- 비고
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. VOC 이력 테이블
CREATE TABLE IF NOT EXISTS voc_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  voc_date DATE NOT NULL,             -- VOC 일자
  content TEXT NOT NULL,              -- VOC 내용
  employee_count INT,                 -- 직원수
  company_size TEXT,                  -- 기업규모
  ceo_name TEXT,                      -- 대표자명
  founded_date DATE,                  -- 설립일
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- 7. 보고서 생성 이력 테이블
CREATE TABLE IF NOT EXISTS reports_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('일간', '주간', '월간', '연간')),
  report_date DATE NOT NULL,
  branch TEXT NOT NULL,               -- 브랜치명 또는 '전체'
  file_url TEXT NOT NULL,             -- Supabase Storage 파일 URL
  file_format TEXT NOT NULL CHECK (file_format IN ('PDF', 'Excel')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_customers_branch ON customers(branch);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_contract_date ON customers(contract_date);
CREATE INDEX IF NOT EXISTS idx_customers_cancel_date ON customers(cancel_date);
CREATE INDEX IF NOT EXISTS idx_customers_erp_link_date ON customers(erp_link_date);
CREATE INDEX IF NOT EXISTS idx_key_contacts_year_branch ON key_contacts(year, branch);
CREATE INDEX IF NOT EXISTS idx_voc_history_customer ON voc_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_reports_history_type_date ON reports_history(report_type, report_date);

-- ============================================
-- updated_at 자동 갱신 트리거
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_erp_master_updated_at
  BEFORE UPDATE ON erp_master FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_key_contacts_updated_at
  BEFORE UPDATE ON key_contacts FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security (RLS) 정책
-- ============================================

-- 헬퍼 함수: 현재 사용자 역할 조회
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 헬퍼 함수: 현재 사용자 브랜치 조회
CREATE OR REPLACE FUNCTION get_user_branch()
RETURNS TEXT AS $$
  SELECT branch FROM users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- users 테이블 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select" ON users FOR SELECT
  USING (
    get_user_role() = 'SUPER_ADMIN'
    OR id = auth.uid()
  );

CREATE POLICY "users_insert" ON users FOR INSERT
  WITH CHECK (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "users_update" ON users FOR UPDATE
  USING (get_user_role() = 'SUPER_ADMIN');

CREATE POLICY "users_delete" ON users FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN');

-- customers 테이블 RLS
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT
  USING (
    get_user_role() IN ('SUPER_ADMIN', 'VIEWER')
    OR branch = get_user_branch()
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

-- erp_master 테이블 RLS
ALTER TABLE erp_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "erp_master_select" ON erp_master FOR SELECT
  USING (TRUE); -- 모든 인증 사용자 조회 가능

CREATE POLICY "erp_master_modify" ON erp_master FOR ALL
  USING (get_user_role() = 'SUPER_ADMIN');

-- key_contacts 테이블 RLS
ALTER TABLE key_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "key_contacts_select" ON key_contacts FOR SELECT
  USING (TRUE); -- 모든 인증 사용자 조회 가능

CREATE POLICY "key_contacts_insert" ON key_contacts FOR INSERT
  WITH CHECK (
    get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
  );

CREATE POLICY "key_contacts_update" ON key_contacts FOR UPDATE
  USING (
    get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN')
  );

CREATE POLICY "key_contacts_delete" ON key_contacts FOR DELETE
  USING (get_user_role() = 'SUPER_ADMIN');

-- voc_history 테이블 RLS
ALTER TABLE voc_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "voc_select" ON voc_history FOR SELECT
  USING (TRUE);

CREATE POLICY "voc_insert" ON voc_history FOR INSERT
  WITH CHECK (
    get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN', 'BRANCH_USER')
  );

-- customers_deleted 테이블 RLS
ALTER TABLE customers_deleted ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deleted_select" ON customers_deleted FOR SELECT
  USING (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

CREATE POLICY "deleted_insert" ON customers_deleted FOR INSERT
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));

-- reports_history 테이블 RLS
ALTER TABLE reports_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_select" ON reports_history FOR SELECT
  USING (TRUE);

CREATE POLICY "reports_insert" ON reports_history FOR INSERT
  WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'BRANCH_ADMIN'));
