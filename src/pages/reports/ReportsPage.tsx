import { useState, useEffect, useCallback, useRef } from 'react'
import Header from '@/components/layout/Header'
import { useReportData, type ReportType, type ReportData } from '@/hooks/useReportData'
import { generateExcelReport } from '@/utils/generateExcelReport'
import { generatePdfFromElement } from '@/utils/generatePdfReport'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useReportLayoutStore, type ViewMode } from '@/store/reportLayoutStore'
import type { BranchType, ReportHistory } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'
import {
  SummarySection, AlertsSection, KpiSection, MatrixSection,
  ChartsSection, CustomKpiSection, ConsultantsSection, ManufacturersSection, CustomersSection,
} from './ReportSections'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  FileText, FileSpreadsheet, Download, Eye, Clock, Loader2,
  GripVertical, Save, RotateCcw, Settings2,
} from 'lucide-react'

const REPORT_TYPES: { type: ReportType; label: string }[] = [
  { type: '일간', label: '일간' }, { type: '주간', label: '주간' },
  { type: '월간', label: '월간' }, { type: '연간', label: '연간' },
]
const BRANCHES_FILTER: (BranchType | '전체')[] = ['전체', ...ALL_BRANCHES]
const VIEW_LABELS: Record<ViewMode, string> = { card: '카드', table: '테이블', chart: '차트' }

// 드래그 가능한 섹션 래퍼
function SortableSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, position: 'relative' }} {...attributes}>
      {/* 드래그 핸들 */}
      <div {...listeners} style={{ position: 'absolute', left: -20, top: 8, cursor: 'grab', color: '#d1d5db', zIndex: 10 }}>
        <GripVertical size={14} />
      </div>
      {children}
    </div>
  )
}

// 섹션 컨텐츠 렌더러
function RenderSection({ sectionId, d, viewMode, customKpis }: {
  sectionId: string; d: ReportData; viewMode: ViewMode
  customKpis: Array<{ kpi_name: string; branch: string; target_value: number; actual_value: number; unit: string }>
}) {
  const props = { d, viewMode, customKpis }
  switch (sectionId) {
    case 'summary': return <SummarySection {...props} />
    case 'alerts': return <AlertsSection {...props} />
    case 'kpi': return <KpiSection {...props} />
    case 'matrix': return <MatrixSection {...props} />
    case 'charts': return <ChartsSection {...props} />
    case 'customKpi': return <CustomKpiSection {...props} />
    case 'consultants': return <ConsultantsSection {...props} />
    case 'manufacturers': return <ManufacturersSection {...props} />
    case 'customers': return <CustomersSection {...props} />
    default: return null
  }
}

export default function ReportsPage() {
  const { user } = useAuthStore()
  const canGenerate = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_ADMIN'
  const { generateReportData, isGenerating } = useReportData()
  const layout = useReportLayoutStore()

  const [reportType, setReportType] = useState<ReportType>('월간')
  const [baseDate, setBaseDate] = useState(new Date().toISOString().slice(0, 10))
  const [branch, setBranch] = useState<BranchType | '전체'>('전체')
  const [previewData, setPreviewData] = useState<ReportData | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [history, setHistory] = useState<ReportHistory[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [customKpis, setCustomKpis] = useState<Array<{ kpi_name: string; branch: string; target_value: number; actual_value: number; unit: string }>>([])
  const reportPreviewRef = useRef<HTMLDivElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // 히스토리 + 프리셋 로드
  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true)
    const { data } = await supabase.from('reports_history').select('*').order('created_at', { ascending: false }).limit(20)
    if (data) setHistory(data as ReportHistory[])
    setIsLoadingHistory(false)
  }, [])

  useEffect(() => {
    fetchHistory()
    if (user?.id) layout.loadDefaultOrSaved(user.id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 커스텀 KPI 로드
  useEffect(() => {
    const fetchCustomKpis = async () => {
      const year = new Date(baseDate).getFullYear()
      const { data } = await supabase.from('custom_kpi').select('*').eq('year', year).order('sort_order')
      if (data) setCustomKpis(data)
    }
    fetchCustomKpis()
  }, [baseDate])

  const handlePreview = async () => {
    setPreviewData(await generateReportData(reportType, new Date(baseDate), branch))
  }

  const handleDownload = async (format: 'PDF' | 'Excel') => {
    setIsDownloading(true)
    try {
      let data = previewData
      if (!data) { data = await generateReportData(reportType, new Date(baseDate), branch); setPreviewData(data); await new Promise(r => setTimeout(r, 800)) }
      let blob: Blob
      if (format === 'Excel') { blob = generateExcelReport(data) }
      else { if (!reportPreviewRef.current) { alert('미리보기를 먼저 생성해주세요'); return }; blob = await generatePdfFromElement(reportPreviewRef.current) }
      const ext = format === 'Excel' ? 'xlsx' : 'pdf'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `보고서_${data.reportType}_${data.branch}_${baseDate.replace(/-/g, '')}.${ext}`; a.click()
      URL.revokeObjectURL(url)
      try { const sp = `reports/${Date.now()}.${ext}`; await supabase.storage.from('reports').upload(sp, blob); const { data: ud } = supabase.storage.from('reports').getPublicUrl(sp); await supabase.from('reports_history').insert({ report_type: data.reportType, report_date: baseDate, branch: data.branch, file_url: ud.publicUrl, file_format: format, created_by: user?.id }); fetchHistory() } catch {}
    } catch (err) { alert(err instanceof Error ? err.message : '실패') } finally { setIsDownloading(false) }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = layout.sections.findIndex(s => s.id === active.id)
    const newIdx = layout.sections.findIndex(s => s.id === over.id)
    if (oldIdx !== -1 && newIdx !== -1) layout.reorderSections(oldIdx, newIdx)
  }

  const handleSavePreset = async () => {
    if (!user?.id) return
    const name = prompt('프리셋 이름을 입력하세요', layout.presetName)
    if (!name) return
    await layout.savePreset(name, user.id)
    alert('저장 완료!')
  }

  const d = previewData
  const visibleSections = layout.sections.filter(s => s.visible)

  return (
    <div>
      <Header title="보고서" />
      <div className="p-6">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3 space-y-4">
            {/* 설정 바 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5">
                  {REPORT_TYPES.map(rt => (
                    <button key={rt.type} onClick={() => setReportType(rt.type)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all ${reportType === rt.type ? 'bg-white text-[#1e40af] font-bold shadow-sm' : 'text-gray-500'}`}>
                      {rt.label}
                    </button>
                  ))}
                </div>
                <input type="date" value={baseDate} onChange={e => setBaseDate(e.target.value)} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm" />
                <select value={branch} onChange={e => setBranch(e.target.value as BranchType | '전체')} className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white">
                  {BRANCHES_FILTER.map(b => <option key={b} value={b}>{b === '전체' ? '전체' : BRANCH_LABELS[b]}</option>)}
                </select>
                <button onClick={handlePreview} disabled={isGenerating} className="px-3 py-1.5 text-sm bg-[#1e40af] text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
                  {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />} 미리보기
                </button>
                {canGenerate && <>
                  <button onClick={() => handleDownload('PDF')} disabled={isDownloading} className="px-3 py-1.5 text-sm bg-[#dc2626] text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
                    <FileText size={14} /> PDF
                  </button>
                  <button onClick={() => handleDownload('Excel')} disabled={isDownloading} className="px-3 py-1.5 text-sm bg-[#059669] text-white rounded-lg flex items-center gap-1 disabled:opacity-50">
                    <FileSpreadsheet size={14} /> Excel
                  </button>
                </>}
                <div className="ml-auto flex gap-1">
                  <button onClick={() => setShowSettings(!showSettings)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100" title="레이아웃 설정">
                    <Settings2 size={16} />
                  </button>
                  <button onClick={handleSavePreset} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50" title="레이아웃 저장">
                    <Save size={16} />
                  </button>
                  <button onClick={layout.resetToDefault} className="p-1.5 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50" title="기본값 복원">
                    <RotateCcw size={16} />
                  </button>
                </div>
              </div>

              {/* 레이아웃 설정 패널 */}
              {showSettings && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs font-semibold text-gray-600 mb-2">섹션 표시/숨김 및 뷰 전환</p>
                  <div className="flex flex-wrap gap-2">
                    {layout.sections.map(s => (
                      <div key={s.id} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2.5 py-1.5">
                        <button onClick={() => layout.toggleSection(s.id)}
                          className={`text-xs font-medium ${s.visible ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                          {s.visible ? '✓' : ''} {s.label}
                        </button>
                        {s.visible && s.availableViews.length > 1 && (
                          <select value={s.viewMode} onChange={e => layout.changeViewMode(s.id, e.target.value as ViewMode)}
                            className="text-[10px] px-1 py-0.5 border border-gray-200 rounded bg-white">
                            {s.availableViews.map(v => <option key={v} value={v}>{VIEW_LABELS[v]}</option>)}
                          </select>
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-2">🔀 섹션을 드래그하여 순서를 변경할 수 있습니다. 변경 사항은 PDF 출력에 동일하게 반영됩니다.</p>
                </div>
              )}
            </div>

            {/* 미리보기 */}
            {d ? (
              <div ref={reportPreviewRef} style={{ backgroundColor: '#f9fafb', padding: 4 }}>
                {/* 헤더 */}
                <div style={{ background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)', borderRadius: 12, padding: 20, color: 'white', marginBottom: 12 }}>
                  <p style={{ fontSize: 11, opacity: 0.7 }}>DB Branch 고객현황 관리 시스템 · 사업2섹터</p>
                  <h2 style={{ fontSize: 18, fontWeight: 'bold', marginTop: 4 }}>{d.reportType} 보고서 — {d.periodLabel}</h2>
                  <p style={{ fontSize: 10, opacity: 0.5, marginTop: 6 }}>대상: {d.branch === '전체' ? '전체 브랜치' : BRANCH_LABELS[d.branch as BranchType]} | 비교: {d.prevPeriodLabel} | 생성: {d.generatedAt}</p>
                </div>

                {/* 드래그 가능한 섹션들 */}
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={visibleSections.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingLeft: 24 }}>
                      {visibleSections.map(section => (
                        <SortableSection key={section.id} id={section.id}>
                          <div style={{ backgroundColor: 'white', borderRadius: 12, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                            <div style={{ padding: '10px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fafafa' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{section.label}</span>
                              <div style={{ display: 'flex', gap: 4 }}>
                                {section.availableViews.length > 1 && section.availableViews.map(v => (
                                  <button key={v} onClick={() => layout.changeViewMode(section.id, v)}
                                    style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid', borderColor: section.viewMode === v ? '#2563eb' : '#e5e7eb', backgroundColor: section.viewMode === v ? '#eff6ff' : 'white', color: section.viewMode === v ? '#2563eb' : '#6b7280', cursor: 'pointer' }}>
                                    {VIEW_LABELS[v]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <RenderSection sectionId={section.id} d={d} viewMode={section.viewMode} customKpis={customKpis} />
                          </div>
                        </SortableSection>
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-16 text-center">
                <Eye size={48} className="mx-auto text-gray-200 mb-4" />
                <p className="text-gray-400 text-sm">보고서 유형·기간을 선택하고 "미리보기"를 클릭하세요</p>
                <p className="text-gray-300 text-xs mt-2">⚙ 설정에서 섹션 표시/숨김, 뷰 전환, 드래그 순서 변경이 가능합니다</p>
              </div>
            )}
          </div>

          {/* 우측 히스토리 */}
          <div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="px-4 py-3 border-b"><h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm"><Clock size={14} /> 생성 이력</h3></div>
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {isLoadingHistory ? <div className="p-6 text-center text-gray-400 text-xs">로딩...</div> :
                 history.length === 0 ? <div className="p-6 text-center text-gray-400 text-xs">이력 없음</div> :
                 history.map(h => (
                  <div key={h.id} className="px-4 py-2.5 hover:bg-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {h.file_format === 'PDF' ? <FileText size={14} className="text-red-400" /> : <FileSpreadsheet size={14} className="text-green-400" />}
                      <div>
                        <p className="text-xs font-medium text-gray-800">{h.report_type} · {h.branch === '전체' ? '전체' : BRANCH_LABELS[h.branch as BranchType] ?? h.branch}</p>
                        <p className="text-[10px] text-gray-400">{h.report_date}</p>
                      </div>
                    </div>
                    <a href={h.file_url} target="_blank" rel="noopener noreferrer" className="p-1 text-gray-300 hover:text-blue-600"><Download size={13} /></a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
