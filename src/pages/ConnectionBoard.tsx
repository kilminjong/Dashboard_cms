import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers, updateCustomer } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { Search, X, RefreshCw } from 'lucide-react'

// 연계 단계 (컬럼)
const STAGES = [
  { key: 'ERP연계대기', color: '#F59E0B' },
  { key: 'ERP연계진행', color: '#3B82F6' },
  { key: 'ERP연계완료', color: '#10B981' },
  { key: 'ERP청구완료', color: '#8B5CF6' },
  { key: '연계청구보류', color: '#EF4444' },
] as const
const STAGE_KEYS = STAGES.map((s) => s.key) as string[]

const mmdd = (s?: string) => (s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s.slice(5, 7)}.${s.slice(8, 10)}` : '')

export default function ConnectionBoard() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [erpFilter, setErpFilter] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  useEffect(() => { load() }, [])
  const load = async () => {
    try {
      const data = await fetchCustomers()
      setCustomers(data || [])
    } catch (err) {
      console.error('연계 현황 로드 실패:', err)
    }
    setLoading(false)
  }

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2600)
  }

  // 보드 대상 = 연계 상태가 지정된 고객
  const boardCustomers = useMemo(() => customers.filter((c) => STAGE_KEYS.includes(c.connection_status)), [customers])
  const managers = useMemo(() => [...new Set(boardCustomers.map((c) => c.manager).filter(Boolean))].sort() as string[], [boardCustomers])
  const erpTypes = useMemo(() => [...new Set(boardCustomers.map((c) => c.erp_type).filter(Boolean))].sort() as string[], [boardCustomers])

  const matches = (c: any) => {
    if (managerFilter && c.manager !== managerFilter) return false
    if (erpFilter && c.erp_type !== erpFilter) return false
    if (q.trim()) {
      const s = q.trim().toLowerCase()
      if (![c.customer_name, c.manager, c.erp_type, c.erp_company, c.customer_number].some((v) => String(v || '').toLowerCase().includes(s))) return false
    }
    return true
  }

  const visible = boardCustomers.filter(matches)
  const byStage = (stage: string) => visible.filter((c) => c.connection_status === stage)
  const totalVisible = visible.length

  // 드롭 → 상태 변경 (낙관적 업데이트 + 백그라운드 저장)
  const handleDrop = (stage: string) => {
    const c = customers.find((x) => x.id === dragId)
    setDragId(null); setDragOver(null)
    if (!c || c.connection_status === stage) return
    const prevStatus = c.connection_status
    setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, connection_status: stage } : x)))
    if (c._rowIndex) {
      updateCustomer(c._rowIndex, { ...c, connection_status: stage })
        .then(() => showToast(`${c.customer_name} · ${stage} 으로 이동`))
        .catch((err) => {
          console.error('상태 저장 실패:', err)
          setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, connection_status: prevStatus } : x)))
          showToast('저장 실패 — 다시 시도해주세요')
        })
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)]">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-3.5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">연계 현황 보드</h2>
          <p className="text-sm text-gray-500 mt-1.5">ERP 연계 단계를 한눈에. 카드를 드래그해 상태를 옮기면 바로 저장됩니다.</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="hidden sm:flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition shrink-0">
          <RefreshCw size={15} className="text-gray-400" /> 새로고침
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-2.5 flex-wrap items-center mb-4">
        <div className="relative w-[280px] max-w-[50vw]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="고객명, ERP, 담당자로 검색..."
            className="w-full h-10 pl-9 pr-9 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none" />
          {q && <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={14} /></button>}
        </div>
        <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}
          className="h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="">담당자 전체</option>
          {profile?.name && <option value={profile.name}>내 담당 ({profile.name})</option>}
          {managers.filter((m) => m !== profile?.name).map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={erpFilter} onChange={(e) => setErpFilter(e.target.value)}
          className="h-10 px-3 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="">ERP 전체</option>
          {erpTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <span className="flex-1" />
        <span className="text-sm text-gray-400">연계 대상 <b className="text-gray-800 font-extrabold tabular-nums">{totalVisible}</b>건</span>
      </div>

      {/* 보드 */}
      {boardCustomers.length === 0 ? (
        <div className="text-center py-20 text-gray-400">연계 상태가 지정된 고객이 없습니다.</div>
      ) : (
        <div className="flex gap-3.5 overflow-x-auto flex-1 pb-4">
          {STAGES.map((stage) => {
            const items = byStage(stage.key)
            const isOver = dragOver === stage.key
            return (
              <div key={stage.key}
                onDragOver={(e) => { e.preventDefault(); if (dragOver !== stage.key) setDragOver(stage.key) }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver((p) => (p === stage.key ? null : p)) }}
                onDrop={() => handleDrop(stage.key)}
                className={`w-64 shrink-0 flex flex-col rounded-2xl bg-[#EEF1F4] transition ${isOver ? 'ring-2 ring-emerald-400 bg-emerald-50/60' : ''}`}>
                <div className="h-[3px] rounded-t-2xl" style={{ background: stage.color }} />
                <div className="flex items-center gap-2 px-3.5 pt-3 pb-2.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: stage.color }} />
                  <span className="text-[13px] font-extrabold text-gray-800">{stage.key}</span>
                  <span className="ml-auto text-xs font-extrabold text-gray-500 bg-white rounded-full px-2.5 py-0.5 min-w-[26px] text-center tabular-nums">{items.length}</span>
                </div>
                <div className="px-2.5 pb-2.5 flex flex-col gap-2.5 overflow-y-auto flex-1 min-h-[80px]">
                  {items.map((c) => {
                    const dateLabel = c.connection_date ? `연계 ${mmdd(c.connection_date)}` : c.reception_date ? `접수 ${mmdd(c.reception_date)}` : ''
                    return (
                      <div key={c.id}
                        draggable
                        onDragStart={() => setDragId(c.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null) }}
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className={`bg-white border border-gray-100 rounded-xl shadow-sm p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:-translate-y-0.5 transition ${dragId === c.id ? 'opacity-40' : ''}`}
                        style={{ borderLeft: `3px solid ${stage.color}` }}>
                        <div className="text-[13.5px] font-bold text-gray-800 leading-snug">{c.customer_name}</div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {c.erp_type && <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">{c.erp_type}</span>}
                          {c.connection_method && <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{c.connection_method}</span>}
                        </div>
                        <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-gray-100">
                          <span className="flex items-center gap-1.5 text-[11.5px] text-gray-500">
                            <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-700 grid place-items-center text-[9px] font-extrabold">{c.manager?.[0] || '?'}</span>
                            {c.manager || '-'}
                          </span>
                          {dateLabel && <span className="text-[10.5px] text-gray-400 tabular-nums">{dateLabel}</span>}
                        </div>
                      </div>
                    )
                  })}
                  {items.length === 0 && (
                    <div className="text-center text-[11.5px] text-gray-400 border border-dashed border-gray-300 rounded-xl py-4">
                      {isOver ? '여기에 놓기' : '없음'}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 토스트 */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm font-medium px-4 py-2.5 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}
