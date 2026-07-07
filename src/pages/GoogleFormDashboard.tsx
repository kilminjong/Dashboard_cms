import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { loadBranchqRecords, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import { getPocStart, setPocStart } from '../lib/pocSettings'
import {
  loadFormResponses, computeStats, participationTrendPoc, byWeekday, getWeekKey, formatKST,
  answerDistributions, currentPocWeek, pocWeekSlots,
  type FormResponse,
} from '../lib/googleForm'
import {
  ClipboardCheck, RefreshCw, ChevronRight, Users, MailCheck, TrendingUp,
  CalendarClock, AlertTriangle, Info, ArrowRight, Rocket, PlayCircle, BarChart3, Download, TrendingDown,
} from 'lucide-react'
import * as XLSX from 'xlsx'

// 순위 배지 색상 (1등 금, 2등 은, 3등 동)
function rankTone(i: number): string {
  if (i === 0) return 'bg-amber-400 text-white'
  if (i === 1) return 'bg-slate-400 text-white'
  if (i === 2) return 'bg-orange-400 text-white'
  return 'bg-gray-200 text-gray-500'
}
import {
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, ComposedChart, Bar, Line, BarChart,
} from 'recharts'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

export default function GoogleFormDashboard() {
  const navigate = useNavigate()
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
  const [pocStart, setPocStartState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [showStartModal, setShowStartModal] = useState(false)
  const [starting, setStarting] = useState(false)

  const load = async () => {
    let cust: any[] = []
    try { cust = await fetchCustomers() } catch { /* 오프라인 */ }
    let recs = await loadBranchqRecords()
    if (cust && cust.length) {
      const byNum = new Map(cust.map((c) => [String(c.customer_number), c]))
      recs = recs.map((r) => ({ ...r, business_number: r.business_number || byNum.get(String(r.customer_number))?.business_number || '' }))
    }
    if ((!recs || recs.length === 0) && isDev) {
      recs = DEV_MOCK_CUSTOMERS.map((c) => ({ customer_number: c.customer_number, customer_name: c.customer_name, business_number: c.business_number, build_status: c.branchq_status }))
    }
    setRecords(recs)
    setResponses(await loadFormResponses())
    setPocStartState(await getPocStart())
  }

  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])

  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const confirmStart = async () => {
    setStarting(true)
    const today = new Date().toISOString().slice(0, 10)
    await setPocStart(today)
    setPocStartState(today)
    setStarting(false)
    setShowStartModal(false)
  }

  // 발송 대상 (POC 고객) — 사업자번호를 매칭 키로 사용
  const targets = useMemo(() =>
    records.map((r) => ({ biz: String(r.business_number || '').replace(/[^0-9]/g, ''), name: r.customer_name || '-', cnum: r.customer_number }))
      .filter((t) => t.biz || t.name), [records])

  const stats = useMemo(() => computeStats(responses, targets.length), [responses, targets.length])
  const weekTrend = useMemo(() => participationTrendPoc(responses, targets.length, pocStart, 10), [responses, targets.length, pocStart])
  const weekdayDist = useMemo(() => byWeekday(responses), [responses])
  const dists = useMemo(() => answerDistributions(responses), [responses])
  const choiceDists = dists.filter((d) => d.isChoice)
  const textDists = dists.filter((d) => !d.isChoice)
  const pocWeek = currentPocWeek(pocStart)

  const thisWeek = getWeekKey(new Date().toISOString())
  const thisWeekResponderBiz = useMemo(() =>
    new Set(responses.filter((r) => getWeekKey(r.submitted_at) === thisWeek).map((r) => r.customer_number)), [responses, thisWeek])

  const nonParticipants = useMemo(() =>
    targets.filter((t) => !thisWeekResponderBiz.has(t.biz) && !thisWeekResponderBiz.has(t.name)), [targets, thisWeekResponderBiz])

  const recentResponses = useMemo(() =>
    [...responses].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)).slice(0, 8), [responses])

  // 주차 키 → 라벨 (엑셀·표시용)
  const weekKeyToLabel = useMemo(() => {
    const m = new Map<string, string>()
    pocWeekSlots(pocStart, 60).forEach((s) => m.set(s.weekKey, s.label))
    return m
  }, [pocStart])

  // 이탈 위험: 한 번이라도 응답했으나 최근 2주+ 연속 미참여
  const churnRisk = useMemo(() => {
    const slots = pocWeekSlots(pocStart, 8)
    return targets.map((t) => {
      const resp = responses.filter((r) => r.customer_number === t.biz || r.customer_name === t.name)
      if (resp.length === 0) return null
      let miss = 0
      for (let i = slots.length - 1; i >= 0; i--) {
        if (resp.some((r) => getWeekKey(r.submitted_at) === slots[i].weekKey)) break
        miss++
      }
      if (miss < 2) return null
      const last = [...resp].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))[0]
      return { ...t, miss, lastAt: last.submitted_at }
    }).filter(Boolean) as { biz: string; name: string; miss: number; lastAt: string }[]
  }, [targets, responses, pocStart])

  // 엑셀 다운로드 (전체 응답을 평면 표로)
  const exportExcel = () => {
    const questions = Array.from(new Set(responses.flatMap((r) => r.answers.map((a) => a.question))))
    const rows = [...responses].sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1)).map((r) => {
      const t = formatKST(r.submitted_at)
      const base: Record<string, string> = {
        업체명: r.customer_name || '',
        사업자번호: /^\d+$/.test(r.customer_number) ? r.customer_number : '',
        이메일: r.respondent_email || '',
        제출일: t.date,
        요일: t.weekday,
        제출시각: t.time,
        주차: weekKeyToLabel.get(getWeekKey(r.submitted_at)) || '',
      }
      questions.forEach((q) => { base[q] = r.answers.find((a) => a.question === q)?.answer || '' })
      return base
    })
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '구글폼응답')
    XLSX.writeFile(wb, `구글폼응답_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

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
          <button onClick={exportExcel} disabled={responses.length === 0} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition disabled:opacity-40 disabled:cursor-not-allowed">
            <Download size={15} /> 엑셀
          </button>
          <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> 새로고침
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-400 mb-5">브랜치Q 고객 대상 주간 설문(구글폼) 참여 현황입니다. 매주 발송되며 응답은 구글시트에 자동 누적됩니다.</p>

      {/* POC 시작 배너 / 진행 상태 */}
      {pocStart ? (
        <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50/60 px-5 py-3.5 flex items-center gap-3">
          <span className="w-9 h-9 rounded-lg bg-emerald-600 grid place-items-center shrink-0"><Rocket size={18} className="text-white" /></span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-emerald-800">POC 시범사업 진행 중 · {pocWeek}주차</p>
            <p className="text-xs text-emerald-700/70">시작일 {pocStart} · 주차는 이 날짜를 1주차 기준으로 계산됩니다.</p>
          </div>
        </div>
      ) : (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50/70 px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-amber-400 grid place-items-center shrink-0"><AlertTriangle size={18} className="text-white" /></span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-amber-800">아직 POC 시범사업 시작 전입니다 (테스트 단계)</p>
              <p className="text-xs text-amber-700/80">‘시작’을 누르면 그 날짜부터 1주차로 카운트됩니다. 실제 운영을 개시할 때 눌러주세요.</p>
            </div>
          </div>
          <button onClick={() => setShowStartModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm transition shrink-0">
            <PlayCircle size={17} /> POC 시작
          </button>
        </div>
      )}

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
            <span className="text-xs text-gray-400">{pocStart ? 'POC 주차 기준' : '최근 주(시작 전)'} · 막대=응답 업체수, 선=참여율</span>
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

      {/* 문항별 응답 분석 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-5">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
          <BarChart3 size={15} className="text-gray-400" />
          <h3 className="font-semibold text-gray-700 text-sm">문항별 응답 분석</h3>
          <span className="text-xs text-gray-400">어떤 답변이 가장 많은지 한눈에</span>
        </div>
        {dists.length === 0 ? (
          <p className="text-center py-12 text-gray-400 text-sm">아직 분석할 응답이 없습니다.</p>
        ) : (
          <div className="p-5 space-y-5">
            {/* 선택형 문항 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {choiceDists.map((d) => {
                const max = d.options[0]?.count || 1
                return (
                  <div key={d.question} className="rounded-xl border border-gray-100 p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-0.5 leading-snug">{d.question}</p>
                    <p className="text-xs text-gray-400 mb-3">응답 {d.total}건 · {d.options.length}개 선택지</p>
                    <div className="space-y-2.5">
                      {d.options.map((o, i) => (
                        <div key={o.answer} className="flex items-center gap-2.5">
                          <span className={`inline-grid place-items-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0 ${rankTone(i)}`}>{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className={`truncate ${i === 0 ? 'font-bold text-emerald-700' : 'text-gray-600'}`}>{o.answer}</span>
                              <span className={`tabular-nums shrink-0 ml-2 ${i === 0 ? 'font-bold text-emerald-700' : 'text-gray-400'}`}>{o.count}건 · {o.pct}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                              <div className={i === 0 ? 'bg-emerald-500 h-full rounded-full' : 'bg-emerald-300 h-full rounded-full'} style={{ width: `${(o.count / max) * 100}%` }} />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 주관식 문항 */}
            {textDists.length > 0 && (
              <div className="space-y-3">
                {textDists.map((d) => (
                  <div key={d.question} className="rounded-xl border border-gray-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-semibold text-gray-800 leading-snug">{d.question}</p>
                      <span className="text-xs text-gray-400 shrink-0 ml-2">주관식 · {d.total}건</span>
                    </div>
                    <div className="space-y-1.5">
                      {d.samples.map((s, i) => (
                        <p key={i} className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 line-clamp-2">“{s}”</p>
                      ))}
                    </div>
                    <button onClick={() => navigate('/branchq/form/detail')} className="text-xs text-emerald-600 hover:text-emerald-700 mt-2 inline-flex items-center gap-0.5">
                      전체 답변 보기 <ChevronRight size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 이탈 위험 업체 (참여하다 2주+ 연속 미응답) */}
      {churnRisk.length > 0 && (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm overflow-hidden mb-5">
          <div className="px-5 py-3 border-b border-red-100 bg-red-50/60 flex items-center gap-2">
            <TrendingDown size={15} className="text-red-500" />
            <h3 className="font-semibold text-red-700 text-sm">이탈 위험 업체</h3>
            <span className="text-xs text-red-400">참여하다 최근 2주 이상 연속 미응답</span>
            <span className="ml-auto text-xs font-bold text-red-600">{churnRisk.length}개사</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-50">
            {churnRisk.sort((a, b) => b.miss - a.miss).map((c) => {
              const t = formatKST(c.lastAt)
              return (
                <div key={c.biz || c.name} onClick={() => navigate(`/branchq/form/detail?c=${encodeURIComponent(c.biz || c.name)}`)}
                  className="bg-white px-4 py-3 hover:bg-red-50/40 cursor-pointer transition flex items-center justify-between gap-2 group">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 group-hover:text-red-700 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">최근 응답 {t.date}</p>
                  </div>
                  <span className="text-xs font-bold text-red-600 shrink-0 bg-red-50 px-2 py-1 rounded-lg">{c.miss}주 미응답</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
          구글폼 응답을 스프레드시트에 연결하면 이 대시보드에 자동 반영됩니다.
          응답을 고객과 매칭하려면 폼에 <b>필수 문항 "사업자번호"</b>를 추가하세요. 현재는 {isDev ? '데모(샘플) 데이터' : '실시간 연동'} 상태입니다.
        </div>
      </div>

      {/* POC 시작 확인 모달 */}
      {showStartModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !starting && setShowStartModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className="w-10 h-10 rounded-full bg-emerald-100 grid place-items-center"><Rocket size={20} className="text-emerald-600" /></span>
              <h3 className="text-lg font-bold text-gray-800">POC 시범사업 시작</h3>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-1">
              해당 버튼 클릭 시 <b className="text-emerald-700">POC 시범사업이 시작</b>됩니다. 진행하시겠습니까?
            </p>
            <p className="text-xs text-gray-400 leading-relaxed mb-5">
              오늘({new Date().toISOString().slice(0, 10)})이 <b>1주차</b> 기준일이 되며, 이후 주차가 자동 계산됩니다.
              시작은 1회만 가능하고 버튼은 사라집니다. (잘못 눌렀을 경우 관리자에게 복구 요청 가능)
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowStartModal(false)} disabled={starting}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                취소
              </button>
              <button onClick={confirmStart} disabled={starting}
                className="px-4 py-2 rounded-lg text-sm font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition inline-flex items-center gap-1.5">
                {starting ? <RefreshCw size={15} className="animate-spin" /> : <PlayCircle size={15} />} 시작하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
