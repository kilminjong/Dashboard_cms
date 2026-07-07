import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { loadBranchqRecords, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import {
  loadFormResponses, groupByCustomer, weeklyParticipation, formatKST, getWeekKey,
  type FormResponse,
} from '../lib/googleForm'
import {
  ListChecks, RefreshCw, Search, CheckCircle2, Circle, Mail, CalendarClock, MessageSquareText,
} from 'lucide-react'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()
const WEEKS = 8

interface CustomerRow {
  key: string          // 매칭 키 (사업자번호 우선)
  name: string
  responses: FormResponse[]
  lastAt: string
  participatedThisWeek: boolean
  streak: number       // 최근 연속 참여 주차 수
}

export default function GoogleFormDetail() {
  const [params, setParams] = useSearchParams()
  const [responses, setResponses] = useState<FormResponse[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
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
  }

  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])

  const thisWeek = getWeekKey(new Date().toISOString())
  const grouped = useMemo(() => groupByCustomer(responses), [responses])

  // 고객 유니버스 = POC 대상(records) ∪ 응답자
  const rows: CustomerRow[] = useMemo(() => {
    const map = new Map<string, CustomerRow>()
    const add = (key: string, name: string) => {
      const k = String(key || '').replace(/[^0-9a-zA-Z가-힣@.]/g, '') || name
      if (!k) return
      if (!map.has(k)) map.set(k, { key: k, name: name || k, responses: [], lastAt: '', participatedThisWeek: false, streak: 0 })
    }
    // 대상 고객 먼저
    records.forEach((r) => add(String(r.business_number || '').replace(/[^0-9]/g, '') || r.customer_number || r.customer_name || '', r.customer_name || ''))
    // 응답자 (대상 외 응답도 포함)
    for (const [key, list] of grouped) {
      const name = list[0]?.customer_name || key
      add(key, name)
      const row = map.get(String(key).replace(/[^0-9a-zA-Z가-힣@.]/g, '') || name)
      if (row) {
        row.responses = list
        row.lastAt = list[0]?.submitted_at || ''
        row.participatedThisWeek = list.some((r) => getWeekKey(r.submitted_at) === thisWeek)
        // 연속 참여 주차 계산
        const wp = weeklyParticipation(list, WEEKS)
        let s = 0
        for (const w of wp) { if (w.participated) s++; else break }
        row.streak = s
        if (name && (!map.get(row.key)!.name || map.get(row.key)!.name === row.key)) row.name = name
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (!!b.lastAt !== !!a.lastAt) return b.lastAt ? 1 : -1
      return (b.lastAt || '').localeCompare(a.lastAt || '')
    })
  }, [records, grouped, thisWeek])

  // URL ?c= 로 선택 초기화
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
  const weekly = useMemo(() => selected ? weeklyParticipation(selected.responses, WEEKS) : [], [selected])

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
      <p className="text-sm text-gray-400 mb-5">고객별 주간 참여 이력과 실제 답변 내용을 확인합니다.</p>

      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        {/* 좌측: 고객 리스트 */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="업체명·사업자번호 검색"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400" />
            </div>
          </div>
          <div className="divide-y divide-gray-50 overflow-y-auto max-h-[70vh]">
            {filtered.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-sm">대상 고객이 없습니다.</p>
            ) : filtered.map((r) => (
              <button key={r.key} onClick={() => selectCustomer(r.key)}
                className={`w-full text-left px-4 py-3 transition flex items-center gap-2.5 ${selectedKey === r.key ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                {r.participatedThisWeek
                  ? <CheckCircle2 size={17} className="text-emerald-500 shrink-0" />
                  : <Circle size={17} className="text-gray-300 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${selectedKey === r.key ? 'text-emerald-800' : 'text-gray-800'}`}>{r.name}</p>
                  <p className="text-xs text-gray-400 tabular-nums">
                    {r.responses.length > 0 ? `응답 ${r.responses.length}건 · 연속 ${r.streak}주` : '응답 없음'}
                  </p>
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
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">{selected.name}</h3>
                    <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-3 flex-wrap">
                      {selected.responses[0]?.respondent_email && <span className="flex items-center gap-1"><Mail size={12} /> {selected.responses[0].respondent_email}</span>}
                      {selected.key && /^\d+$/.test(selected.key) && <span>사업자번호 {selected.key}</span>}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${selected.participatedThisWeek ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {selected.participatedThisWeek ? '이번주 참여' : '이번주 미참여'}
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600">누적 {selected.responses.length}건</span>
                  </div>
                </div>

                {/* 주차별 참여 히트맵 */}
                <div className="mt-4">
                  <p className="text-xs font-semibold text-gray-500 mb-2">최근 {WEEKS}주 참여 현황</p>
                  <div className="flex gap-1.5 flex-wrap">
                    {[...weekly].reverse().map((w) => (
                      <div key={w.week} title={`${w.label} · ${w.participated ? '참여' : '미참여'}`}
                        className={`flex-1 min-w-[60px] rounded-lg px-2 py-2 text-center border ${w.participated ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-gray-50 border-gray-100 text-gray-300'}`}>
                        <p className="text-[10px] font-medium opacity-90">{w.label}</p>
                        <p className="text-sm font-bold mt-0.5">{w.participated ? '✓' : '·'}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 응답 타임라인 */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2">
                  <CalendarClock size={15} className="text-gray-400" />
                  <h3 className="font-semibold text-gray-700 text-sm">응답 이력</h3>
                </div>
                {selected.responses.length === 0 ? (
                  <p className="text-center py-12 text-gray-400 text-sm">아직 응답이 없습니다.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {selected.responses.map((r) => {
                      const t = formatKST(r.submitted_at)
                      return (
                        <div key={r.id} className="p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-50 text-emerald-700">{t.date} ({t.weekday})</span>
                            <span className="text-xs text-gray-400 tabular-nums">{t.time} 제출</span>
                          </div>
                          <div className="space-y-2.5">
                            {r.answers.length === 0 ? (
                              <p className="text-sm text-gray-400">답변 내용이 없습니다.</p>
                            ) : r.answers.map((a, i) => (
                              <div key={i} className="flex gap-2.5">
                                <MessageSquareText size={15} className="text-gray-300 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-xs text-gray-500 mb-0.5">{a.question}</p>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap break-words">{a.answer}</p>
                                </div>
                              </div>
                            ))}
                          </div>
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
