import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { supabase } from '../lib/supabase'
import { Download, Target, Settings, TrendingUp, TrendingDown, Minus, BarChart3, List, Table as TableIcon, GripVertical, FileDown, LayoutGrid, RotateCcw } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import * as XLSX from 'xlsx-js-style'
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove, SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

const DEFAULT_ORDER = ['kpi', 'indicators', 'trend', 'charts']
const STORAGE_KEY = 'reports.periodic.layout'

function SortableSection({ id, children, editMode }: { id: string; children: React.ReactNode; editMode: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: !editMode })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }
  return (
    <div ref={setNodeRef} style={style} className={`relative ${editMode ? 'ring-2 ring-dashed ring-emerald-300 rounded-xl' : ''}`}>
      {editMode && (
        <button
          {...attributes}
          {...listeners}
          className="absolute -left-3 top-3 bg-emerald-500 hover:bg-emerald-600 text-white p-1.5 rounded-lg shadow-lg cursor-grab active:cursor-grabbing z-20"
          title="드래그하여 순서 변경"
        >
          <GripVertical size={14} />
        </button>
      )}
      {children}
    </div>
  )
}

type ReportTab = 'periodic' | 'manager' | 'unopened' | 'marketing'
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'
const PIE_COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444']

export default function Reports() {
  const { tab: urlTab } = useParams<{ tab: string }>()
  const tab: ReportTab = (['periodic', 'manager', 'unopened', 'marketing'].includes(urlTab || '') ? urlTab : 'periodic') as ReportTab
  const [period, setPeriod] = useState<Period>('weekly')
  const [managerPeriod, setManagerPeriod] = useState<Period>('monthly')
  const [customers, setCustomers] = useState<any[]>([])
  const [kpis, setKpis] = useState<any[]>([])
  const [trendView, setTrendView] = useState<'chart' | 'list'>('chart')
  const [managerView, setManagerView] = useState<'table' | 'chart'>('table')
  const [erpView, setErpView] = useState<'chart' | 'list'>('chart')
  const [loading, setLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any[][]>([])
  const [previewTitle, setPreviewTitle] = useState('')
  const [editMode, setEditMode] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [sectionOrder, setSectionOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return DEFAULT_ORDER
      const parsed = JSON.parse(saved)
      if (!Array.isArray(parsed)) return DEFAULT_ORDER
      const missing = DEFAULT_ORDER.filter((x) => !parsed.includes(x))
      return [...parsed, ...missing]
    } catch { return DEFAULT_ORDER }
  })
  const pdfRef = useRef<HTMLDivElement>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const currentYear = new Date().getFullYear()

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(sectionOrder)) }, [sectionOrder])

  const handleDragEnd = (e: any) => {
    const { active, over } = e
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIdx = items.indexOf(active.id)
        const newIdx = items.indexOf(over.id)
        if (oldIdx < 0 || newIdx < 0) return items
        return arrayMove(items, oldIdx, newIdx)
      })
    }
  }

  const resetLayout = () => {
    setSectionOrder(DEFAULT_ORDER)
    localStorage.removeItem(STORAGE_KEY)
  }

  const exportPdf = async () => {
    if (!pdfRef.current) return
    setExportingPdf(true)
    try {
      const canvas = await html2canvas(pdfRef.current, {
        scale: 2,
        backgroundColor: '#f9fafb',
        logging: false,
        useCORS: true,
      })
      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const pageWidth = 210
      const pageHeight = 297
      const margin = 10
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width
      const printableHeight = pageHeight - margin * 2

      if (imgHeight <= printableHeight) {
        pdf.addImage(imgData, 'PNG', margin, margin, imgWidth, imgHeight)
      } else {
        let heightLeft = imgHeight
        let position = margin
        pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
        heightLeft -= printableHeight
        while (heightLeft > 0) {
          position = margin - (imgHeight - heightLeft)
          pdf.addPage()
          pdf.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight)
          heightLeft -= printableHeight
        }
      }
      const titleMap: Record<string, string> = { periodic: '업무보고서', manager: '담당자실적', unopened: '미개설관리', marketing: '마케팅보고서' }
      pdf.save(`${titleMap[tab] || '보고서'}_${today}.pdf`)
    } catch (err) {
      alert('PDF 생성 실패: ' + String((err as any)?.message || err))
    } finally {
      setExportingPdf(false)
    }
  }

  useEffect(() => {
    fetchCustomers().then((data) => { setCustomers(data || []); setLoading(false) }).catch(() => setLoading(false))
    supabase.from('kpi_targets').select('*').eq('year', currentYear).order('sort_order').then(({ data }) => setKpis(data || []))
  }, [currentYear])

  const now = new Date(); const today = now.toISOString().split('T')[0]
  const yesterdayStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString().split('T')[0]
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthKey = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const weekStartStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString().split('T')[0]
  const lastWeekStartStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() - 6).toISOString().split('T')[0]
  const lastWeekEndStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString().split('T')[0]

  const todayNew = customers.filter((c) => c.reception_date === today).length
  const yesterdayNew = customers.filter((c) => c.reception_date === yesterdayStr).length
  const thisWeekNew = customers.filter((c) => c.reception_date >= weekStartStr && c.reception_date <= today).length
  const lastWeekNew = customers.filter((c) => c.reception_date >= lastWeekStartStr && c.reception_date <= lastWeekEndStr).length
  const thisMonthNew = customers.filter((c) => c.reception_date?.startsWith(thisMonthKey)).length
  const lastMonthNew = customers.filter((c) => c.reception_date?.startsWith(lastMonthKey)).length
  const thisYearNew = customers.filter((c) => c.reception_date?.startsWith(String(now.getFullYear()))).length
  const sc = { opened: customers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length, waiting: customers.filter((c) => c.opening_status === '개설대기').length, progress: customers.filter((c) => c.opening_status === '개설진행').length, canceled: customers.filter((c) => c.opening_status === '개설취소').length }

  const getPeriodData = (p: Period) => {
    if (p === 'daily') return Array.from({ length: 14 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i); return { label: `${d.getMonth() + 1}/${d.getDate()}`, count: customers.filter((c) => c.reception_date === d.toISOString().split('T')[0]).length } })
    if (p === 'weekly') return Array.from({ length: 8 }, (_, i) => { const ws = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (7 - i) * 7 - now.getDay() + 1); const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6); return { label: `${ws.getMonth() + 1}/${ws.getDate()}~${we.getMonth() + 1}/${we.getDate()}`, count: customers.filter((c) => c.reception_date >= ws.toISOString().split('T')[0] && c.reception_date <= we.toISOString().split('T')[0]).length } })
    if (p === 'monthly') return Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return { label: `${d.getMonth() + 1}월`, count: customers.filter((c) => c.reception_date?.startsWith(k)).length } })
    return Array.from({ length: 5 }, (_, i) => { const y = now.getFullYear() - 4 + i; return { label: `${y}년`, count: customers.filter((c) => c.reception_date?.startsWith(String(y))).length } })
  }

  const mDateFrom = managerPeriod === 'daily' ? today : managerPeriod === 'weekly' ? weekStartStr : managerPeriod === 'monthly' ? `${thisMonthKey}-01` : `${now.getFullYear()}-01-01`
  const inPeriod = (d?: string) => !!d && d >= mDateFrom && d <= today
  const mm: Record<string, { total: number; periodNew: number; periodDone: number; periodCancel: number; curWaiting: number; curProgress: number }> = {}
  customers.forEach((c) => {
    if (!c.manager) return
    if (!mm[c.manager]) mm[c.manager] = { total: 0, periodNew: 0, periodDone: 0, periodCancel: 0, curWaiting: 0, curProgress: 0 }
    mm[c.manager].total++
    if (inPeriod(c.reception_date)) mm[c.manager].periodNew++
    if ((c.opening_status === '개설완료' || c.opening_status === '이행완료') && inPeriod(c.opening_date)) mm[c.manager].periodDone++
    if (inPeriod(c.termination_date)) mm[c.manager].periodCancel++
    if (c.opening_status === '개설대기') mm[c.manager].curWaiting++
    if (c.opening_status === '개설진행') mm[c.manager].curProgress++
  })
  const managerData = Object.entries(mm).sort((a, b) => (b[1].periodNew + b[1].periodDone) - (a[1].periodNew + a[1].periodDone) || b[1].total - a[1].total)

  const unopened = customers.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료' && c.opening_status !== '개설취소')
  const getDays = (c: any) => c.reception_date ? Math.floor((now.getTime() - new Date(c.reception_date).getTime()) / 86400000) : 0
  const u30 = unopened.filter((c) => getDays(c) <= 30), u3090 = unopened.filter((c) => { const d = getDays(c); return d > 30 && d <= 90 }), u90 = unopened.filter((c) => getDays(c) > 90)
  const avgDays = unopened.length > 0 ? Math.round(unopened.reduce((s, c) => s + getDays(c), 0) / unopened.length) : 0
  const uByMgr: Record<string, number> = {}; unopened.forEach((c) => { if (c.manager) uByMgr[c.manager] = (uByMgr[c.manager] || 0) + 1 })
  const uMgrData = Object.entries(uByMgr).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  const erpMap: Record<string, number> = {}; customers.forEach((c) => { if (c.erp_company) erpMap[c.erp_company] = (erpMap[c.erp_company] || 0) + 1 })
  const erpData = Object.entries(erpMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

  // 해지 고객 통계
  const terminated = customers.filter((c) => c.management_type === '해지' || c.termination_date)
  const thisMonthTerminated = terminated.filter((c) => c.termination_date?.startsWith(thisMonthKey)).length
  const lastMonthTerminated = terminated.filter((c) => c.termination_date?.startsWith(lastMonthKey)).length
  const thisWeekTerminated = terminated.filter((c) => c.termination_date && c.termination_date >= weekStartStr && c.termination_date <= today).length
  const thisYearTerminated = terminated.filter((c) => c.termination_date?.startsWith(String(now.getFullYear()))).length

  const pct = (n: number, total: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'

  const diff = (curr: number, prev: number, label: string) => {
    const d = curr - prev
    if (prev === 0 && curr === 0) return { text: `${label} 0건`, color: 'text-gray-400', icon: Minus }
    if (d > 0) return { text: `${label} 대비 +${d}건`, color: 'text-emerald-600', icon: TrendingUp }
    if (d < 0) return { text: `${label} 대비 ${d}건`, color: 'text-red-500', icon: TrendingDown }
    return { text: `${label} 대비 동일`, color: 'text-gray-400', icon: Minus }
  }

  const calcKpiCurrent = (kpi: any): number => {
    const name = (kpi.kpi_name || '').toLowerCase()
    if (name.includes('신규')) return thisYearNew
    if (name.includes('해지')) return thisYearTerminated
    if (name.includes('개설완료') || name.includes('완료')) return customers.filter((c) => (c.opening_status === '개설완료' || c.opening_status === '이행완료') && c.opening_date?.startsWith(String(currentYear))).length
    if (name.includes('전환') || name.includes('유치율')) return customers.length > 0 ? Math.round((sc.opened / customers.length) * 100) : 0
    if (name.includes('미개설')) return unopened.length
    if (name.includes('유지')) return customers.length > 0 ? Math.round(((customers.length - terminated.length) / customers.length) * 100) : 0
    if (name.includes('순증')) return thisYearNew - thisYearTerminated
    if (name.includes('전체') || name.includes('총')) return customers.length
    return 0
  }

  const kpiAchievements = kpis.map((k) => {
    const current = calcKpiCurrent(k)
    const target = Number(k.target_value) || 0
    const rate = target > 0 ? Math.round((current / target) * 100) : 0
    const status = rate >= 80 ? 'green' : rate >= 50 ? 'yellow' : 'red'
    return { ...k, current, target, rate, status }
  })

  const genExcel = (): { data: any[][]; title: string } => {
    const rd = `보고서 생성일: ${today}`
    const pl = period === 'daily' ? '일간' : period === 'weekly' ? '주간' : period === 'monthly' ? '월간' : '연간'

    if (tab === 'periodic') {
      const kpiRows: any[][] = kpiAchievements.length > 0 ? [
        [`[ ${currentYear}년 KPI 달성 현황 ]`, '', '', '', '', ''],
        ['KPI', '카테고리', '현재', '목표', '달성률', '상태'],
        ...kpiAchievements.map((k) => [k.kpi_name, k.kpi_category, `${k.current} ${k.unit}`, `${k.target} ${k.unit}`, `${k.rate}%`, k.status === 'green' ? '정상' : k.status === 'yellow' ? '주의' : '부진']),
        [],
      ] : []
      return { title: `${pl} 업무 보고서`, data: [
        [`webcash 하나CMS팀 - ${pl} 업무 보고서`, '', '', '', '', ''],
        [rd, '', '', '', '', ''],
        [],
        ...kpiRows,
        ['[ 핵심 지표 ]', '', '', '', '', ''],
        ['구분', '신규 인입', '해지', '순증감', '', ''],
        ['이번 주', thisWeekNew, thisWeekTerminated, thisWeekNew - thisWeekTerminated, '', ''],
        ['이번 달', thisMonthNew, thisMonthTerminated, thisMonthNew - thisMonthTerminated, '', ''],
        ['전월', lastMonthNew, lastMonthTerminated, lastMonthNew - lastMonthTerminated, '', ''],
        ['올해 누적', thisYearNew, thisYearTerminated, thisYearNew - thisYearTerminated, '', ''],
        [],
        ['[ 전체 현황 ]', '', '', '', '', ''],
        ['구분', '건수', '비율', '', '', ''],
        ['전체 고객', customers.length, '100%', '', '', ''],
        ['개설완료', sc.opened, pct(sc.opened, customers.length), '', '', ''],
        ['개설대기', sc.waiting, pct(sc.waiting, customers.length), '', '', ''],
        ['개설진행', sc.progress, pct(sc.progress, customers.length), '', '', ''],
        ['개설취소', sc.canceled, pct(sc.canceled, customers.length), '', '', ''],
        ['해지 고객', terminated.length, pct(terminated.length, customers.length), '', '', ''],
        [],
        [`[ ${pl} 신규 접수 추이 ]`, '', '', '', '', ''],
        ['기간', '신규 인입', '', '', '', ''],
        ...getPeriodData(period).map((d) => [d.label, d.count, '', '', '', '']),
      ]}
    }
    if (tab === 'manager') {
      const mpl = managerPeriod === 'daily' ? '금일' : managerPeriod === 'weekly' ? '금주' : managerPeriod === 'monthly' ? '금월' : '올해'
      return { title: `담당자별 실적 (${mpl})`, data: [
        [`webcash 하나CMS팀 - 담당자별 실적 보고서 (${mpl})`, '', '', '', '', '', '', ''],
        [rd, '', '', '', '', '', '', ''],
        [`집계 기준: ${mDateFrom} ~ ${today} · 접수/개설이행/해지 각 일자 기준`, '', '', '', '', '', '', ''],
        [],
        ['[ 담당자별 실적 현황 ]', '', '', '', '', '', '', ''],
        ['담당자', '전체(누적)', `${mpl} 접수`, `${mpl} 완료`, `${mpl} 해지`, '현재 대기', '현재 진행', '전환율'],
        ...managerData.map(([n, s]) => [n, s.total, s.periodNew, s.periodDone, s.periodCancel, s.curWaiting, s.curProgress, s.periodNew > 0 ? `${Math.round((s.periodDone / s.periodNew) * 100)}%` : '-']),
      ]}
    }
    if (tab === 'unopened') {
      return { title: '미개설 관리', data: [
        ['webcash 하나CMS팀 - 미개설 고객 관리 보고서', '', '', '', '', '', ''],
        [rd, '', '', '', '', '', ''],
        [],
        ['[ 미개설 현황 요약 ]', '', '', '', '', '', ''],
        ['구분', '건수', '', '', '', '', ''],
        ['전체 미개설', unopened.length, '', '', '', '', ''],
        ['30일 이내', u30.length, '', '', '', '', ''],
        ['30~90일', u3090.length, '', '', '', '', ''],
        ['90일+', u90.length, '', '', '', '', ''],
        ['평균 미개설 기간', `${avgDays}일`, '', '', '', '', ''],
        [],
        ['[ 미개설 고객 상세 목록 ]', '', '', '', '', '', ''],
        ['고객명', '고객번호', '사업자번호', '담당자', '접수일', '상태', '미개설일수'],
        ...unopened.sort((a, b) => getDays(b) - getDays(a)).map((c) => [c.customer_name, c.customer_number, c.business_number, c.manager, c.reception_date, c.opening_status, getDays(c)]),
      ]}
    }
    return { title: '마케팅 보고서', data: [
      ['webcash 하나CMS팀 - 마케팅 보고서', '', '', '', '', ''],
      [rd, '', '', '', '', ''],
      [],
      ['[ 상품별 현황 ]', '', '', '', '', ''],
      ['상품', '고객수', '비고', '', '', ''],
      ['대시보드', '-', '데이터 연동 예정', '', '', ''],
      ['글로벌대시보드', '-', '데이터 연동 예정', '', '', ''],
      ['이음텍스', '-', '데이터 연동 예정', '', '', ''],
      ['MAU', '-', '데이터 연동 예정', '', '', ''],
      [],
      ['[ ERP 회사별 분포 ]', '', '', '', '', ''],
      ['ERP 회사', '고객수', '', '', '', ''],
      ...erpData.map((e) => [e.name, e.count, '', '', '', '']),
    ]}
  }

  const handleDownload = () => { const { data, title } = genExcel(); setPreviewData(data); setPreviewTitle(title); setShowPreview(true) }

  const confirmDownload = () => {
    const { data, title } = genExcel()
    const ws = XLSX.utils.aoa_to_sheet(data)

    const maxCols = Math.max(...data.map((r) => r.length))

    // 컬럼 너비: 한글은 영문보다 넓게
    ws['!cols'] = Array.from({ length: maxCols }, (_, ci) => {
      let maxLen = 10
      data.forEach((r) => {
        const v = String(r[ci] ?? '')
        const hangulLen = (v.match(/[\uAC00-\uD7AF]/g) || []).length
        const effLen = v.length + hangulLen * 0.8
        if (effLen > maxLen) maxLen = effLen
      })
      return { wch: Math.min(Math.max(maxLen + 2, 12), 40) }
    })

    // 행 높이
    ws['!rows'] = data.map((row, ri) => {
      if (ri === 0) return { hpt: 30 }
      if (row[0] != null && String(row[0]).startsWith('[')) return { hpt: 22 }
      return { hpt: 18 }
    })

    // 제목행 병합 + 생성일/기준 병합
    const merges: any[] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } }]
    if (data[1]?.[0] && String(data[1][0]).startsWith('보고서 생성일')) merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } })
    if (data[2]?.[0] && String(data[2][0]).startsWith('집계 기준')) merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: maxCols - 1 } })
    ws['!merges'] = merges

    // 고정: 제목행 아래 고정
    ws['!freeze'] = { xSplit: 0, ySplit: 3 }

    const thinBorder = { style: 'thin', color: { rgb: 'D1D5DB' } }
    const border = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder }

    // 헤더행 위치 탐지: 바로 전이 섹션([)이거나 빈줄이고 본인은 텍스트인 경우
    const isHeaderRow = (ri: number) => {
      if (ri === 0) return false
      const row = data[ri]
      if (!row || row.length === 0) return false
      if (String(row[0] ?? '').startsWith('[')) return false
      if (String(row[0] ?? '').startsWith('보고서 생성일')) return false
      if (String(row[0] ?? '').startsWith('집계 기준')) return false
      const prev = data[ri - 1]
      if (!prev || prev.length === 0) return false
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
          // 일반 셀
          const isNum = typeof val === 'number'
          const isFirstCol = ci === 0
          const isStatus = typeof val === 'string' && ['정상', '주의', '부진'].includes(val)
          let fill: any = undefined
          let color = { rgb: '111827' }
          if (isStatus) {
            if (val === '정상') { fill = { patternType: 'solid', fgColor: { rgb: 'D1FAE5' } }; color = { rgb: '065F46' } }
            else if (val === '주의') { fill = { patternType: 'solid', fgColor: { rgb: 'FEF3C7' } }; color = { rgb: '92400E' } }
            else { fill = { patternType: 'solid', fgColor: { rgb: 'FEE2E2' } }; color = { rgb: '991B1B' } }
          } else if (ri % 2 === 1) {
            fill = { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } }
          }
          cell.s = {
            font: { sz: 10, color, name: '맑은 고딕', bold: isFirstCol && !isNum },
            alignment: { horizontal: isNum ? 'right' : isFirstCol ? 'left' : 'center', vertical: 'center' },
            fill,
            border,
          }
          if (isNum) cell.z = '#,##0'
        }
      }
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31))
    XLSX.writeFile(wb, `${title}_${today}.xlsx`)
    setShowPreview(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tab === 'periodic' ? '업무 보고서' : tab === 'manager' ? '담당자 실적' : tab === 'unopened' ? '미개설 관리' : '마케팅 보고서'}</h2>
          <p className="text-sm text-gray-400 mt-0.5">기준일: {today} · 전체 {customers.length.toLocaleString()}건</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {tab === 'periodic' && (
            <>
              <button onClick={() => setEditMode((v) => !v)} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition text-sm ${editMode ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`} title="섹션 순서 편집">
                <LayoutGrid size={14} /> {editMode ? '편집 완료' : '레이아웃 편집'}
              </button>
              {editMode && (
                <button onClick={resetLayout} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 text-sm" title="기본 순서로 복원">
                  <RotateCcw size={13} /> 초기화
                </button>
              )}
            </>
          )}
          <button onClick={exportPdf} disabled={exportingPdf} className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm disabled:opacity-50">
            <FileDown size={14} /> {exportingPdf ? '생성 중...' : 'PDF 출력'}
          </button>
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm"><Download size={14} /> Excel</button>
        </div>
      </div>

      <div ref={pdfRef} className="bg-gray-50">

      {tab === 'periodic' && (() => {
        const sections: Record<string, React.ReactNode> = {
          kpi: (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={18} className="text-emerald-600" />
              <h3 className="font-semibold text-gray-800">{currentYear}년 KPI 달성 현황</h3>
              <span className="text-xs text-gray-400">({kpiAchievements.length}개 항목)</span>
            </div>
            <Link to="/kpi-settings" className="flex items-center gap-1 text-xs text-gray-500 hover:text-emerald-600 transition"><Settings size={13} /> KPI 관리</Link>
          </div>
          {kpiAchievements.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-400">
              등록된 KPI가 없습니다. <Link to="/kpi-settings" className="text-emerald-600 hover:underline">KPI 관리 →</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {kpiAchievements.map((k) => {
                const bar = k.status === 'green' ? 'bg-emerald-500' : k.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                const bg = k.status === 'green' ? 'bg-emerald-50 border-emerald-200' : k.status === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                const txt = k.status === 'green' ? 'text-emerald-700' : k.status === 'yellow' ? 'text-amber-700' : 'text-red-700'
                return (
                  <div key={k.id} className={`rounded-lg border p-3 ${bg}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-xs text-gray-500">{k.kpi_category}</p>
                        <p className="font-semibold text-gray-800 text-sm">{k.kpi_name}</p>
                      </div>
                      <span className={`text-lg font-bold ${txt}`}>{k.rate}%</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-xl font-bold text-gray-800">{k.current.toLocaleString()}</span>
                      <span className="text-xs text-gray-500">/ {k.target.toLocaleString()} {k.unit}</span>
                    </div>
                    <div className="w-full bg-white/70 rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.min(k.rate, 100)}%` }} />
                    </div>
                    {k.description && <p className="text-xs text-gray-500 mt-1.5 truncate">{k.description}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
          ),
          indicators: (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[
            { l: '오늘 신규', v: todayNew, cmp: diff(todayNew, yesterdayNew, '어제') },
            { l: '이번 주 신규', v: thisWeekNew, cmp: diff(thisWeekNew, lastWeekNew, '지난 주') },
            { l: '이번 달 신규', v: thisMonthNew, cmp: diff(thisMonthNew, lastMonthNew, '전월') },
            { l: '해지 고객 (금월)', v: thisMonthTerminated, cmp: diff(thisMonthTerminated, lastMonthTerminated, '전월') },
            { l: '순증감 (금월)', v: thisMonthNew - thisMonthTerminated, cmp: diff(thisMonthNew - thisMonthTerminated, lastMonthNew - lastMonthTerminated, '전월') },
          ].map((c) => {
            const Icon = c.cmp.icon
            return (
              <div key={c.l} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{c.l}</p>
                <p className="text-2xl font-bold text-gray-800">{c.v.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span></p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${c.cmp.color}`}>
                  <Icon size={12} />
                  <span>{c.cmp.text}</span>
                </div>
              </div>
            )
          })}
        </div>
          ),
          trend: (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800">신규 접수 추이</h3>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-100 rounded-lg p-0.5">{([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간'], ['yearly', '연간']] as const).map(([k, l]) => (<button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${period === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>))}</div>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setTrendView('chart')} className={`p-1.5 rounded-md transition ${trendView === 'chart' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`} title="차트"><BarChart3 size={14} /></button>
                <button onClick={() => setTrendView('list')} className={`p-1.5 rounded-md transition ${trendView === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`} title="리스트"><List size={14} /></button>
              </div>
            </div>
          </div>
          {trendView === 'chart' ? (
            <ResponsiveContainer width="100%" height={240}><BarChart data={getPeriodData(period)}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
          ) : (
            <div className="overflow-x-auto max-h-[240px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0"><tr><th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">기간</th><th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">신규 인입</th><th className="text-right px-4 py-2 text-xs font-semibold text-gray-600">비율</th></tr></thead>
                <tbody className="divide-y divide-gray-50">{(() => {
                  const d = getPeriodData(period)
                  const max = Math.max(...d.map((x) => x.count), 1)
                  return d.map((r, i) => (
                    <tr key={i} className={i % 2 ? 'bg-gray-50/50' : ''}>
                      <td className="px-4 py-2 font-medium text-gray-700">{r.label}</td>
                      <td className="text-right px-4 py-2 font-semibold text-emerald-600">{r.count.toLocaleString()}건</td>
                      <td className="text-right px-4 py-2"><div className="inline-flex items-center gap-2"><div className="w-24 bg-gray-100 rounded-full h-1.5"><div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(r.count / max) * 100}%` }} /></div><span className="text-xs text-gray-500 w-10 text-right">{Math.round((r.count / max) * 100)}%</span></div></td>
                    </tr>
                  ))
                })()}</tbody>
              </table>
            </div>
          )}
        </div>
          ),
          charts: (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">개설 상태</h3><div className="flex items-center"><ResponsiveContainer width="50%" height={160}><PieChart><Pie data={[{ name: '완료', value: sc.opened }, { name: '대기', value: sc.waiting }, { name: '진행', value: sc.progress }, { name: '취소', value: sc.canceled }]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>{PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /></PieChart></ResponsiveContainer><div className="w-1/2 space-y-1.5">{[['개설완료', sc.opened, PIE_COLORS[0]], ['개설대기', sc.waiting, PIE_COLORS[1]], ['개설진행', sc.progress, PIE_COLORS[2]], ['개설취소', sc.canceled, PIE_COLORS[3]]].map(([n, v, c]) => (<div key={n as string} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c as string }}></div><span className="text-xs text-gray-600">{n}</span></div><span className="text-xs font-semibold">{(v as number).toLocaleString()}</span></div>))}</div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">ERP 회사별</h3>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                <button onClick={() => setErpView('chart')} className={`p-1.5 rounded-md transition ${erpView === 'chart' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`} title="차트"><BarChart3 size={14} /></button>
                <button onClick={() => setErpView('list')} className={`p-1.5 rounded-md transition ${erpView === 'list' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-400'}`} title="리스트"><List size={14} /></button>
              </div>
            </div>
            {erpView === 'chart' ? (
              <ResponsiveContainer width="100%" height={160}><BarChart data={erpData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
            ) : (
              <div className="max-h-[160px] overflow-y-auto">{(() => {
                const max = Math.max(...erpData.map((e) => e.count), 1)
                return erpData.map((e) => (
                  <div key={e.name} className="flex items-center gap-2 py-1 text-xs">
                    <span className="w-24 truncate text-gray-700">{e.name}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5"><div className="h-full bg-amber-500 rounded-full" style={{ width: `${(e.count / max) * 100}%` }} /></div>
                    <span className="w-10 text-right font-semibold text-gray-700">{e.count}건</span>
                  </div>
                ))
              })()}</div>
            )}
          </div>
        </div>
          ),
        }
        return (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
            <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
              <div className="space-y-5">
                {sectionOrder.map((id) => sections[id] ? (
                  <SortableSection key={id} id={id} editMode={editMode}>
                    {sections[id]}
                  </SortableSection>
                ) : null)}
              </div>
            </SortableContext>
          </DndContext>
        )
      })()}

      {tab === 'manager' && (<div className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50 gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-800 text-sm">담당자별 실적</h3>
            <div className="flex items-center gap-2">
              <div className="flex bg-gray-200 rounded-lg p-0.5">{([['daily', '금일'], ['weekly', '금주'], ['monthly', '금월'], ['yearly', '올해']] as const).map(([k, l]) => (<button key={k} onClick={() => setManagerPeriod(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${managerPeriod === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>))}</div>
              <div className="flex bg-gray-200 rounded-lg p-0.5">
                <button onClick={() => setManagerView('table')} className={`p-1 rounded-md transition ${managerView === 'table' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`} title="테이블"><TableIcon size={14} /></button>
                <button onClick={() => setManagerView('chart')} className={`p-1 rounded-md transition ${managerView === 'chart' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`} title="차트"><BarChart3 size={14} /></button>
              </div>
            </div>
          </div>
          {managerView === 'chart' ? (
            <div className="p-5"><ResponsiveContainer width="100%" height={Math.max(managerData.length * 35, 200)}>
              <BarChart data={managerData.map(([n, s]) => ({ name: n, 접수: s.periodNew, 완료: s.periodDone, 해지: s.periodCancel }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={80} />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} />
                <Bar dataKey="접수" fill="#8b5cf6" />
                <Bar dataKey="완료" fill="#059669" />
                <Bar dataKey="해지" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer></div>
          ) : (() => {
            const pl = managerPeriod === 'daily' ? '금일' : managerPeriod === 'weekly' ? '금주' : managerPeriod === 'monthly' ? '금월' : '올해'
            return (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">담당자</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500">전체<br/><span className="text-[9px] font-normal">담당 누적</span></th><th className="text-center px-3 py-2.5 text-xs font-semibold text-purple-600">{pl} 접수<br/><span className="text-[9px] font-normal">접수일</span></th><th className="text-center px-3 py-2.5 text-xs font-semibold text-emerald-600">{pl} 완료<br/><span className="text-[9px] font-normal">개설/이행일</span></th><th className="text-center px-3 py-2.5 text-xs font-semibold text-red-600">{pl} 해지<br/><span className="text-[9px] font-normal">해지일</span></th><th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">현재 대기</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600">현재 진행</th><th className="text-center px-3 py-2.5 text-xs font-semibold">전환율<br/><span className="text-[9px] font-normal">완료/접수</span></th></tr></thead>
          <tbody className="divide-y divide-gray-50">{managerData.map(([name, s], i) => {
            const rate = s.periodNew > 0 ? Math.round((s.periodDone / s.periodNew) * 100) : 0
            const rateColor = s.periodNew === 0 ? 'bg-gray-100 text-gray-400' : rate >= 80 ? 'bg-emerald-100 text-emerald-700' : rate >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
            return (<tr key={name} className={`${i % 2 ? 'bg-gray-50/50' : ''} hover:bg-emerald-50/30`}><td className="px-4 py-2.5 font-medium">{name}</td><td className="text-center font-bold text-gray-700">{s.total}</td><td className="text-center text-purple-600 font-semibold">{s.periodNew}</td><td className="text-center text-emerald-600 font-semibold">{s.periodDone}</td><td className="text-center text-red-600">{s.periodCancel}</td><td className="text-center text-amber-600">{s.curWaiting}</td><td className="text-center text-blue-600">{s.curProgress}</td><td className="text-center"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${rateColor}`}>{s.periodNew === 0 ? '-' : `${rate}%`}</span></td></tr>)
          })}</tbody></table></div>
            )
          })()}
        </div>
      </div>)}

      {tab === 'unopened' && (<div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[{ l: '전체 미개설', v: unopened.length, c: 'text-gray-700' }, { l: '30일 이내', v: u30.length, c: 'text-emerald-600' }, { l: '30~90일', v: u3090.length, c: 'text-amber-600' }, { l: '90일+', v: u90.length, c: 'text-red-600' }, { l: '평균 기간', v: avgDays, c: 'text-blue-600' }].map((c) => (
            <div key={c.l} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 mb-1">{c.l}</p><p className={`text-2xl font-bold ${c.c}`}>{c.v.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">{c.l === '평균 기간' ? '일' : '건'}</span></p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">기간별 분포</h3><ResponsiveContainer width="100%" height={180}><BarChart data={[{ name: '30일 이내', count: u30.length }, { name: '30~90일', count: u3090.length }, { name: '90일+', count: u90.length }]}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{['#059669', '#f59e0b', '#ef4444'].map((c, i) => <Cell key={i} fill={c} />)}</Bar></BarChart></ResponsiveContainer></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">담당자별 미개설 TOP 10</h3><ResponsiveContainer width="100%" height={180}><BarChart data={uMgrData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" width={60} /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-red-50"><h3 className="font-semibold text-red-700 text-sm">장기 미개설 (90일+) - {u90.length}건</h3></div>
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto"><table className="w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="text-left px-4 py-2 text-xs font-semibold">고객명</th><th className="text-left px-3 py-2 text-xs">고객번호</th><th className="text-left px-3 py-2 text-xs">담당자</th><th className="text-left px-3 py-2 text-xs">접수일</th><th className="text-left px-3 py-2 text-xs">상태</th><th className="text-right px-4 py-2 text-xs text-red-600">미개설일수</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{u90.sort((a, b) => getDays(b) - getDays(a)).slice(0, 50).map((c, i) => {
            const days = getDays(c)
            const dayColor = days > 180 ? 'text-red-700 bg-red-50' : days > 120 ? 'text-red-600' : 'text-amber-600'
            return (<tr key={c.id} className={i % 2 ? 'bg-gray-50/50' : ''}><td className="px-4 py-2 font-medium">{c.customer_name}</td><td className="px-3 py-2 text-gray-600">{c.customer_number || '-'}</td><td className="px-3 py-2 text-gray-600">{c.manager || '-'}</td><td className="px-3 py-2 text-gray-600">{c.reception_date || '-'}</td><td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">{c.opening_status}</span></td><td className={`px-4 py-2 text-right font-bold ${dayColor} rounded`}>{days}일</td></tr>)
          })}</tbody></table></div>
        </div>
      </div>)}

      {tab === 'marketing' && (<div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><p className="text-sm text-amber-700">마케팅 데이터 연동 준비 중입니다. 상품별 데이터가 연동되면 자동 반영됩니다.</p></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{['대시보드', '글로벌대시보드', '이음텍스', 'MAU'].map((p) => (<div key={p} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 mb-1">{p}</p><p className="text-2xl font-bold text-gray-300">-</p><p className="text-xs text-gray-400 mt-0.5">연동 예정</p></div>))}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">ERP 회사별</h3><ResponsiveContainer width="100%" height={200}><BarChart data={erpData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">개설 전환율</h3><div className="text-center py-6"><p className="text-5xl font-bold text-emerald-600">{customers.length > 0 ? Math.round((sc.opened / customers.length) * 100) : 0}%</p><p className="text-sm text-gray-400 mt-2">완료 {sc.opened.toLocaleString()}건 / 전체 {customers.length.toLocaleString()}건</p></div></div>
        </div>
      </div>)}

      </div>{/* /pdfRef */}

      {showPreview && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h3 className="font-bold text-gray-800">Excel 미리보기</h3><p className="text-xs text-gray-400 mt-0.5">{previewTitle} · {today}</p></div><div className="flex gap-2"><button onClick={confirmDownload} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Download size={14} /> 다운로드</button><button onClick={() => setShowPreview(false)} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">닫기</button></div></div>
          <div className="flex-1 overflow-auto p-4"><div className="border border-gray-200 rounded-lg overflow-hidden"><table className="w-full text-sm"><tbody>{previewData.map((row, i) => {
            const isTitle = i === 0
            const isEmpty = row.length === 0
            const isSection = !isEmpty && row[0] != null && String(row[0]).startsWith('[')
            const cls = isTitle ? 'bg-slate-800 text-white font-bold' : isEmpty ? 'h-3' : isSection ? 'bg-gray-100 font-semibold' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
            return (<tr key={i} className={cls}>{isEmpty ? <td colSpan={10}></td> : row.map((cell: any, j: number) => (<td key={j} className={`px-3 py-1.5 border-b border-gray-100 whitespace-nowrap ${isTitle ? 'text-sm' : 'text-xs text-gray-700'}`}>{cell ?? ''}</td>))}</tr>)
          })}</tbody></table></div></div>
        </div>
      </div>)}
    </div>
  )
}
