import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { Search, X, RefreshCw, Clock, Link2, Turtle, UserX, CheckCircle2, ChevronRight } from 'lucide-react'

// 기준 일수 (조정 가능)
const EXPIRY_DAYS = 30   // 만료 임박: 해지일/이행종료일 D-30 이내
const DELAY_DAYS = 14    // 개설 지연: 접수 후 N일 넘게 미완료

const todayMs = new Date(new Date().toDateString()).getTime()
const parseLocalDate = (s?: string) => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
const daysUntil = (s?: string) => { const d = parseLocalDate(s); return d ? Math.ceil((d.getTime() - todayMs) / 86400000) : null }
const daysFrom = (s?: string) => { const d = parseLocalDate(s); return d ? Math.floor((todayMs - d.getTime()) / 86400000) : null }

type Task = {
  kind: 'expiry' | 'connection' | 'delay' | 'unassigned'
  key: string
  id: string
  c: any
  name: string
  manager: string
  badge: string
  badgeClass: string
  tag: string
  meta: string
  action: string
}

const SECTIONS = [
  { kind: 'expiry', title: '만료 임박', desc: `해지일·이행종료일 D-${EXPIRY_DAYS} 이내`, icon: Clock, iconBg: 'bg-red-50 text-red-500' },
  { kind: 'connection', title: '연계 대기', desc: 'ERP연계대기 상태로 정체 중', icon: Link2, iconBg: 'bg-blue-50 text-blue-500' },
  { kind: 'delay', title: '개설 지연', desc: `접수 후 ${DELAY_DAYS}일 넘게 개설 미완료`, icon: Turtle, iconBg: 'bg-orange-50 text-orange-500' },
  { kind: 'unassigned', title: '담당자 미배정', desc: '담당자가 지정되지 않은 고객', icon: UserX, iconBg: 'bg-gray-100 text-gray-500' },
] as const

export default function Todo() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [cat, setCat] = useState<'all' | Task['kind']>('all')
  const [done, setDone] = useState<Set<string>>(new Set())

  useEffect(() => { load() }, [])
  const load = async () => {
    try {
      const data = await fetchCustomers()
      setCustomers(data || [])
    } catch (err) {
      console.error('할 일 데이터 로드 실패:', err)
    }
    setLoading(false)
  }

  const managers = useMemo(
    () => [...new Set(customers.map((c) => c.manager).filter(Boolean))].sort() as string[],
    [customers]
  )

  // 카테고리별 할 일 자동 생성
  const allTasks = useMemo(() => {
    const expiry: Task[] = []
    const connection: Task[] = []
    const delay: Task[] = []
    const unassigned: Task[] = []

    customers.forEach((c) => {
      // 1) 만료 임박
      ;[['해지일', c.termination_date], ['이행종료일', c.transition_end_date]].forEach(([field, date]) => {
        const dl = daysUntil(date as string)
        if (dl !== null && dl >= 0 && dl <= EXPIRY_DAYS) {
          expiry.push({
            kind: 'expiry', key: `exp-${c.id}-${field}`, id: c.id, c, name: c.customer_name, manager: c.manager || '',
            badge: dl === 0 ? 'D-Day' : `D-${dl}`, badgeClass: dl <= 7 ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700',
            tag: field as string, meta: `${date} · 잔여 ${dl}일`, action: '바로가기',
          })
        }
      })
      // 2) 연계 대기
      if (c.connection_status === 'ERP연계대기') {
        const age = daysFrom(c.reception_date)
        connection.push({
          kind: 'connection', key: `conn-${c.id}`, id: c.id, c, name: c.customer_name, manager: c.manager || '',
          badge: age !== null ? `${age}일` : '-', badgeClass: 'bg-blue-50 text-blue-700',
          tag: c.erp_type || c.erp_company || 'ERP', meta: `ERP연계대기${age !== null ? ` · 접수 ${age}일 경과` : ''}`, action: '바로가기',
        })
      }
      // 3) 개설 지연
      if (c.opening_status === '개설대기' || c.opening_status === '개설진행') {
        const age = daysFrom(c.reception_date)
        if (age !== null && age >= DELAY_DAYS) {
          delay.push({
            kind: 'delay', key: `delay-${c.id}`, id: c.id, c, name: c.customer_name, manager: c.manager || '',
            badge: `${age}일`, badgeClass: 'bg-orange-50 text-orange-700',
            tag: c.opening_status, meta: `접수 ${c.reception_date} · ${age}일 경과`, action: '바로가기',
          })
        }
      }
      // 4) 담당자 미배정
      if (!(c.manager || '').trim() && c.opening_status !== '개설취소') {
        unassigned.push({
          kind: 'unassigned', key: `un-${c.id}`, id: c.id, c, name: c.customer_name, manager: '',
          badge: '신규', badgeClass: 'bg-gray-100 text-gray-600',
          tag: c.opening_status || '미정', meta: `접수 ${c.reception_date || '-'} · 담당자 없음`, action: '배정하기',
        })
      }
    })

    expiry.sort((a, b) => parseInt(a.badge.replace(/\D/g, '') || '0') - parseInt(b.badge.replace(/\D/g, '') || '0'))
    connection.sort((a, b) => parseInt(b.badge) - parseInt(a.badge))
    delay.sort((a, b) => parseInt(b.badge) - parseInt(a.badge))

    return { expiry, connection, delay, unassigned }
  }, [customers])

  // 검색 + 담당자 필터
  const matchFilter = (t: Task) => {
    if (managerFilter && t.manager !== managerFilter) return false
    if (!q.trim()) return true
    const s = q.trim().toLowerCase()
    const c = t.c
    return [c.customer_name, c.manager, c.erp_company, c.erp_type, c.customer_number, c.business_number]
      .some((v) => String(v || '').toLowerCase().includes(s))
  }

  const filtered = useMemo(() => ({
    expiry: allTasks.expiry.filter(matchFilter),
    connection: allTasks.connection.filter(matchFilter),
    delay: allTasks.delay.filter(matchFilter),
    unassigned: allTasks.unassigned.filter(matchFilter),
  }), [allTasks, q, managerFilter])

  const counts = {
    expiry: filtered.expiry.length,
    connection: filtered.connection.length,
    delay: filtered.delay.length,
    unassigned: filtered.unassigned.length,
  }
  const total = counts.expiry + counts.connection + counts.delay + counts.unassigned

  const toggleDone = (key: string) => setDone((prev) => {
    const n = new Set(prev)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })

  const tiles = [
    { key: 'all', label: '처리 필요', value: total, sub: '전체 후속조치', bar: 'bg-gray-400', color: 'text-gray-800' },
    { key: 'expiry', label: '🔴 만료 임박', value: counts.expiry, sub: `${EXPIRY_DAYS}일 이내`, bar: 'bg-red-500', color: 'text-red-700' },
    { key: 'connection', label: '🔵 연계 대기', value: counts.connection, sub: 'ERP연계대기 정체', bar: 'bg-blue-500', color: 'text-blue-700' },
    { key: 'delay', label: '🟠 개설 지연', value: counts.delay, sub: `접수 후 ${DELAY_DAYS}일↑`, bar: 'bg-orange-500', color: 'text-orange-700' },
    { key: 'unassigned', label: '⚪ 담당자 미배정', value: counts.unassigned, sub: '배정 필요', bar: 'bg-gray-400', color: 'text-gray-800' },
  ] as const

  const tabs = [
    { key: 'all', label: '전체', value: total },
    { key: 'expiry', label: '만료 임박', value: counts.expiry },
    { key: 'connection', label: '연계 대기', value: counts.connection },
    { key: 'delay', label: '개설 지연', value: counts.delay },
    { key: 'unassigned', label: '미배정', value: counts.unassigned },
  ] as const

  const renderTask = (t: Task) => {
    const isDone = done.has(t.key)
    return (
      <div key={t.key} className={`flex items-center gap-3 px-4 sm:px-5 py-3 border-t border-gray-100 first:border-t-0 hover:bg-gray-50/70 transition ${isDone ? 'opacity-45' : ''}`}>
        <button onClick={() => toggleDone(t.key)} title="후속조치 완료 표시"
          className={`w-5 h-5 rounded-full border-2 grid place-items-center shrink-0 transition ${isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-transparent hover:border-emerald-400'}`}>
          <CheckCircle2 size={12} />
        </button>
        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md shrink-0 text-center min-w-[46px] tabular-nums ${t.badgeClass}`}>{t.badge}</span>
        <div className="flex-1 min-w-0">
          <button onClick={() => navigate(`/customers/${t.id}`)} className={`text-sm font-bold text-gray-800 hover:text-emerald-700 ${isDone ? 'line-through' : ''}`}>{t.name}</button>
          <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span className="bg-gray-100 text-gray-500 rounded px-1.5 py-0.5">{t.tag}</span>{t.meta}
          </div>
        </div>
        {t.kind === 'unassigned' ? (
          <span className="text-xs font-medium text-red-500 shrink-0 hidden sm:block">미배정</span>
        ) : (
          <span className="text-xs text-gray-500 shrink-0 hidden sm:flex items-center gap-1.5">
            <span className="w-[22px] h-[22px] rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[10px] font-bold">{t.manager?.[0] || '?'}</span>
            {t.manager || '-'}
          </span>
        )}
        <button onClick={() => navigate(`/customers/${t.id}`)} className="shrink-0 text-xs text-gray-400 border border-gray-200 rounded-lg px-2.5 py-1.5 hover:text-emerald-700 hover:border-emerald-400 transition">
          {t.action} ›
        </button>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">할 일 · 후속조치</h2>
          <p className="text-sm text-gray-500 mt-1.5">처리가 필요한 고객을 자동으로 모았습니다. {total > 0 ? <>지금 <b className="text-gray-800">{total}건</b>의 후속조치가 필요해요.</> : '처리할 항목이 없습니다.'}</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="hidden sm:flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition shrink-0">
          <RefreshCw size={15} className="text-gray-400" /> 새로고침
        </button>
      </div>

      {/* 요약 타일 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-5">
        {tiles.map((t) => (
          <button key={t.key} onClick={() => setCat(t.key as any)}
            className={`relative text-left bg-white rounded-2xl px-4 py-3.5 border transition overflow-hidden ${cat === t.key ? 'border-emerald-300 shadow-sm' : 'border-gray-100 hover:border-gray-200'}`}>
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${t.bar}`} />
            <p className="text-xs text-gray-500 font-medium">{t.label}</p>
            <p className={`text-[26px] font-bold mt-1.5 leading-none tabular-nums ${t.color}`}>{t.value}</p>
            <p className="text-[11px] text-gray-400 mt-1.5">{t.sub}</p>
          </button>
        ))}
      </div>

      {/* 검색 + 담당자 필터 */}
      <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="고객명, 담당자, ERP, 고객번호로 검색..."
            className="w-full h-10 pl-9 pr-9 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={14} /></button>}
        </div>
        <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}
          className="h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none sm:w-44">
          <option value="">담당자 전체</option>
          {profile?.name && <option value={profile.name}>내 담당 ({profile.name})</option>}
          {managers.filter((m) => m !== profile?.name).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      {/* 카테고리 탭 */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setCat(t.key as any)}
            className={`h-9 px-3.5 rounded-full text-[13px] font-semibold inline-flex items-center gap-2 transition border ${cat === t.key ? 'bg-gray-800 border-gray-800 text-white' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'}`}>
            {t.label}
            <span className={`text-[11px] font-extrabold rounded-full px-1.5 tabular-nums ${cat === t.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'}`}>{t.value}</span>
          </button>
        ))}
      </div>

      {/* 섹션 목록 */}
      {total === 0 ? (
        <div className="text-center py-20">
          <div className="w-[72px] h-[72px] rounded-full bg-emerald-50 grid place-items-center mx-auto mb-4"><CheckCircle2 size={32} className="text-emerald-500" /></div>
          <p className="text-gray-500 font-medium">{q || managerFilter ? '조건에 맞는 후속조치가 없습니다.' : '모든 후속조치를 완료했어요!'}</p>
          {(q || managerFilter) && <button onClick={() => { setQ(''); setManagerFilter('') }} className="text-sm text-emerald-600 hover:underline mt-2">필터 초기화</button>}
        </div>
      ) : (
        SECTIONS.map((sec) => {
          if (cat !== 'all' && cat !== sec.kind) return null
          const items = (filtered as any)[sec.kind] as Task[]
          if (items.length === 0) return null
          const Icon = sec.icon
          return (
            <div key={sec.kind} className="bg-white rounded-2xl border border-gray-100 shadow-sm mb-4 overflow-hidden">
              <div className="flex items-center gap-2.5 px-4 sm:px-5 py-3.5 border-b border-gray-100">
                <span className={`w-[30px] h-[30px] rounded-lg grid place-items-center shrink-0 ${sec.iconBg}`}><Icon size={16} /></span>
                <h3 className="font-bold text-gray-800 text-[15px]">{sec.title}</h3>
                <span className="text-[11.5px] text-gray-400 hidden sm:inline">{sec.desc}</span>
                <span className="ml-auto text-xs font-bold text-gray-500 tabular-nums">{items.length}건</span>
              </div>
              {items.map(renderTask)}
            </div>
          )
        })
      )}

      {/* 하단 안내 */}
      {total > 0 && (
        <p className="text-xs text-gray-400 mt-2 flex items-center gap-1.5">
          <ChevronRight size={12} /> 체크 표시는 화면에서만 임시로 완료 처리됩니다. (새로고침 시 초기화)
        </p>
      )}
    </div>
  )
}
