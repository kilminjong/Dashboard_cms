import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchCustomers } from '../lib/googleSheets'
import { Target, Settings, TrendingUp, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react'

interface KpiItem {
  id: string
  year: number
  kpi_name: string
  kpi_category: string
  target_value: number
  unit: string
  description: string
  sort_order: number
}

export default function KpiDashboard() {
  const [kpis, setKpis] = useState<KpiItem[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])

  useEffect(() => {
    fetchCustomers().then((d) => setCustomers(d || [])).catch(() => {})
  }, [])

  useEffect(() => {
    ;(async () => {
      setLoading(true)
      try {
        const { data } = await supabase.from('kpi_targets').select('*').order('sort_order').order('created_at')
        const all = (data || []) as KpiItem[]
        setKpis(all.filter((k) => k.year === selectedYear))
        const years = [...new Set(all.map((k) => k.year))].sort((a, b) => b - a)
        const cur = new Date().getFullYear()
        if (!years.includes(cur)) years.unshift(cur)
        setAvailableYears(years)
      } catch { setKpis([]); setAvailableYears([new Date().getFullYear()]) }
      setLoading(false)
    })()
  }, [selectedYear])

  // ── 집계 ──
  const now = new Date()
  const Y = selectedYear
  const terminated = customers.filter((c) => c.management_type === '해지' || c.termination_date)
  const yearNew = customers.filter((c) => c.reception_date?.startsWith(`${Y}`)).length
  const yearTerm = terminated.filter((c) => c.termination_date?.startsWith(`${Y}`)).length
  const yearOpened = customers.filter((c) => (c.opening_status === '개설완료' || c.opening_status === '이행완료') && c.opening_date?.startsWith(`${Y}`)).length
  const opened = customers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length
  const unopened = customers.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료' && c.opening_status !== '개설취소').length
  const convRate = customers.length > 0 ? Math.round((opened / customers.length) * 100) : 0

  const calcCurrent = (kpi: KpiItem): number => {
    const name = (kpi.kpi_name || '').toLowerCase()
    if (name.includes('신규')) return yearNew
    if (name.includes('해지')) return yearTerm
    if (name.includes('개설완료') || name.includes('완료')) return yearOpened
    if (name.includes('전환') || name.includes('유치율')) return convRate
    if (name.includes('미개설')) return unopened
    if (name.includes('유지')) return customers.length > 0 ? Math.round(((customers.length - terminated.length) / customers.length) * 100) : 0
    if (name.includes('순증')) return yearNew - yearTerm
    if (name.includes('전체') || name.includes('총')) return customers.length
    return 0
  }

  const rows = useMemo(() => kpis.map((k) => {
    const current = calcCurrent(k)
    const target = Number(k.target_value) || 0
    const rate = target > 0 ? Math.round((current / target) * 100) : 0
    const status = rate >= 80 ? 'green' : rate >= 50 ? 'yellow' : 'red'
    return { ...k, current, target, rate, status }
  }), [kpis, customers, selectedYear])

  const summary = {
    total: rows.length,
    avg: rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.rate, 0) / rows.length) : 0,
    green: rows.filter((r) => r.status === 'green').length,
    yellow: rows.filter((r) => r.status === 'yellow').length,
    red: rows.filter((r) => r.status === 'red').length,
  }

  const grouped: Record<string, typeof rows> = {}
  rows.forEach((r) => { (grouped[r.kpi_category] ||= []).push(r) })

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">KPI 현황</h2>
          <p className="text-sm text-gray-400 mt-0.5">{Y}년 목표 대비 실시간 달성 현황 · 기준일 {now.toISOString().split('T')[0]}</p>
        </div>
        <div className="flex gap-2">
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
            {availableYears.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <Link to="/kpi-settings" className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">
            <Settings size={15} /> 목표 설정
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Target size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-3">{Y}년에 등록된 KPI 목표가 없습니다.</p>
          <Link to="/kpi-settings" className="inline-flex items-center gap-1.5 text-emerald-600 text-sm hover:underline"><Settings size={14} /> 목표 설정하러 가기</Link>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1"><Target size={14} className="text-gray-400" /><p className="text-xs text-gray-500">전체 KPI</p></div>
              <p className="text-2xl font-bold text-gray-800">{summary.total}<span className="text-sm font-normal text-gray-400 ml-0.5">개</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1"><TrendingUp size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">평균 달성률</p></div>
              <p className="text-2xl font-bold text-emerald-600">{summary.avg}<span className="text-sm font-normal text-gray-400 ml-0.5">%</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1"><CheckCircle2 size={14} className="text-emerald-500" /><p className="text-xs text-gray-500">정상 (80%+)</p></div>
              <p className="text-2xl font-bold text-gray-800">{summary.green}<span className="text-sm font-normal text-gray-400 ml-0.5">개</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-1"><AlertTriangle size={14} className="text-amber-500" /><p className="text-xs text-gray-500">주의·부진</p></div>
              <p className="text-2xl font-bold text-gray-800">{summary.yellow + summary.red}<span className="text-sm font-normal text-gray-400 ml-0.5">개</span></p>
            </div>
          </div>

          {/* 카테고리별 KPI */}
          <div className="space-y-5">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="w-1 h-4 bg-emerald-500 rounded"></div>
                  <h3 className="font-semibold text-gray-700 text-sm">{cat}</h3>
                  <span className="text-xs text-gray-400">{items.length}개</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map((k) => {
                    const bar = k.status === 'green' ? 'bg-emerald-500' : k.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                    const bg = k.status === 'green' ? 'bg-emerald-50 border-emerald-200' : k.status === 'yellow' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'
                    const txt = k.status === 'green' ? 'text-emerald-700' : k.status === 'yellow' ? 'text-amber-700' : 'text-red-700'
                    const StatusIcon = k.status === 'green' ? CheckCircle2 : k.status === 'yellow' ? AlertTriangle : XCircle
                    return (
                      <div key={k.id} className={`rounded-xl border p-4 ${bg}`}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-800 text-sm truncate">{k.kpi_name}</p>
                            {k.description && <p className="text-xs text-gray-500 mt-0.5 truncate">{k.description}</p>}
                          </div>
                          <div className={`flex items-center gap-1 shrink-0 ml-2 ${txt}`}><StatusIcon size={14} /><span className="text-lg font-bold">{k.rate}%</span></div>
                        </div>
                        <div className="flex items-baseline gap-1 mb-2">
                          <span className="text-2xl font-bold text-gray-800 tabular-nums">{k.current.toLocaleString()}</span>
                          <span className="text-xs text-gray-500">/ {k.target.toLocaleString()} {k.unit}</span>
                        </div>
                        <div className="w-full bg-white/70 rounded-full h-2 overflow-hidden">
                          <div className={`h-full rounded-full ${bar} transition-all`} style={{ width: `${Math.min(k.rate, 100)}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-400 mt-5">* 현재값은 고객 데이터에서 KPI 지표명(신규·해지·완료·전환·미개설·유지·순증 등)에 따라 자동 집계됩니다. 목표값 수정은 ‘목표 설정’에서 가능합니다.</p>
        </>
      )}
    </div>
  )
}
