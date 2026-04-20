-- ============================================
-- v4: 커스텀 KPI + 보고서 레이아웃 프리셋
-- Supabase SQL Editor에서 실행
-- ============================================

-- 1. 커스텀 KPI 항목 테이블
CREATE TABLE IF NOT EXISTS custom_kpi (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INT NOT NULL,
  branch TEXT NOT NULL,
  kpi_name TEXT NOT NULL,           -- KPI 명칭 (예: 유통사업 목표, MAU 목표)
  target_value INT NOT NULL DEFAULT 0,
  actual_value INT NOT NULL DEFAULT 0,
  unit TEXT DEFAULT '건',            -- 단위 (건, %, 원 등)
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_custom_kpi_year ON custom_kpi(year, branch);

ALTER TABLE custom_kpi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "custom_kpi_select" ON custom_kpi FOR SELECT USING (TRUE);
CREATE POLICY "custom_kpi_insert" ON custom_kpi FOR INSERT WITH CHECK (get_user_role() = 'SUPER_ADMIN');
CREATE POLICY "custom_kpi_update" ON custom_kpi FOR UPDATE USING (get_user_role() = 'SUPER_ADMIN');
CREATE POLICY "custom_kpi_delete" ON custom_kpi FOR DELETE USING (get_user_role() = 'SUPER_ADMIN');

CREATE TRIGGER trg_custom_kpi_updated
  BEFORE UPDATE ON custom_kpi FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. 보고서 레이아웃 프리셋 저장
CREATE TABLE IF NOT EXISTS report_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  preset_name TEXT NOT NULL,
  -- 섹션 순서, 표시/숨김, 뷰 모드 등 JSON으로 저장
  layout JSONB NOT NULL DEFAULT '{}',
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE report_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "presets_select" ON report_presets FOR SELECT USING (TRUE);
CREATE POLICY "presets_insert" ON report_presets FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "presets_update" ON report_presets FOR UPDATE USING (user_id = auth.uid() OR get_user_role() = 'SUPER_ADMIN');
CREATE POLICY "presets_delete" ON report_presets FOR DELETE USING (user_id = auth.uid() OR get_user_role() = 'SUPER_ADMIN');

CREATE TRIGGER trg_presets_updated
  BEFORE UPDATE ON report_presets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
