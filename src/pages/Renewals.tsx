import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { Search, X, RefreshCw } from 'lucide-react'

// 표시 범위 (조정 가능)
const PAST_DAYS = 60     // 기한 경과: 지난 N일 이내만
const FUTURE_DAYS = 90   // 예정: D-N 이내

const todayMs = new Date(new Date().toDateString()).getTime()
const parseLocalDate = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const daysUntil = (s?: string) => { const d = parseLocalDate(s); return d ? Math.ceil((d.getTime() - todayMs) / 86400000) : null }

type Entry = {
  key: string; id: string; c: any; name: string; manager: string
  type: '해지' | '이행종료'; date: string; dl: number
}

// 긴급도 색
const tone = (dl: number) => {
  if (dl < 0) return { dot: '#b91c1c', tw: 'text-red-700' }
  if (dl <= 7) return { dot: '#EF4444', tw: 'text-red-600' }
  if (dl <= 30) return { dot: '#F59E0B', tw: 'text-amber-700' }
  return { dot: '#3B82F6', tw: 'text-blue-700' }
}

export default function Renewals() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | '해지' | '이행종료'>('all')

  useEffect(() => { load() }, [])
  const load = async () => {
    try {
      const data = await fetchCustomers()
      setCustomers(data || [])
    } catch (err) {
      console.error('갱신·만료 데이터 로드 실패:', err)
    }
    setLoading(false)
  }

  const managers = useMemo(
    () => [...new Set(customers.map((c) => c.manager).filter(Boolean))].sort() as string[],
    [customers]
  )

  // 만료 항목 생성 (해지일 / 이행종료일)
  const allEntries = useMemo(() => {
    const out: Entry[] = []
    customers.forEach((c) => {
      ;([['해지', 'termination_date'], ['이행종료', 'transition_end_date']] as const).forEach(([type, key]) => {
        const date = c[key]
        const dl = daysUntil(date)
        if (dl === null || dl < -PAST_DAYS || dl > FUTURE_DAYS) return
        out.push({ key: `${c.id}-${type}`, id: c.id, c, name: c.customer_name, manager: c.manager || '', type, date, dl })
      })
    })
    return out.sort((a, b) => a.dl - b.dl) // 날짜 오름차순 (과거→미래)
  }, [customers])

  const filtered = useMemo(() => allEntries.filter((e) => {
    if (typeFilter !== 'all' && e.type !== typeFilter) return false
    if (managerFilter && e.manager !== managerFilter) return false
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      const c = e.c
      if (![c.customer_name, c.manager, c.customer_number, c.business_number].some((v) => String(v || '').toLowerCase().includes(s))) return false
    }
    return true
  }), [allEntries, typeFilter, managerFilter, q])

  // 구간별 카운트
  const overdue = filtered.filter((e) => e.dl < 0).length
  const d7 = filtered.filter((e) => e.dl >= 0 && e.dl <= 7).length
  const d30 = filtered.filter((e) => e.dl >= 8 && e.dl <= 30).length
  const d90 = filtered.filter((e) => e.dl >= 31 && e.dl <= 90).length
  const futureCount = filtered.filter((e) => e.dl >= 0).length

  const past = filtered.filter((e) => e.dl < 0)
  const future = filtered.filter((e) => e.dl >= 0)

  // 미래 항목을 월별로 그룹화
  const futureGroups = useMemo(() => {
    const groups: { month: string; label: string; items: Entry[] }[] = []
    let cur: { month: string; label: string; items: Entry[] } | null = null
    future.forEach((e) => {
      const ym = e.date.slice(0, 7)
      if (!cur || cur.month !== ym) {
        cur = { month: ym, label: `${ym.slice(0, 4)} · ${parseInt(ym.slice(5, 7))}월`, items: [] }
        groups.push(cur)
      }
      cur.items.push(e)
    })
    return groups
  }, [future])

  const now = new Date()
  const todayLabel = `${now.getMonth() + 1}/${now.getDate()}`

  const renderEntry = (e: Entry) => {
    const t = tone(e.dl)
    const isPast = e.dl < 0
    const [y, m, d] = e.date.split('-')
    return (
      <div key={e.key} className="flex items-stretch mb-2.5 relative">
        <div className="w-[84px] shrink-0 text-right pr-3 pt-3 hidden sm:block">
          <div className={`text-[13px] font-bold tabular-nums ${isPast ? 'text-red-700' : 'text-gray-500'}`}>{m}.{d}</div>
          <div className="text-[10px] text-gray-400">{y}</div>
        </div>
        <div className="w-9 shrink-0 flex justify-center pt-[15px] relative z-[1]">
          <span className="w-3.5 h-3.5 rounded-full border-[3px] border-white" style={{ background: t.dot, boxShadow: '0 0 0 1px #E4E8EC' }} />
        </div>
        <div className={`flex-1 min-w-0 rounded-xl border shadow-sm px-3.5 py-3 flex items-center gap-3 sm:gap-4 transition hover:shadow-md ${isPast ? 'bg-rose-50/60 border-rose-200' : 'bg-white border-gray-100'}`}>
          <div className="w-[52px] text-center shrink-0">
            <div className={`text-base font-extrabold leading-none tabular-nums ${t.tw}`}>{isPast ? `+${-e.dl}` : (e.dl === 0 ? 'D-Day' : `D-${e.dl}`)}</div>
            <div className="text-[10px] text-gray-400 mt-0.5">{isPast ? '일 경과' : '잔여'}</div>
          </div>
          <div className="flex-1 min-w-0">
            <button onClick={() => navigate(`/customers/${e.id}`)} className="text-[14.5px] font-bold text-gray-800 hover:text-emerald-700 truncate block max-w-full text-left">{e.name}</button>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${e.type === '해지' ? 'bg-red-50 text-red-700' : 'bg-violet-50 text-violet-700'}`}>{e.type}</span>
              <span className="text-xs text-gray-400">{e.type}일 {e.date}</span>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-gray-500 shrink-0">
            <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[11px] font-bold">{e.manager?.[0] || '?'}</span>
            {e.manager || '-'}
          </div>
          <button onClick={() => navigate(`/customers/${e.id}`)} className="shrink-0 text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:text-emerald-700 hover:border-emerald-400 transition">바로가기 ›</button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">갱신 · 만료 관리</h2>
          <p className="text-sm text-gray-500 mt-1.5">
            해지·이행종료 예정 고객을 시간 순으로 펼쳤습니다.
            {futureCount > 0 ? <> 90일 이내 <b className="text-gray-800">{futureCount}건</b>의 갱신 검토가 필요해요.</> : ' 예정된 만료가 없습니다.'}
          </p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="hidden sm:flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition shrink-0">
          <RefreshCw size={15} className="text-gray-400" /> 새로고침
        </button>
      </div>

      {/* 분포 막대 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-5">
        <div className="flex h-3 rounded-md overflow-hidden gap-0.5">
          {overdue > 0 && <span style={{ flex: overdue, background: '#b91c1c' }} />}
          {d7 > 0 && <span style={{ flex: d7, background: '#EF4444' }} />}
          {d30 > 0 && <span style={{ flex: d30, background: '#F59E0B' }} />}
          {d90 > 0 && <span style={{ flex: d90, background: '#3B82F6' }} />}
          {filtered.length === 0 && <span style={{ flex: 1, background: '#eef1f3' }} />}
        </div>
        <div className="flex gap-x-5 gap-y-2 mt-3 flex-wrap">
          <span className="flex items-center gap-2 text-[12.5px] text-gray-500"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#b91c1c' }} />기한 경과 <b className="text-gray-800 font-extrabold tabular-nums">{overdue}</b></span>
          <span className="flex items-center gap-2 text-[12.5px] text-gray-500"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#EF4444' }} />7일 이내 <b className="text-gray-800 font-extrabold tabular-nums">{d7}</b></span>
          <span className="flex items-center gap-2 text-[12.5px] text-gray-500"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#F59E0B' }} />30일 이내 <b className="text-gray-800 font-extrabold tabular-nums">{d30}</b></span>
          <span className="flex items-center gap-2 text-[12.5px] text-gray-500"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: '#3B82F6' }} />90일 이내 <b className="text-gray-800 font-extrabold tabular-nums">{d90}</b></span>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2.5 flex-wrap items-center mb-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="고객명, 담당자로 검색..."
            className="w-full h-10 pl-9 pr-9 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={14} /></button>}
        </div>
        <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}
          className="h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="">담당자 전체</option>
          {profile?.name && <option value={profile.name}>내 담당 ({profile.name})</option>}
          {managers.filter((m) => m !== profile?.name).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <div className="flex bg-white border border-gray-300 rounded-xl p-0.5 gap-0.5">
          {(['all', '해지', '이행종료'] as const).map((tf) => (
            <button key={tf} onClick={() => setTypeFilter(tf)}
              className={`h-9 px-3 rounded-lg text-[13px] font-semibold transition ${typeFilter === tf ? 'bg-gray-800 text-white' : 'text-gray-500 hover:text-gray-700'}`}>
              {tf === 'all' ? '전체 유형' : tf}
            </button>
          ))}
        </div>
      </div>

      {/* 타임라인 */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="font-medium">{q || managerFilter || typeFilter !== 'all' ? '조건에 맞는 만료 예정 고객이 없습니다.' : '표시할 만료 예정 고객이 없습니다.'}</p>
          {(q || managerFilter || typeFilter !== 'all') && <button onClick={() => { setQ(''); setManagerFilter(''); setTypeFilter('all') }} className="text-sm text-emerald-600 hover:underline mt-2">필터 초기화</button>}
        </div>
      ) : (
        <div className="relative mt-6">
          {/* 세로 spine */}
          <div className="absolute top-1 bottom-0 w-0.5 bg-gray-200 hidden sm:block" style={{ left: '103px' }} />

          {/* 기한 경과 */}
          {past.length > 0 && (
            <>
              <div className="flex items-center gap-2 mb-1.5 sm:ml-[117px] text-[11.5px] font-bold text-red-700">⚠️ 기한 경과 · 미정리</div>
              {past.map(renderEntry)}
            </>
          )}

          {/* 오늘 기준선 */}
          <div className="relative my-5 h-6">
            <div className="absolute left-0 sm:left-[60px] right-0 top-1/2 border-t-2 border-dashed border-emerald-500" />
            <div className="absolute top-1/2 -translate-y-1/2 sm:-translate-x-1/2 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow left-0 sm:left-[103px]">오늘 · {todayLabel}</div>
          </div>

          {/* 미래 (월별) */}
          {futureGroups.map((g) => (
            <div key={g.month}>
              <div className="relative flex items-center my-5 h-5">
                <span className="absolute -translate-x-1/2 bg-gray-800 text-white text-[11px] font-bold px-2.5 py-1 rounded-full left-0 sm:left-[103px] translate-x-0 sm:-translate-x-1/2">{g.label}</span>
                <span className="ml-[100px] sm:ml-[150px] flex-1 border-t border-dashed border-gray-200" />
              </div>
              {g.items.map(renderEntry)}
            </div>
          ))}
        </div>
      )}

      {past.length > 0 && (
        <p className="text-xs text-gray-400 mt-3">※ 기한 경과는 최근 {PAST_DAYS}일 이내, 예정은 D-{FUTURE_DAYS}까지 표시됩니다.</p>
      )}
    </div>
  )
}
