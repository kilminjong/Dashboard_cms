import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

export type ViewMode = 'card' | 'table' | 'chart'

export interface SectionConfig {
  id: string
  label: string
  visible: boolean
  viewMode: ViewMode
  availableViews: ViewMode[]
}

// 기본 섹션 구성
const DEFAULT_SECTIONS: SectionConfig[] = [
  { id: 'summary', label: '경영진 요약', visible: true, viewMode: 'card', availableViews: ['card'] },
  { id: 'alerts', label: '위험/긍정 신호', visible: true, viewMode: 'card', availableViews: ['card'] },
  { id: 'kpi', label: '핵심 KPI', visible: true, viewMode: 'card', availableViews: ['card', 'table'] },
  { id: 'matrix', label: '브랜치별 매트릭스', visible: true, viewMode: 'table', availableViews: ['table'] },
  { id: 'charts', label: 'KPI 달성 추이', visible: true, viewMode: 'chart', availableViews: ['chart'] },
  { id: 'customKpi', label: '커스텀 KPI', visible: true, viewMode: 'table', availableViews: ['card', 'table'] },
  { id: 'consultants', label: '컨설턴트 실적 순위', visible: false, viewMode: 'table', availableViews: ['table'] },
  { id: 'manufacturers', label: 'ERP 제조사별 현황', visible: false, viewMode: 'table', availableViews: ['table'] },
  { id: 'customers', label: '신규/해지 고객 상세', visible: false, viewMode: 'table', availableViews: ['table'] },
]

interface ReportLayoutState {
  sections: SectionConfig[]
  presetName: string
  // 섹션 순서 변경
  reorderSections: (fromIndex: number, toIndex: number) => void
  // 섹션 표시/숨김
  toggleSection: (id: string) => void
  // 뷰 모드 변경
  changeViewMode: (id: string, mode: ViewMode) => void
  // 프리셋 저장/불러오기
  savePreset: (name: string, userId: string) => Promise<void>
  loadPreset: (presetId: string) => Promise<void>
  loadDefaultOrSaved: (userId: string) => Promise<void>
  // 초기화
  resetToDefault: () => void
}

export const useReportLayoutStore = create<ReportLayoutState>((set, get) => ({
  sections: [...DEFAULT_SECTIONS],
  presetName: '기본',

  reorderSections: (fromIndex, toIndex) => {
    set((state) => {
      const next = [...state.sections]
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return { sections: next }
    })
  },

  toggleSection: (id) => {
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, visible: !s.visible } : s
      ),
    }))
  },

  changeViewMode: (id, mode) => {
    set((state) => ({
      sections: state.sections.map((s) =>
        s.id === id ? { ...s, viewMode: mode } : s
      ),
    }))
  },

  savePreset: async (name, userId) => {
    const layout = {
      sections: get().sections.map((s) => ({
        id: s.id, visible: s.visible, viewMode: s.viewMode,
      })),
    }

    // 기존 프리셋 업데이트 또는 신규 생성
    const { data: existing } = await supabase
      .from('report_presets')
      .select('id')
      .eq('user_id', userId)
      .eq('preset_name', name)
      .single()

    if (existing) {
      await supabase.from('report_presets').update({ layout }).eq('id', existing.id)
    } else {
      await supabase.from('report_presets').insert({
        user_id: userId, preset_name: name, layout,
      })
    }
    set({ presetName: name })
  },

  loadPreset: async (presetId) => {
    const { data } = await supabase.from('report_presets').select('*').eq('id', presetId).single()
    if (!data) return

    const layout = data.layout as { sections: Array<{ id: string; visible: boolean; viewMode: ViewMode }> }
    const currentSections = get().sections

    // 저장된 순서와 설정 적용
    const ordered: SectionConfig[] = []
    layout.sections.forEach((saved) => {
      const section = currentSections.find((s) => s.id === saved.id)
      if (section) {
        ordered.push({ ...section, visible: saved.visible, viewMode: saved.viewMode })
      }
    })
    // 새로 추가된 섹션 (프리셋에 없는 것)
    currentSections.forEach((s) => {
      if (!ordered.find((o) => o.id === s.id)) ordered.push(s)
    })

    set({ sections: ordered, presetName: data.preset_name })
  },

  loadDefaultOrSaved: async (userId) => {
    const { data } = await supabase
      .from('report_presets')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .single()

    if (data) {
      const layout = data.layout as { sections: Array<{ id: string; visible: boolean; viewMode: ViewMode }> }
      const currentSections = get().sections
      const ordered: SectionConfig[] = []
      layout.sections.forEach((saved) => {
        const section = currentSections.find((s) => s.id === saved.id)
        if (section) ordered.push({ ...section, visible: saved.visible, viewMode: saved.viewMode })
      })
      currentSections.forEach((s) => {
        if (!ordered.find((o) => o.id === s.id)) ordered.push(s)
      })
      set({ sections: ordered, presetName: data.preset_name })
    }
  },

  resetToDefault: () => {
    set({ sections: [...DEFAULT_SECTIONS], presetName: '기본' })
  },
}))
