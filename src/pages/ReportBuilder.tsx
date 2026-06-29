import { useMemo, useState, useEffect, useRef } from 'react'
import { fetchCustomers } from '../lib/googleSheets'
import { supabase } from '../lib/supabase'
import {
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
} from 'recharts'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Settings2, FileDown, Download, Save, Pin, Sparkles, RefreshCw, FolderOpen, Trash2 } from 'lucide-react'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'
import * as XLSX from 'xlsx-js-style'

const TPL_KEY = 'reportBuilder:templates'
const LAST_KEY = 'reportBuilder:lastConfig'

type BlockId = 'kpi' | 'metrics' | 'trend' | 'status' | 'manager' | 'unopened' | 'erp' | 'ai'
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

const ALL_IDS: BlockId[] = ['kpi', 'metrics', 'trend', 'status', 'manager', 'unopened', 'erp', 'ai']
const BLOCK_META: Record<BlockId, { name: string; desc: string; icon: string; iconBg: string }> = {
  kpi: { name: 'KPI 달성 현황', desc: '연간 목표 대비 달성률', icon: '🎯', iconBg: 'bg-rose-50' },
  metrics: { name: '핵심 지표', desc: '신규·해지·순증·전환율', icon: '📊', iconBg: 'bg-emerald-50' },
  trend: { name: '신규 접수 추이', desc: '차트·기간 선택', icon: '📈', iconBg: 'bg-emerald-50' },
  status: { name: '개설 상태 분포', desc: '도넛 / 막대', icon: '🟢', iconBg: 'bg-blue-50' },
  manager: { name: '담당자 실적', desc: 'TOP N · 컬럼 선택', icon: '👤', iconBg: 'bg-violet-50' },
  unopened: { name: '미개설 관리', desc: '지연 현황 · 상세 목록', icon: '⏳', iconBg: 'bg-red-50' },
  erp: { name: 'ERP 회사별 분포', desc: '가로 막대', icon: '🖥', iconBg: 'bg-amber-50' },
  ai: { name: 'AI 코멘트', desc: '데이터 자동 분석 (다음 단계)', icon: '✨', iconBg: 'bg-emerald-50' },
}

const PRESETS: Record<string, { title: string; order: BlockId[]; label: string; emoji: string; sub: string }> = {
  work: { title: '업무 보고서', label: '업무 보고서', emoji: '📋', sub: 'KPI·현황·추이', order: ['kpi', 'metrics', 'status', 'trend'] },
  perf: { title: '담당자 실적 보고서', label: '담당자 실적', emoji: '🏆', sub: '담당자 성과', order: ['metrics', 'manager', 'ai'] },
  unopened: { title: '미개설 관리 보고서', label: '미개설 관리', emoji: '⏳', sub: '지연 추적', order: ['unopened', 'manager'] },
  marketing: { title: '마케팅 보고서', label: '마케팅 보고서', emoji: '📣', sub: 'ERP·전환율', order: ['erp', 'status', 'metrics'] },
  exec: { title: '경영 요약', label: '경영 요약', emoji: '📈', sub: '임원 1장', order: ['kpi', 'metrics', 'ai'] },
  custom: { title: '커스텀 보고서', label: '커스텀', emoji: '✚', sub: '직접 구성', order: ['kpi', 'metrics', 'trend', 'status', 'manager', 'unopened', 'erp', 'ai'] },
}
const buildBlocks = (presetId: string): { id: BlockId; on: boolean }[] => {
  const en = PRESETS[presetId].order
  const rest = ALL_IDS.filter((i) => !en.includes(i))
  return [...en.map((id) => ({ id, on: true })), ...rest.map((id) => ({ id, on: false }))]
}

const METRIC_DEFS = [
  { key: 'new', label: '신규 인입' },
  { key: 'term', label: '해지' },
  { key: 'net', label: '순증감' },
  { key: 'conv', label: '개설 전환율', percent: true },
  { key: 'unopened', label: '미개설' },
]
const MGR_COLS = [
  { key: 'periodNew', label: '접수' },
  { key: 'periodDone', label: '완료' },
  { key: 'periodCancel', label: '해지' },
  { key: 'curWaiting', label: '대기' },
  { key: 'curProgress', label: '진행' },
  { key: 'conv', label: '전환율' },
]
const PIE_COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444']
const pad = (n: number) => String(n).padStart(2, '0')
const todayLabel = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` }

// 좌측 블록 컨트롤 (드래그)
function SortableBlock({ id, render }: { id: string; render: (listeners: any, attributes: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return <div ref={setNodeRef} style={style}>{render(listeners, attributes)}</div>
}

export default function ReportBuilder() {
  const [customers, setCustomers] = useState<any[]>([])
  const [kpis, setKpis] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState('work')
  const [title, setTitle] = useState('업무 보고서')
  const [period, setPeriod] = useState<Period>('monthly')
  const [managerFilter, setManagerFilter] = useState('')
  const [cmp, setCmp] = useState(true)
  const [cmpBase, setCmpBase] = useState<'prev' | 'ya'>('prev')
  const [blocks, setBlocks] = useState<{ id: BlockId; on: boolean }[]>(() => buildBlocks('work'))
  const [openOpt, setOpenOpt] = useState<BlockId | null>(null)
  const [opts, setOpts] = useState<any>({
    metrics: { keys: ['new', 'term', 'net', 'conv'] },
    trend: { type: 'bar', months: 12 },
    status: { view: 'donut' },
    manager: { topN: 5, cols: ['periodNew', 'periodDone', 'periodCancel', 'conv'] },
    unopened: { listN: 20 },
    erp: { topN: 8 },
  })
  const [exporting, setExporting] = useState<null | 'pdf' | 'png'>(null)
  const [templates, setTemplates] = useState<{ name: string; config: any }[]>(() => {
    try { return JSON.parse(localStorage.getItem(TPL_KEY) || '[]') } catch { return [] }
  })
  const [showTemplates, setShowTemplates] = useState(false)
  const [toast, setToast] = useState('')
  const previewRef = useRef<HTMLDivElement>(null)
  const tplFileRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    fetchCustomers().then((d) => { setCustomers(d || []); setLoading(false) }).catch(() => setLoading(false))
    ;(async () => {
      try {
        const { data } = await supabase.from('kpi_targets').select('*').eq('year', new Date().getFullYear()).order('sort_order')
        setKpis(data || [])
      } catch { /* KPI 미설정/오프라인 시 무시 */ }
    })()
  }, [])

  // 마지막 구성 자동 복원
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(LAST_KEY) || 'null')
      if (saved) applyConfig(saved)
    } catch { /* ignore */ }
  }, [])

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2200) }

  // 현재 빌더 상태 → 직렬화 가능한 구성 객체
  const currentConfig = () => ({ preset, title, period, managerFilter, cmp, cmpBase, blocks, opts })
  const applyConfig = (c: any) => {
    if (!c) return
    if (c.preset != null) setPreset(c.preset)
    if (c.title != null) setTitle(c.title)
    if (c.period != null) setPeriod(c.period)
    if (c.managerFilter != null) setManagerFilter(c.managerFilter)
    if (c.cmp != null) setCmp(c.cmp)
    if (c.cmpBase != null) setCmpBase(c.cmpBase)
    if (Array.isArray(c.blocks)) {
      const known = c.blocks.filter((b: any) => ALL_IDS.includes(b.id))
      const missing = ALL_IDS.filter((id) => !known.some((b: any) => b.id === id)).map((id) => ({ id, on: false }))
      setBlocks([...known, ...missing])
    }
    if (c.opts != null) setOpts((o: any) => ({ ...o, ...c.opts }))
  }

  // 변경 시 마지막 구성 자동 저장
  useEffect(() => {
    if (loading) return
    try { localStorage.setItem(LAST_KEY, JSON.stringify(currentConfig())) } catch { /* ignore */ }
  }, [preset, title, period, managerFilter, cmp, cmpBase, blocks, opts, loading])

  const applyPreset = (id: string) => { setPreset(id); setTitle(PRESETS[id].title); setBlocks(buildBlocks(id)) }

  const managers = useMemo(() => [...new Set(customers.map((c) => c.manager).filter(Boolean))].sort() as string[], [customers])

  // 담당자 필터 적용된 데이터
  const data = useMemo(() => (managerFilter ? customers.filter((c) => c.manager === managerFilter) : customers), [customers, managerFilter])

  // ── 집계 ──
  const now = new Date(); const Y = now.getFullYear()
  const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const today = ymd(now)
  const yesterday = ymd(new Date(Y, now.getMonth(), now.getDate() - 1))
  const thisMonthKey = `${Y}-${pad(now.getMonth() + 1)}`
  const lastMonthD = new Date(Y, now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonthD.getFullYear()}-${pad(lastMonthD.getMonth() + 1)}`
  const yaMonthKey = `${Y - 1}-${pad(now.getMonth() + 1)}`
  const weekStart = ymd(new Date(Y, now.getMonth(), now.getDate() - now.getDay() + 1))
  const lastWeekStart = ymd(new Date(Y, now.getMonth(), now.getDate() - now.getDay() - 6))
  const lastWeekEnd = ymd(new Date(Y, now.getMonth(), now.getDate() - now.getDay()))

  const newIn = (from: string, to: string) => data.filter((c) => c.reception_date && c.reception_date >= from && c.reception_date <= to).length
  const newKey = (k: string) => data.filter((c) => c.reception_date?.startsWith(k)).length
  const termIn = (from: string, to: string) => data.filter((c) => c.termination_date && c.termination_date >= from && c.termination_date <= to).length
  const termKey = (k: string) => data.filter((c) => c.termination_date?.startsWith(k)).length

  let curNew = 0, prevNew = 0, curTerm = 0, prevTerm = 0, baseLabel = '직전'
  if (period === 'daily') { curNew = newIn(today, today); prevNew = newIn(yesterday, yesterday); curTerm = termIn(today, today); prevTerm = termIn(yesterday, yesterday); baseLabel = '어제' }
  else if (period === 'weekly') { curNew = newIn(weekStart, today); prevNew = newIn(lastWeekStart, lastWeekEnd); curTerm = termIn(weekStart, today); prevTerm = termIn(lastWeekStart, lastWeekEnd); baseLabel = '지난주' }
  else if (period === 'monthly') { curNew = newKey(thisMonthKey); curTerm = termKey(thisMonthKey); if (cmpBase === 'ya') { prevNew = newKey(yaMonthKey); prevTerm = termKey(yaMonthKey); baseLabel = '전년 동월' } else { prevNew = newKey(lastMonthKey); prevTerm = termKey(lastMonthKey); baseLabel = '전월' } }
  else { curNew = newKey(`${Y}`); prevNew = newKey(`${Y - 1}`); curTerm = termKey(`${Y}`); prevTerm = termKey(`${Y - 1}`); baseLabel = '전년' }

  const sc = {
    opened: data.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length,
    waiting: data.filter((c) => c.opening_status === '개설대기').length,
    progress: data.filter((c) => c.opening_status === '개설진행').length,
    canceled: data.filter((c) => c.opening_status === '개설취소').length,
  }
  const convRate = data.length > 0 ? Math.round((sc.opened / data.length) * 100) : 0
  const unopened = data.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료' && c.opening_status !== '개설취소')

  const metricVal: Record<string, { label: string; cur: number; prev: number | null; percent?: boolean }> = {
    new: { label: '신규 인입', cur: curNew, prev: prevNew },
    term: { label: '해지', cur: curTerm, prev: prevTerm },
    net: { label: '순증감', cur: curNew - curTerm, prev: prevNew - prevTerm },
    conv: { label: '개설 전환율', cur: convRate, prev: null, percent: true },
    unopened: { label: '미개설', cur: unopened.length, prev: null },
  }

  // 추이
  const getPeriodData = () => {
    if (period === 'daily') return Array.from({ length: 14 }, (_, i) => { const d = new Date(Y, now.getMonth(), now.getDate() - 13 + i); return { label: `${d.getMonth() + 1}/${d.getDate()}`, count: newIn(ymd(d), ymd(d)) } })
    if (period === 'weekly') return Array.from({ length: 8 }, (_, i) => { const ws = new Date(Y, now.getMonth(), now.getDate() - (7 - i) * 7 - now.getDay() + 1); const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6); return { label: `${ws.getMonth() + 1}/${ws.getDate()}`, count: newIn(ymd(ws), ymd(we)) } })
    if (period === 'monthly') { const m = opts.trend.months; return Array.from({ length: m }, (_, i) => { const d = new Date(Y, now.getMonth() - (m - 1) + i, 1); return { label: `${d.getMonth() + 1}월`, count: newKey(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`) } }) }
    return Array.from({ length: 5 }, (_, i) => { const y = Y - 4 + i; return { label: `${y}년`, count: newKey(String(y)) } })
  }
  const trendData = getPeriodData()

  // 담당자
  const mDateFrom = period === 'daily' ? today : period === 'weekly' ? weekStart : period === 'monthly' ? `${thisMonthKey}-01` : `${Y}-01-01`
  const inPeriod = (d?: string) => !!d && d >= mDateFrom && d <= today
  const mm: Record<string, any> = {}
  data.forEach((c) => {
    if (!c.manager) return
    if (!mm[c.manager]) mm[c.manager] = { total: 0, periodNew: 0, periodDone: 0, periodCancel: 0, curWaiting: 0, curProgress: 0 }
    mm[c.manager].total++
    if (inPeriod(c.reception_date)) mm[c.manager].periodNew++
    if ((c.opening_status === '개설완료' || c.opening_status === '이행완료') && inPeriod(c.opening_date)) mm[c.manager].periodDone++
    if (inPeriod(c.termination_date)) mm[c.manager].periodCancel++
    if (c.opening_status === '개설대기') mm[c.manager].curWaiting++
    if (c.opening_status === '개설진행') mm[c.manager].curProgress++
  })
  let managerRows = Object.entries(mm).map(([name, s]: any) => ({ name, ...s })).sort((a, b) => (b.periodNew + b.periodDone) - (a.periodNew + a.periodDone) || b.total - a.total)
  if (opts.manager.topN > 0) managerRows = managerRows.slice(0, opts.manager.topN)

  // ERP
  const erpMap: Record<string, number> = {}
  data.forEach((c) => { if (c.erp_company) erpMap[c.erp_company] = (erpMap[c.erp_company] || 0) + 1 })
  const erpData = Object.entries(erpMap).sort((a, b) => b[1] - a[1]).slice(0, opts.erp.topN).map(([name, count]) => ({ name, count }))
  const erpMax = Math.max(...erpData.map((e) => e.count), 1)

  const periodLabel = period === 'daily' ? '일간' : period === 'weekly' ? '주간' : period === 'monthly' ? '월간' : '연간'

  // ── KPI 달성 현황 (연간 목표 대비) ──
  const yearNew = newKey(`${Y}`)
  const terminatedList = data.filter((c) => c.management_type === '해지' || c.termination_date)
  const yearTerm = terminatedList.filter((c) => c.termination_date?.startsWith(`${Y}`)).length
  const yearOpened = data.filter((c) => (c.opening_status === '개설완료' || c.opening_status === '이행완료') && c.opening_date?.startsWith(`${Y}`)).length
  const calcKpiCurrent = (kpi: any): number => {
    const name = (kpi.kpi_name || '').toLowerCase()
    if (name.includes('신규')) return yearNew
    if (name.includes('해지')) return yearTerm
    if (name.includes('개설완료') || name.includes('완료')) return yearOpened
    if (name.includes('전환') || name.includes('유치율')) return convRate
    if (name.includes('미개설')) return unopened.length
    if (name.includes('유지')) return data.length > 0 ? Math.round(((data.length - terminatedList.length) / data.length) * 100) : 0
    if (name.includes('순증')) return yearNew - yearTerm
    if (name.includes('전체') || name.includes('총')) return data.length
    return 0
  }
  const kpiRows = kpis.map((k) => {
    const current = calcKpiCurrent(k)
    const target = Number(k.target_value) || 0
    const rate = target > 0 ? Math.round((current / target) * 100) : 0
    const status = rate >= 80 ? 'green' : rate >= 50 ? 'yellow' : 'red'
    return { ...k, current, target, rate, status }
  })

  // ── 미개설 상세 ──
  const uDays = (c: any) => c.reception_date ? Math.floor((now.getTime() - new Date(c.reception_date).getTime()) / 86400000) : 0
  const u30 = unopened.filter((c) => uDays(c) <= 30)
  const u3090 = unopened.filter((c) => { const d = uDays(c); return d > 30 && d <= 90 })
  const u90 = unopened.filter((c) => uDays(c) > 90)
  const uAvg = unopened.length > 0 ? Math.round(unopened.reduce((s, c) => s + uDays(c), 0) / unopened.length) : 0
  const uList = [...unopened].sort((a, b) => uDays(b) - uDays(a)).slice(0, opts.unopened.listN)

  const toggleBlock = (id: BlockId) => setBlocks((bs) => bs.map((b) => b.id === id ? { ...b, on: !b.on } : b))
  const onDragEnd = (e: any) => { const { active, over } = e; if (over && active.id !== over.id) setBlocks((bs) => { const o = bs.findIndex((b) => b.id === active.id); const n = bs.findIndex((b) => b.id === over.id); return arrayMove(bs, o, n) }) }
  const notReady = () => alert('AI 코멘트는 다음 단계에서 제공됩니다. (현재 API 크레딧 소진)')

  const activeBlocks = () => blocks.filter((b) => b.on)

  // ── PDF 내보내기 ──
  const exportPdf = async () => {
    if (!previewRef.current) return
    if (activeBlocks().length === 0) { alert('포함된 블록이 없습니다.'); return }
    setExporting('pdf')
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210, pageHeight = 297, margin = 10
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const printableHeight = pageHeight - margin * 2
      if (imgHeight <= printableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight)
      } else {
        let heightLeft = imgHeight, position = margin
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= printableHeight
        while (heightLeft > 0) {
          position = margin - (imgHeight - heightLeft)
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
          heightLeft -= printableHeight
        }
      }
      pdf.save(`${title || '보고서'}_${today}.pdf`)
      showToast('PDF 파일을 다운로드했습니다.')
    } catch (err) {
      alert('PDF 생성 실패: ' + String((err as any)?.message || err))
    } finally { setExporting(null) }
  }

  // ── 스냅샷(PNG) 내보내기 ──
  const exportPng = async () => {
    if (!previewRef.current) return
    if (activeBlocks().length === 0) { alert('포함된 블록이 없습니다.'); return }
    setExporting('png')
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true })
      const link = document.createElement('a')
      link.download = `${title || '보고서'}_${today}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      showToast('스냅샷 이미지를 다운로드했습니다.')
    } catch (err) {
      alert('스냅샷 생성 실패: ' + String((err as any)?.message || err))
    } finally { setExporting(null) }
  }

  // ── Excel 내보내기 ──
  const genExcel = (): any[][] => {
    const rows: any[][] = []
    rows.push([title || '보고서'])
    rows.push([`보고서 생성일: ${todayLabel()}`])
    rows.push([`집계 기준: ${periodLabel}${managerFilter ? ` · ${managerFilter}` : ' · 전체'}${cmp ? ` · ${baseLabel} 대비` : ''}`])
    rows.push([])
    activeBlocks().forEach((b) => {
      if (b.id === 'metrics') {
        rows.push(['[ 핵심 지표 ]'])
        rows.push(cmp ? ['지표', '값', `${baseLabel} 대비`] : ['지표', '값'])
        opts.metrics.keys.forEach((k: string) => {
          const m = metricVal[k]; if (!m) return
          const valStr = `${m.cur}${m.percent ? '%' : ''}`
          if (cmp) {
            const d = m.prev == null ? '' : `${m.cur - m.prev > 0 ? '+' : ''}${m.cur - m.prev}${m.percent ? '%p' : ''}`
            rows.push([m.label, valStr, d])
          } else rows.push([m.label, valStr])
        })
        rows.push([])
      }
      if (b.id === 'trend') {
        rows.push([`[ 신규 접수 추이 (${periodLabel}) ]`])
        rows.push(['기간', '신규(건)'])
        trendData.forEach((t) => rows.push([t.label, t.count]))
        rows.push([])
      }
      if (b.id === 'status') {
        rows.push(['[ 개설 상태 분포 ]'])
        rows.push(['상태', '건수'])
        ;([['개설완료', sc.opened], ['개설대기', sc.waiting], ['개설진행', sc.progress], ['개설취소', sc.canceled]] as [string, number][]).forEach((r) => rows.push(r))
        rows.push([])
      }
      if (b.id === 'manager') {
        const cols = MGR_COLS.filter((c) => opts.manager.cols.includes(c.key))
        rows.push(['[ 담당자 실적 ]'])
        rows.push(['담당자', ...cols.map((c) => c.label)])
        managerRows.forEach((r) => {
          rows.push([r.name, ...cols.map((c) => {
            if (c.key === 'conv') return r.periodNew > 0 ? `${Math.round((r.periodDone / r.periodNew) * 100)}%` : '-'
            return r[c.key]
          })])
        })
        rows.push([])
      }
      if (b.id === 'erp') {
        rows.push(['[ ERP 회사별 분포 ]'])
        rows.push(['ERP 회사', '고객수'])
        erpData.forEach((e) => rows.push([e.name, e.count]))
        rows.push([])
      }
      if (b.id === 'kpi') {
        rows.push([`[ ${Y}년 KPI 달성 현황 ]`])
        rows.push(['KPI', '카테고리', '현재', '목표', '달성률', '상태'])
        if (kpiRows.length === 0) rows.push(['등록된 KPI 없음', '', '', '', '', ''])
        else kpiRows.forEach((k) => rows.push([k.kpi_name, k.kpi_category, `${k.current}${k.unit ? ' ' + k.unit : ''}`, `${k.target}${k.unit ? ' ' + k.unit : ''}`, `${k.rate}%`, k.status === 'green' ? '정상' : k.status === 'yellow' ? '주의' : '부진']))
        rows.push([])
      }
      if (b.id === 'unopened') {
        rows.push(['[ 미개설 현황 요약 ]'])
        rows.push(['구분', '건수'])
        ;([['전체 미개설', unopened.length], ['30일 이내', u30.length], ['30~90일', u3090.length], ['90일+', u90.length], ['평균 미개설(일)', uAvg]] as [string, number][]).forEach((r) => rows.push(r))
        rows.push([])
        rows.push(['[ 미개설 고객 상세 ]'])
        rows.push(['고객명', '고객번호', '담당자', '접수일', '상태', '미개설일수'])
        uList.forEach((c) => rows.push([c.customer_name, c.customer_number || '-', c.manager || '-', c.reception_date || '-', c.opening_status || '-', uDays(c)]))
        rows.push([])
      }
      if (b.id === 'ai') {
        rows.push(['[ AI 분석 요약 ]'])
        rows.push(['AI 코멘트는 다음 단계에서 제공됩니다.'])
        rows.push([])
      }
    })
    return rows
  }

  const exportExcel = () => {
    if (activeBlocks().length === 0) { alert('포함된 블록이 없습니다.'); return }
    const data = genExcel()
    const ws = XLSX.utils.aoa_to_sheet(data)
    const maxCols = Math.max(...data.map((r) => r.length), 1)

    ws['!cols'] = Array.from({ length: maxCols }, (_, ci) => {
      let maxLen = 10
      data.forEach((r) => {
        const v = String(r[ci] ?? '')
        const hangulLen = (v.match(/[가-힯]/g) || []).length
        const effLen = v.length + hangulLen * 0.8
        if (effLen > maxLen) maxLen = effLen
      })
      return { wch: Math.min(Math.max(maxLen + 2, 12), 40) }
    })

    ws['!rows'] = data.map((row, ri) => {
      if (ri === 0) return { hpt: 30 }
      if (row[0] != null && String(row[0]).startsWith('[')) return { hpt: 22 }
      return { hpt: 18 }
    })

    const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } }]
    if (data[1]?.[0] && String(data[1][0]).startsWith('보고서 생성일')) merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } })
    if (data[2]?.[0] && String(data[2][0]).startsWith('집계 기준')) merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } })
    ws['!merges'] = merges
    ws['!freeze'] = { xSplit: 0, ySplit: 3 }

    const thinBorder = { style: 'thin', color: { rgb: 'D1D5DB' } }
    const border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

    const isHeaderRow = (ri: number) => {
      if (ri <= 0) return false
      const row = data[ri]; if (!row || row.length === 0) return false
      const f = String(row[0] ?? '')
      if (f.startsWith('[') || f.startsWith('보고서 생성일') || f.startsWith('집계 기준')) return false
      const prev = data[ri - 1]; if (!prev || prev.length === 0) return false
      return String(prev[0] ?? '').startsWith('[')
    }

    data.forEach((row, ri) => {
      for (let ci = 0; ci < maxCols; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
        if (!ws[addr]) ws[addr] = { t: 's', v: '' }
        const cell = ws[addr]
        const val = row[ci]
        const isTitle = ri === 0
        const isMeta = ri > 0 && ri < 3 && ci === 0 && typeof val === 'string' && (val.startsWith('보고서') || val.startsWith('집계'))
        const isSection = !isTitle && row[0] != null && String(row[0]).startsWith('[')
        const isHeader = isHeaderRow(ri)

        if (isTitle) {
          cell.s = { font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' }, name: '맑은 고딕' }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center', vertical: 'center' }, border }
        } else if (isMeta) {
          cell.s = { font: { sz: 9, color: { rgb: '6B7280' }, italic: true, name: '맑은 고딕' }, alignment: { horizontal: 'right' } }
        } else if (isSection) {
          cell.s = { font: { bold: true, sz: 12, color: { rgb: '1E293B' }, name: '맑은 고딕' }, fill: { patternType: 'solid', fgColor: { rgb: 'E0F2FE' } }, alignment: { horizontal: 'left', vertical: 'center' }, border }
        } else if (isHeader) {
          cell.s = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' }, name: '맑은 고딕' }, fill: { patternType: 'solid', fgColor: { rgb: '059669' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border }
        } else if (!isTitle && !isMeta) {
          const isNum = typeof val === 'number'
          const isFirstCol = ci === 0
          const isStatus = typeof val === 'string' && ['정상', '주의', '부진'].includes(val)
          let fill: any = ri % 2 === 1 ? { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } } : undefined
          let color = { rgb: '111827' }
          if (isStatus) {
            if (val === '정상') { fill = { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } }; color = { rgb: '065F46' } }
            else if (val === '주의') { fill = { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } }; color = { rgb: '92400E' } }
            else { fill = { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } }; color = { rgb: '991B1B' } }
          }
          cell.s = { font: { sz: 10, color, name: '맑은 고딕', bold: (isFirstCol && !isNum) || isStatus }, alignment: { horizontal: isNum ? 'right' : isFirstCol ? 'left' : 'center', vertical: 'center' }, fill, border }
          if (isNum) cell.z = '#,##0'
        }
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, (title || '보고서').slice(0, 31))
    XLSX.writeFile(wb, `${title || '보고서'}_${today}.xlsx`)
    showToast('Excel 파일을 다운로드했습니다.')
  }

  // ── 양식 저장 / 불러오기 ──
  const saveTemplate = () => {
    const name = prompt('양식 이름을 입력하세요.', title || '내 양식')?.trim()
    if (!name) return
    const next = [...templates.filter((t) => t.name !== name), { name, config: currentConfig() }]
    setTemplates(next)
    try { localStorage.setItem(TPL_KEY, JSON.stringify(next)) } catch { /* ignore */ }
    showToast(`'${name}' 양식을 저장했습니다.`)
  }
  const loadTemplate = (t: { name: string; config: any }) => { applyConfig(t.config); setShowTemplates(false); showToast(`'${t.name}' 양식을 불러왔습니다.`) }
  const deleteTemplate = (name: string) => {
    const next = templates.filter((t) => t.name !== name)
    setTemplates(next)
    try { localStorage.setItem(TPL_KEY, JSON.stringify(next)) } catch { /* ignore */ }
  }
  // 양식 파일 내보내기 / 가져오기 (백업·공유용)
  const exportTemplates = () => {
    if (templates.length === 0) { alert('저장된 양식이 없습니다.'); return }
    const blob = new Blob([JSON.stringify(templates, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `보고서양식_${today}.json`; a.click()
    URL.revokeObjectURL(url)
    showToast('양식 파일(.json)을 내보냈습니다.')
  }
  const importTemplatesFromFile = (file: File) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result))
        const incoming = Array.isArray(parsed) ? parsed : [parsed]
        const valid = incoming.filter((t: any) => t && t.name && t.config)
        if (valid.length === 0) { alert('유효한 양식 파일이 아닙니다.'); return }
        const map = new Map(templates.map((t) => [t.name, t]))
        valid.forEach((t: any) => map.set(t.name, { name: t.name, config: t.config }))
        const next = Array.from(map.values())
        setTemplates(next)
        try { localStorage.setItem(TPL_KEY, JSON.stringify(next)) } catch { /* ignore */ }
        showToast(`${valid.length}개 양식을 가져왔습니다.`)
      } catch { alert('양식 파일을 읽을 수 없습니다. (.json)') }
    }
    reader.readAsText(file)
  }

  const delta = (m: { cur: number; prev: number | null; percent?: boolean }) => {
    if (!cmp || m.prev == null) return null
    const d = m.cur - m.prev
    const cls = d > 0 ? 'text-emerald-600' : d < 0 ? 'text-red-500' : 'text-gray-400'
    const arr = d > 0 ? '▲' : d < 0 ? '▼' : '–'
    const unit = m.percent ? '%p' : ''
    return <span className={`text-[11px] mt-1.5 block ${cls}`}>{arr} {baseLabel} 대비 {d > 0 ? '+' : ''}{d}{unit}</span>
  }

  // ── 미리보기 블록 렌더 ──
  const renderPreview = (id: BlockId) => {
    if (id === 'metrics') {
      const keys = opts.metrics.keys
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {keys.map((k: string) => {
            const m = metricVal[k]; if (!m) return null
            return (
              <div key={k} className="border border-gray-100 rounded-xl p-3.5">
                <p className="text-[11px] text-gray-400">{m.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1 tabular-nums">{m.cur.toLocaleString()}{m.percent ? '%' : ''}</p>
                {delta(m)}
              </div>
            )
          })}
        </div>
      )
    }
    if (id === 'trend') {
      return (
        <ResponsiveContainer width="100%" height={210}>
          {opts.trend.type === 'bar' ? (
            <BarChart data={trendData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()}건`, '신규']} />
              <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          ) : (
            <LineChart data={trendData} margin={{ top: 6, right: 10, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [`${Number(v).toLocaleString()}건`, '신규']} />
              <Line type="monotone" dataKey="count" stroke="#059669" strokeWidth={2.5} dot={{ r: 2 }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      )
    }
    if (id === 'status') {
      const pieData = [{ name: '개설완료', value: sc.opened }, { name: '개설대기', value: sc.waiting }, { name: '개설진행', value: sc.progress }, { name: '개설취소', value: sc.canceled }]
      if (opts.status.view === 'bar') {
        return (
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={pieData} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip formatter={(v: any) => `${Number(v).toLocaleString()}건`} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>{PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        )
      }
      return (
        <div className="flex items-center gap-6">
          <ResponsiveContainer width="45%" height={150}>
            <PieChart><Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={3} dataKey="value" strokeWidth={0}>{PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip formatter={(v: any) => `${Number(v).toLocaleString()}건`} /></PieChart>
          </ResponsiveContainer>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2 text-sm text-gray-600"><span className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />{d.name}<b className="ml-auto text-gray-800 tabular-nums">{d.value.toLocaleString()}</b></div>
            ))}
          </div>
        </div>
      )
    }
    if (id === 'manager') {
      const cols = MGR_COLS.filter((c) => opts.manager.cols.includes(c.key))
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="bg-emerald-600 text-white">
              <th className="text-left px-3 py-2 font-bold text-xs rounded-l-lg">담당자</th>
              {cols.map((c) => <th key={c.key} className="px-3 py-2 font-bold text-xs">{c.label}</th>)}
            </tr></thead>
            <tbody>
              {managerRows.length === 0 ? (
                <tr><td colSpan={cols.length + 1} className="text-center py-6 text-gray-300 text-sm">데이터가 없습니다.</td></tr>
              ) : managerRows.map((r, i) => (
                <tr key={r.name} className={i % 2 ? 'bg-[#FAFCFB]' : ''}>
                  <td className="px-3 py-2 font-semibold border-b border-gray-100">{r.name}</td>
                  {cols.map((c) => {
                    let v: any = r[c.key]
                    if (c.key === 'conv') v = r.periodNew > 0 ? `${Math.round((r.periodDone / r.periodNew) * 100)}%` : '-'
                    return <td key={c.key} className="px-3 py-2 text-center tabular-nums border-b border-gray-100">{v}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    }
    if (id === 'erp') {
      return (
        <div className="flex flex-col gap-2">
          {erpData.length === 0 ? <p className="text-center py-4 text-gray-300 text-sm">데이터가 없습니다.</p> : erpData.map((e) => (
            <div key={e.name} className="flex items-center gap-3 text-[13px]">
              <span className="w-24 truncate text-gray-600">{e.name}</span>
              <span className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden"><span className="block h-full bg-amber-500 rounded-full" style={{ width: `${(e.count / erpMax) * 100}%` }} /></span>
              <span className="w-9 text-right font-bold text-gray-700 tabular-nums">{e.count}</span>
            </div>
          ))}
        </div>
      )
    }
    if (id === 'kpi') {
      if (kpiRows.length === 0) return <p className="text-center py-6 text-gray-300 text-sm">등록된 KPI가 없습니다. ‘KPI 설정’에서 추가하세요.</p>
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {kpiRows.map((k) => {
            const bar = k.status === 'green' ? 'bg-emerald-500' : k.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
            const bg = k.status === 'green' ? 'bg-emerald-50 border-emerald-200' : k.status === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
            const txt = k.status === 'green' ? 'text-emerald-700' : k.status === 'yellow' ? 'text-amber-700' : 'text-red-700'
            return (
              <div key={k.id} className={`rounded-xl border p-3 ${bg}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <div className="min-w-0"><p className="text-[10px] text-gray-500">{k.kpi_category}</p><p className="font-bold text-gray-800 text-[13px] truncate">{k.kpi_name}</p></div>
                  <span className={`text-base font-bold ${txt} shrink-0 ml-1`}>{k.rate}%</span>
                </div>
                <div className="flex items-baseline gap-1 mb-1.5"><span className="text-lg font-bold text-gray-800 tabular-nums">{k.current.toLocaleString()}</span><span className="text-[11px] text-gray-500">/ {k.target.toLocaleString()} {k.unit}</span></div>
                <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden"><div className={`h-full rounded-full ${bar}`} style={{ width: `${Math.min(k.rate, 100)}%` }} /></div>
              </div>
            )
          })}
        </div>
      )
    }
    if (id === 'unopened') {
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {([['전체', unopened.length, 'text-gray-700'], ['30일 이내', u30.length, 'text-emerald-600'], ['30~90일', u3090.length, 'text-amber-600'], ['90일+', u90.length, 'text-red-600'], ['평균(일)', uAvg, 'text-blue-600']] as [string, number, string][]).map(([l, v, c]) => (
              <div key={l} className="border border-gray-100 rounded-xl p-2.5 text-center"><p className="text-[10px] text-gray-400">{l}</p><p className={`text-lg font-bold ${c} tabular-nums`}>{v.toLocaleString()}</p></div>
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="bg-gray-100 text-gray-600"><th className="text-left px-2.5 py-1.5 font-bold rounded-l-lg">고객명</th><th className="px-2.5 py-1.5 font-bold">담당자</th><th className="px-2.5 py-1.5 font-bold">접수일</th><th className="px-2.5 py-1.5 font-bold">상태</th><th className="px-2.5 py-1.5 font-bold rounded-r-lg">미개설일수</th></tr></thead>
              <tbody>
                {uList.length === 0 ? <tr><td colSpan={5} className="text-center py-5 text-gray-300">미개설 고객이 없습니다.</td></tr> : uList.map((c, i) => (
                  <tr key={c.id || i} className={i % 2 ? 'bg-[#FAFCFB]' : ''}>
                    <td className="px-2.5 py-1.5 font-semibold border-b border-gray-100">{c.customer_name}</td>
                    <td className="px-2.5 py-1.5 text-center border-b border-gray-100">{c.manager || '-'}</td>
                    <td className="px-2.5 py-1.5 text-center border-b border-gray-100">{c.reception_date || '-'}</td>
                    <td className="px-2.5 py-1.5 text-center border-b border-gray-100">{c.opening_status || '-'}</td>
                    <td className="px-2.5 py-1.5 text-center border-b border-gray-100 font-bold tabular-nums">{uDays(c)}일</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )
    }
    if (id === 'ai') {
      return (
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white grid place-items-center"><Sparkles size={13} /></span>
            <span className="text-xs font-bold text-emerald-700">AI 분석 요약</span>
            <button onClick={notReady} className="ml-auto text-[11px] text-emerald-700 bg-white border border-emerald-200 rounded-lg px-2.5 py-1 hover:bg-emerald-100">↻ 생성</button>
          </div>
          <p className="text-sm text-gray-400 italic">AI 코멘트는 다음 단계(3단계)에서 선택한 데이터를 분석해 자동 생성됩니다.</p>
        </div>
      )
    }
    return null
  }

  // ── 블록 세부옵션 패널 ──
  const renderOptions = (id: BlockId) => {
    const Chip = ({ on, onClick, children }: any) => (
      <button onClick={onClick} className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border ${on ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-500'}`}>{children}</button>
    )
    const Seg = ({ value, options, onChange }: { value: any; options: [any, string][]; onChange: (v: any) => void }) => (
      <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
        {options.map(([v, l]) => <button key={String(v)} onClick={() => onChange(v)} className={`px-2.5 h-7 rounded-md text-[11.5px] font-semibold ${value === v ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>)}
      </div>
    )
    if (id === 'metrics') return (
      <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">표시할 지표</p><div className="flex flex-wrap gap-1.5">
        {METRIC_DEFS.map((m) => <Chip key={m.key} on={opts.metrics.keys.includes(m.key)} onClick={() => setOpts((o: any) => ({ ...o, metrics: { keys: o.metrics.keys.includes(m.key) ? o.metrics.keys.filter((x: string) => x !== m.key) : [...o.metrics.keys, m.key] } }))}>{m.label}</Chip>)}
      </div></div>
    )
    if (id === 'trend') return (
      <div className="space-y-2.5">
        <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">차트 타입</p><Seg value={opts.trend.type} options={[['bar', '막대'], ['line', '선']]} onChange={(v) => setOpts((o: any) => ({ ...o, trend: { ...o.trend, type: v } }))} /></div>
        {period === 'monthly' && <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">기간 길이</p><Seg value={opts.trend.months} options={[[6, '6개월'], [12, '12개월'], [24, '24개월']]} onChange={(v) => setOpts((o: any) => ({ ...o, trend: { ...o.trend, months: v } }))} /></div>}
      </div>
    )
    if (id === 'status') return (
      <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">표현 방식</p><Seg value={opts.status.view} options={[['donut', '도넛'], ['bar', '막대']]} onChange={(v) => setOpts((o: any) => ({ ...o, status: { view: v } }))} /></div>
    )
    if (id === 'manager') return (
      <div className="space-y-2.5">
        <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">표시 인원</p><Seg value={opts.manager.topN} options={[[5, 'TOP 5'], [10, 'TOP 10'], [0, '전체']]} onChange={(v) => setOpts((o: any) => ({ ...o, manager: { ...o.manager, topN: v } }))} /></div>
        <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">표시 컬럼</p><div className="flex flex-wrap gap-1.5">
          {MGR_COLS.map((c) => <Chip key={c.key} on={opts.manager.cols.includes(c.key)} onClick={() => setOpts((o: any) => ({ ...o, manager: { ...o.manager, cols: o.manager.cols.includes(c.key) ? o.manager.cols.filter((x: string) => x !== c.key) : [...o.manager.cols, c.key] } }))}>{c.label}</Chip>)}
        </div></div>
      </div>
    )
    if (id === 'erp') return (
      <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">표시 개수</p><Seg value={opts.erp.topN} options={[[5, 'TOP 5'], [8, 'TOP 8'], [99, '전체']]} onChange={(v) => setOpts((o: any) => ({ ...o, erp: { topN: v } }))} /></div>
    )
    if (id === 'unopened') return (
      <div><p className="text-[11px] font-bold text-gray-500 mb-1.5">상세 표시 개수</p><Seg value={opts.unopened.listN} options={[[10, '10건'], [20, '20건'], [50, '50건']]} onChange={(v) => setOpts((o: any) => ({ ...o, unopened: { listN: v } }))} /></div>
    )
    if (id === 'kpi') return <p className="text-[11px] text-gray-400">{Y}년 KPI 목표가 자동 반영됩니다. 목표값은 ‘KPI 설정’ 화면에서 관리하세요.</p>
    if (id === 'ai') return <p className="text-[11px] text-gray-400">AI 코멘트 옵션(관점·길이)은 다음 단계에서 제공됩니다.</p>
    return null
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 상단 바 */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold text-gray-800">커스텀 보고서 빌더</h2>
          <p className="text-xs text-gray-400 mt-0.5">전체 {customers.length.toLocaleString()}건 · 구성 · 미리보기 · 내보내기</p>
        </div>
        <div className="relative">
          <button onClick={() => setShowTemplates((v) => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm"><FolderOpen size={14} /> 양식 불러오기{templates.length > 0 && <span className="text-[10px] bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{templates.length}</span>}</button>
          {showTemplates && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTemplates(false)} />
              <div className="absolute right-0 mt-1 w-64 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1.5 max-h-80 overflow-y-auto">
                <p className="px-3 pt-1 pb-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">저장된 양식</p>
                {templates.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-gray-400 text-center">저장된 양식이 없습니다.</p>
                ) : templates.map((t) => (
                  <div key={t.name} className="flex items-center gap-1 px-2 hover:bg-gray-50 group">
                    <button onClick={() => loadTemplate(t)} className="flex-1 text-left px-1.5 py-2 text-sm text-gray-700 truncate">{t.name}</button>
                    <button onClick={() => deleteTemplate(t.name)} className="p-1.5 text-gray-300 hover:text-red-500" title="삭제"><Trash2 size={13} /></button>
                  </div>
                ))}
                <div className="border-t border-gray-100 mt-1.5 pt-1.5 px-2 space-y-0.5">
                  <button onClick={() => tplFileRef.current?.click()} className="w-full flex items-center gap-2 px-1.5 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg"><FolderOpen size={13} /> 파일에서 가져오기 (.json)</button>
                  <button onClick={exportTemplates} className="w-full flex items-center gap-2 px-1.5 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-lg"><Download size={13} /> 양식 파일로 내보내기</button>
                </div>
              </div>
            </>
          )}
        </div>
        <button onClick={saveTemplate} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm"><Save size={14} /> 양식 저장</button>
        <button onClick={exportPng} disabled={exporting !== null} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm disabled:opacity-50"><Pin size={14} /> {exporting === 'png' ? '생성 중…' : '스냅샷'}</button>
        <button onClick={exportPdf} disabled={exporting !== null} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-sm disabled:opacity-50"><FileDown size={14} /> {exporting === 'pdf' ? '생성 중…' : 'PDF'}</button>
        <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"><Download size={14} /> Excel</button>
      </div>
      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg">{toast}</div>}
      <input ref={tplFileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importTemplatesFromFile(f); e.target.value = '' }} />

      {/* 프리셋 */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">보고서 유형</span>
        {Object.entries(PRESETS).map(([id, p]) => (
          <button key={id} onClick={() => applyPreset(id)} className={`flex flex-col items-start px-3.5 py-2 rounded-xl border text-sm font-bold transition ${preset === id ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'}`}>
            <span>{p.emoji} {p.label}</span>
            <span className={`text-[10.5px] font-medium ${preset === id ? 'text-emerald-600' : 'text-gray-400'}`}>{p.sub}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
        {/* 좌측 설정 */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 lg:sticky lg:top-4">
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">기본 설정</p>
          <label className="block text-xs font-medium text-gray-500 mb-1">보고서 제목</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full h-9 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none mb-3" />
          <label className="block text-xs font-medium text-gray-500 mb-1">집계 기간</label>
          <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5 mb-3">
            {([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간'], ['yearly', '연간']] as [Period, string][]).map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} className={`flex-1 h-7 rounded-md text-xs font-semibold ${period === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>
            ))}
          </div>
          <label className="block text-xs font-medium text-gray-500 mb-1">담당자</label>
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)} className="w-full h-9 px-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none mb-3">
            <option value="">전체</option>
            {managers.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {/* 전기 대비 */}
          <div className="border border-gray-200 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <div><div className="text-[12.5px] font-bold text-gray-700">전기 대비 비교</div><div className="text-[10.5px] text-gray-400">증감 표시</div></div>
              <button onClick={() => setCmp((v) => !v)} className={`ml-auto relative w-9 h-5 rounded-full transition ${cmp ? 'bg-emerald-500' : 'bg-gray-300'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition ${cmp ? 'left-[18px]' : 'left-0.5'}`} /></button>
            </div>
            {cmp && period === 'monthly' && (
              <select value={cmpBase} onChange={(e) => setCmpBase(e.target.value as any)} className="w-full h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white mt-2.5 outline-none">
                <option value="prev">전월 대비</option>
                <option value="ya">전년 동월 대비</option>
              </select>
            )}
          </div>

          {/* 블록 구성 */}
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mt-5 mb-2.5">블록 구성</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
            <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {blocks.map((b) => {
                  const meta = BLOCK_META[b.id]
                  return (
                    <SortableBlock key={b.id} id={b.id} render={(listeners: any, attributes: any) => (
                        <div className={`border rounded-xl overflow-hidden ${b.on ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'}`}>
                          <div className="flex items-center gap-2 px-2.5 py-2">
                            <button {...listeners} {...attributes} className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"><GripVertical size={15} /></button>
                            <span className={`w-7 h-7 rounded-lg grid place-items-center text-sm ${meta.iconBg}`}>{meta.icon}</span>
                            <div className="min-w-0"><div className="text-[13px] font-bold text-gray-800 truncate">{meta.name}</div><div className="text-[10.5px] text-gray-400 truncate">{meta.desc}</div></div>
                            <button onClick={() => setOpenOpt((o) => o === b.id ? null : b.id)} className={`ml-auto p-1.5 rounded-md ${openOpt === b.id ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:bg-gray-100'}`}><Settings2 size={14} /></button>
                            <button onClick={() => toggleBlock(b.id)} className={`relative w-9 h-5 rounded-full transition ${b.on ? 'bg-emerald-500' : 'bg-gray-300'}`}><span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition ${b.on ? 'left-[18px]' : 'left-0.5'}`} /></button>
                          </div>
                          {openOpt === b.id && <div className="px-3 pb-3 pt-1 border-t border-gray-100 bg-gray-50/50">{renderOptions(b.id)}</div>}
                        </div>
                      )} />
                  )
                })}
              </div>
            </SortableContext>
          </DndContext>
          <p className="text-[11px] text-gray-400 mt-2.5 leading-relaxed">토글로 포함/제외, ⠿ 드래그로 순서 변경, ⚙로 세부옵션. 오른쪽 미리보기에 즉시 반영됩니다.</p>
        </div>

        {/* 우측 미리보기 */}
        <div className="bg-gray-100 rounded-2xl p-4 sm:p-6 overflow-x-auto">
          <div ref={previewRef} className="max-w-[760px] mx-auto bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-slate-800 text-white px-6 py-5">
              <div className="text-xl font-bold">{title || '제목 없음'}</div>
              <div className="text-xs text-slate-300 mt-1.5">webcash 하나CMS팀 · 생성일 {todayLabel()} · {periodLabel}{managerFilter ? ` · ${managerFilter}` : ''}{cmp ? ` · ${baseLabel} 대비` : ''}</div>
            </div>
            <div className="px-6 py-6 flex flex-col gap-6">
              {blocks.filter((b) => b.on).length === 0 ? (
                <p className="text-center py-16 text-gray-300 text-sm">포함된 블록이 없습니다. 왼쪽에서 블록을 켜주세요.</p>
              ) : blocks.filter((b) => b.on).map((b) => (
                <div key={b.id}>
                  <p className="text-sm font-bold text-gray-800 mb-3 pl-2.5 border-l-[3px] border-emerald-500">{BLOCK_META[b.id].name}</p>
                  {renderPreview(b.id)}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
