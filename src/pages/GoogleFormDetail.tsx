import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { loadBranchqRecords, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import { getPocStart } from '../lib/pocSettings'
import {
  loadFormResponses, groupByCustomer, weeklyParticipationPoc, pocWeekSlots, formatKST, getWeekKey,
  type FormResponse,
} from '../lib/googleForm'
import {
  ListChecks, RefreshCw, Search, CheckCircle2, Circle, Mail, Hash, Flame, MailCheck,
} from 'lucide-react'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()
const WEEKS = 12

interface CustomerRow {
  key: string
  name: string
  responses: FormResponse[]
  lastAt: string
  participatedThisWeek: boolean
  streak: number
}

export default function GoogleFormDetail() {
  const [params, setParams] = useSearchParams()
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
  const [pocStart, setPocStart] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selectedKey, setSelectedKey] = useState<string>('')

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
    setPocStart(await getPocStart())
  }

  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])

  const thisWeek = getWeekKey(new Date().toISOString())
  const grouped = useMemo(() => groupByCustomer(responses), [responses])

  // 주차 키 → 라벨 매핑 (응답이 몇 주차인지 표시용)
  const weekKeyToLabel = useMemo(() => {
    const m = new Map<string, string>()
    pocWeekSlots(pocStart, 60).forEach((s) => m.set(s.weekKey, s.label))
    return m
  }, [pocStart])

  const rows: CustomerRow[] = useMemo(() => {
    const map = new Map<string, CustomerRow>()
    const normKey = (k: string, name: string) => String(k || '').replace(/[^0-9a-zA-Z가-힣@.]/g, '') || name
    const add = (key: string, name: string) => {
      const k = normKey(key, name)
      if (!k) return
      if (!map.has(k)) map.set(k, { key: k, name: name || k, responses: [], lastAt: '', participatedThisWeek: false, streak: 0 })
    }
    records.forEach((r) => add(String(r.business_number || '').replace(/[^0-9]/g, '') || r.customer_number || r.customer_name || '', r.customer_name || ''))
    for (const [key, list] of grouped) {
      const name = list[0]?.customer_name || key
      add(key, name)
      const row = map.get(normKey(key, name))
      if (row) {
        row.responses = list
        row.lastAt = list[0]?.submitted_at || ''
        row.participatedThisWeek = list.some((r) => getWeekKey(r.submitted_at) === thisWeek)
        const wp = weeklyParticipationPoc(list, pocStart, WEEKS) // 오래된→최신
        let s = 0
        for (let i = wp.length - 1; i >= 0; i--) { if (wp[i].participated) s++; else break }
        row.streak = s
        if (name && (!row.name || row.name === row.key)) row.name = name
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (!!b.lastAt !== !!a.lastAt) return b.lastAt ? 1 : -1
      return (b.lastAt || '').localeCompare(a.lastAt || '')
    })
  }, [records, grouped, thisWeek, pocStart])

  useEffect(() => {
    if (loading) return
    const c = params.get('c')
    if (c) {
      const norm = String(c).replace(/[^0-9a-zA-Z가-힣@.]/g, '')
      const found = rows.find((r) => r.key === norm || r.key === c || r.name === c)
      if (found) { setSelectedKey(found.key); return }
    }
    if (!selectedKey && rows.length) setSelectedKey(rows[0].key)
  }, [loading, rows, params]) // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() =>
    rows.filter((r) => !q || r.name.toLowerCase().includes(q.toLowerCase()) || r.key.includes(q)), [rows, q])

  const selected = useMemo(() => rows.find((r) => r.key === selectedKey), [rows, selectedKey])
  const weekly = useMemo(() => selected ? weeklyParticipationPoc(selected.responses, pocStart, WEEKS) : [], [selected, pocStart])
  const participatedWeeks = weekly.filter((w) => w.participated).length
  const partRate = weekly.length ? Math.round((participatedWeeks / weekly.length) * 100) : 0

  const selectCustomer = (key: string) => {
    setSelectedKey(key)
    setParams((p) => { p.set('c', key); return p }, { replace: true })
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><ListChecks size={17} className="text-emerald-600" /></span>
        <h2 className="text-2xl font-bold text-gray-800">구글폼 상세관리</h2>
      </div>
      <p className="text-sm text-gray-400 mb-5">
        고객별 주간 참여 이력과 실제 답변 내용을 확인합니다.
        {pocStart ? <span className="text-emerald-600 font-medium"> · POC 시작일 {pocStart} 기준 주차</span> : <span className="text-amber-600 font-medium"> · POC 시작 전 (날짜 기준 표시)</span>}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4">
        {/* 좌측: 고객 리스트 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col self-start">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="업체명·사업자번호 검색"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
            </div>
          </div>
          <div className="divide-y divide-gray-50 overflow-y-auto max-h-[72vh]">
            {filtered.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-sm">대상 고객이 없습니다.</p>
            ) : filtered.map((r) => (
              <button key={r.key} onClick={() => selectCustomer(r.key)}
                className={`w-full text-left px-4 py-3 transition flex items-center gap-3 border-l-2 ${selectedKey === r.key ? 'bg-emerald-50 border-emerald-500' : 'border-transparent hover:bg-gray-50'}`}>
                {r.participatedThisWeek
                  ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                  : <Circle size={18} className="text-gray-300 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-semibold truncate ${selectedKey === r.key ? 'text-emerald-800' : 'text-gray-800'}`}>{r.name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-gray-400 mt-0.5">
                    {r.responses.length > 0 ? (
                      <>
                        <span>응답 {r.responses.length}</span>
                        {r.streak > 0 && <span className="inline-flex items-center gap-0.5 text-orange-500 font-medium"><Flame size={11} />{r.streak}주 연속</span>}
                      </>
                    ) : <span>응답 없음</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 우측: 상세 */}
        <div className="min-w-0">
          {!selected ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center text-gray-400 text-sm">고객을 선택하세요.</div>
          ) : (
            <div className="space-y-4">
              {/* 고객 헤더 */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-3">
                  <span className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 text-lg font-bold grid place-items-center shrink-0">{(selected.name || '?')[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-800">{selected.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${selected.participatedThisWeek ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {selected.participatedThisWeek ? '이번주 참여' : '이번주 미참여'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400 mt-1 flex items-center gap-3 flex-wrap">
                      {selected.responses[0]?.respondent_email && <span className="inline-flex items-center gap-1"><Mail size={12} /> {selected.responses[0].respondent_email}</span>}
                      {selected.key && /^\d+$/.test(selected.key) && <span className="inline-flex items-center gap-1"><Hash size={12} /> {selected.key}</span>}
                    </div>
                  </div>
                </div>

                {/* KPI 3분할 */}
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {[
                    { label: '누적 응답', value: `${selected.responses.length}건`, icon: MailCheck, tone: 'text-emerald-600' },
                    { label: '연속 참여', value: `${selected.streak}주`, icon: Flame, tone: 'text-orange-500' },
                    { label: `참여율 (${weekly.length}주)`, value: `${partRate}%`, icon: CheckCircle2, tone: 'text-blue-600' },
                  ].map((k) => (
                    <div key={k.label} className="rounded-xl bg-gray-50 px-3 py-2.5">
                      <p className="text-[11px] text-gray-400 mb-0.5">{k.label}</p>
                      <p className={`text-lg font-bold ${k.tone}`}>{k.value}</p>
                    </div>
                  ))}
                </div>

                {/* 주차별 참여 히트맵 */}
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500">{pocStart ? 'POC 주차별 참여' : '최근 주차별 참여'}</p>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block" />참여</span>
                      <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-gray-200 inline-block" />미참여</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
                    {weekly.map((w, i) => {
                      const isCurrent = i === weekly.length - 1
                      return (
                        <div key={w.weekKey} title={`${w.label} · ${w.participated ? '참여' : '미참여'}`}
                          className={`rounded-lg py-2 text-center border ${w.participated ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-gray-50 border-gray-100 text-gray-300'} ${isCurrent ? 'ring-2 ring-offset-1 ring-emerald-400' : ''}`}>
                          <p className="text-[9px] font-medium leading-none opacity-90">{w.label}</p>
                          <p className="text-xs font-bold mt-1 leading-none">{w.participated ? '✓' : '·'}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* 응답 이력 타임라인 */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <ListChecks size={15} className="text-gray-400" />
                  <h3 className="font-semibold text-gray-700 text-sm">응답 이력</h3>
                  <span className="ml-auto text-xs text-gray-400">{selected.responses.length}건</span>
                </div>
                {selected.responses.length === 0 ? (
                  <p className="text-center py-12 text-gray-400 text-sm">아직 응답이 없습니다.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selected.responses.map((r) => {
                      const t = formatKST(r.submitted_at)
                      const wkLabel = weekKeyToLabel.get(getWeekKey(r.submitted_at))
                      return (
                        <div key={r.id} className="px-5 py-4">
                          {/* 제출 시각 헤더 */}
                          <div className="flex items-center gap-2 mb-3 flex-wrap">
                            {wkLabel && <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-emerald-600 text-white">{wkLabel}</span>}
                            <span className="text-sm font-semibold text-gray-800">{t.date} ({t.weekday})</span>
                            <span className="text-xs text-gray-400 tabular-nums">{t.time} 제출</span>
                          </div>
                          {/* 문항/답변 */}
                          {r.answers.length === 0 ? (
                            <p className="text-sm text-gray-400">답변 내용이 없습니다.</p>
                          ) : (
                            <div className="rounded-xl border border-gray-100 divide-y divide-gray-50 overflow-hidden">
                              {r.answers.map((a, i) => (
                                <div key={i} className="grid grid-cols-1 sm:grid-cols-[minmax(0,40%)_1fr] gap-1 sm:gap-3 px-3.5 py-2.5">
                                  <p className="text-xs text-gray-500 leading-snug">{a.question}</p>
                                  <p className="text-sm text-gray-900 font-medium whitespace-pre-wrap break-words leading-snug">{a.answer}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
