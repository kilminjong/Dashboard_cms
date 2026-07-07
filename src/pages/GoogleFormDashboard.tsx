import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { loadBranchqRecords, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import {
  loadFormResponses, computeStats, participationByWeek, byWeekday, getWeekKey, formatKST,
  type FormResponse,
} from '../lib/googleForm'
import {
  ClipboardCheck, RefreshCw, ChevronRight, Users, MailCheck, TrendingUp,
  CalendarClock, AlertTriangle, Info, ArrowRight,
} from 'lucide-react'
import {
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ComposedChart, Bar, Line, BarChart,
} from 'recharts'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

export default function GoogleFormDashboard() {
  const navigate = useNavigate()
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = async () => {
    let cust: any[] = []
    try { cust = await fetchCustomers() } catch { /* 오프라인 */ }
    let recs = await loadBranchqRecords()
    // records에 사업자번호가 비어있으면 고객원장에서 보강
    if (cust && cust.length) {
      const byNum = new Map(cust.map((c) => [String(c.customer_number), c]))
      recs = recs.map((r) => ({ ...r, business_number: r.business_number || byNum.get(String(r.customer_number))?.business_number || '' }))
    }
    if ((!recs || recs.length === 0) && isDev) {
      recs = DEV_MOCK_CUSTOMERS.map((c) => ({ customer_number: c.customer_number, customer_name: c.customer_name, business_number: c.business_number, build_status: c.branchq_status }))
    }
    setRecords(recs)
    setResponses(await loadFormResponses())
  }

  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])

  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  // 발송 대상 (POC 고객) — 사업자번호를 매칭 키로 사용
  const targets = useMemo(() =>
    records.map((r) => ({ biz: String(r.business_number || '').replace(/[^0-9]/g, ''), name: r.customer_name || '-', cnum: r.customer_number }))
      .filter((t) => t.biz || t.name), [records])

  const stats = useMemo(() => computeStats(responses, targets.length), [responses, targets.length])
  const weekTrend = useMemo(() => participationByWeek(responses, targets.length, 8), [responses, targets.length])
  const weekdayDist = useMemo(() => byWeekday(responses), [responses])

  const thisWeek = getWeekKey(new Date().toISOString())
  const thisWeekResponderBiz = useMemo(() =>
    new Set(responses.filter((r) => getWeekKey(r.submitted_at) === thisWeek).map((r) => r.customer_number)), [responses, thisWeek])

  const nonParticipants = useMemo(() =>
    targets.filter((t) => !thisWeekResponderBiz.has(t.biz) && !thisWeekResponderBiz.has(t.name)), [targets, thisWeekResponderBiz])

  const recentResponses = useMemo(() =>
    [...responses].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)).slice(0, 8), [responses])

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  const cards = [
    { label: '발송 대상', value: stats.totalTargets, unit: '개사', icon: Users, tone: 'text-slate-600 bg-slate-50' },
    { label: '이번주 참여', value: stats.thisWeekCompanies, unit: '개사', icon: MailCheck, tone: 'text-emerald-600 bg-emerald-50' },
    { label: '이번주 참여율', value: stats.thisWeekRate, unit: '%', icon: TrendingUp, tone: 'text-blue-600 bg-blue-50' },
    { label: '누적 응답', value: stats.totalResponses, unit: '건', icon: ClipboardCheck, tone: 'text-violet-600 bg-violet-50' },
  ]

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><ClipboardCheck size={17} className="text-emerald-600" /></span>
          <h2 className="text-2xl font-bold text-gray-800">구글폼 대시보드</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/branchq/form/detail')} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition">
            상세관리 <ArrowRight size={15} />
          </button>
          <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-5">브랜치Q 고객 대상 주간 설문(구글폼) 참여 현황입니다. 매주 발송되며 응답은 구글시트에 자동 누적됩니다.</p>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs text-gray-500">{c.label}</p>
              <span className={`w-7 h-7 rounded-lg grid place-items-center ${c.tone}`}><c.icon size={15} /></span>
            </div>
            <p className="text-2xl font-bold text-gray-800">{c.value}<span className="text-sm font-normal text-gray-400 ml-0.5">{c.unit}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* 주차별 참여 추이 */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700 text-sm">주차별 참여 추이</h3>
            <span className="text-xs text-gray-400">최근 8주 · 막대=응답 업체수, 선=참여율</span>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <ComposedChart data={weekTrend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="l" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <YAxis yAxisId="r" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar yAxisId="l" dataKey="companies" name="응답 업체" fill="#34d399" radius={[4, 4, 0, 0]} barSize={26} />
              <Line yAxisId="r" type="monotone" dataKey="rate" name="참여율(%)" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 요일별 분포 */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-700 text-sm mb-3">응답 요일 분포</h3>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={weekdayDist} margin={{ top: 5, right: 8, left: -22, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="weekday" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="응답 수" fill="#a78bfa" radius={[4, 4, 0, 0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        {/* 최근 응답 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <CalendarClock size={15} className="text-gray-400" />
            <h3 className="font-semibold text-gray-700 text-sm">최근 응답</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {recentResponses.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-sm">아직 접수된 응답이 없습니다.</p>
            ) : recentResponses.map((r) => {
              const t = formatKST(r.submitted_at)
              return (
                <div key={r.id} onClick={() => navigate(`/branchq/form/detail?c=${encodeURIComponent(r.customer_number)}`)}
                  className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-emerald-50/30 cursor-pointer transition group">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold grid place-items-center shrink-0">{(r.customer_name || '?')[0]}</span>
                    <span className="font-medium text-gray-800 group-hover:text-emerald-700 truncate">{r.customer_name || r.respondent_email || '알수없음'}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs text-gray-400 tabular-nums">
                    <span>{t.date} ({t.weekday}) {t.time}</span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-500" />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 이번주 미참여 업체 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
            <AlertTriangle size={15} className="text-amber-500" />
            <h3 className="font-semibold text-gray-700 text-sm">이번주 미참여 업체</h3>
            <span className="ml-auto text-xs font-bold text-amber-600">{nonParticipants.length}개사</span>
          </div>
          <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
            {nonParticipants.length === 0 ? (
              <p className="text-center py-12 text-emerald-500 text-sm font-medium">🎉 이번주 대상 업체가 모두 참여했습니다!</p>
            ) : nonParticipants.map((t) => (
              <div key={t.biz || t.name} onClick={() => navigate(`/branchq/form/detail?c=${encodeURIComponent(t.biz || t.name)}`)}
                className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-amber-50/40 cursor-pointer transition group">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-medium text-gray-700 group-hover:text-amber-700 truncate">{t.name}</span>
                </div>
                <ChevronRight size={14} className="text-gray-300 group-hover:text-amber-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 연동 안내 (폼 미연결 시 힌트) */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900/80 leading-relaxed">
          <p className="font-semibold text-blue-800 mb-0.5">구글폼 연동 방법</p>
          구글폼 응답을 스프레드시트(<span className="font-mono text-xs bg-white px-1 py-0.5 rounded">form_responses</span> 탭)에 연결하면 이 대시보드에 자동 반영됩니다.
          응답을 고객과 매칭하려면 폼에 <b>필수 문항 "사업자번호"</b>를 추가하세요. 현재는 {isDev ? '데모(샘플) 데이터' : '연결 대기'} 상태입니다.
        </div>
      </div>
    </div>
  )
}
