import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { loadBranchqRecords, getNotes, statusTone, BUILD_STATUSES, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import { ClipboardList, RefreshCw, Search, X, ChevronRight } from 'lucide-react'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

interface Row {
  customer_number: string
  customer_name: string
  build_status: string
  notes: string
}

export default function BranchQNotes() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('전체')
  const [search, setSearch] = useState('')

  useEffect(() => {
    ;(async () => {
      let cust: any[] = []
      try { cust = await fetchCustomers() } catch { /* 오프라인 */ }
      if ((!cust || cust.length === 0) && isDev) cust = DEV_MOCK_CUSTOMERS
      setCustomers(cust || [])
      setRecords(await loadBranchqRecords())
      setLoading(false)
    })()
  }, [])

  const custByNumber = useMemo(() => {
    const m = new Map<string, any>()
    customers.forEach((c) => { if (c.customer_number) m.set(String(c.customer_number), c) })
    return m
  }, [customers])

  const rows: Row[] = useMemo(() => records.map((rec) => {
    const m = custByNumber.get(String(rec.customer_number)) || {}
    return {
      customer_number: rec.customer_number,
      customer_name: rec.customer_name || m.customer_name || '-',
      build_status: rec.build_status || m.branchq_status || '구축대기',
      notes: getNotes(rec),
    }
  }), [records, custByNumber])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => statusFilter === '전체' || r.build_status === statusFilter)
      .filter((r) => !q || r.customer_name.toLowerCase().includes(q) || String(r.customer_number).includes(q) || r.notes.toLowerCase().includes(q))
  }, [rows, statusFilter, search])

  const withNotes = filtered.filter((r) => r.notes.trim()).length

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><ClipboardList size={17} className="text-emerald-600" /></span>
            <h2 className="text-2xl font-bold text-gray-800">안내·문의 현황</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">전체 POC 대상고객의 ‘고객 안내사항 및 문의사항’을 한눈에 확인합니다. (작성 {withNotes} / 전체 {filtered.length})</p>
        </div>
      </div>

      {/* 필터 + 검색 */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {['전체', ...BUILD_STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${statusFilter === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명·내용 검색"
            className="pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-52" />
          {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={13} /></button>}
        </div>
      </div>

      {/* 카드 그리드 */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 text-gray-400 text-sm">표시할 고객이 없습니다.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((r) => (
            <div key={r.customer_number} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
              <div onClick={() => navigate(`/branchq/customer/${encodeURIComponent(r.customer_number)}`)}
                className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 cursor-pointer hover:bg-emerald-50/30 group">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusTone(r.build_status)}`}>{r.build_status}</span>
                <h3 className="font-bold text-gray-800 group-hover:text-emerald-700 truncate">{r.customer_name}</h3>
                <span className="text-xs text-gray-400 tabular-nums shrink-0">{r.customer_number}</span>
                <ChevronRight size={15} className="ml-auto text-gray-300 group-hover:text-emerald-500 shrink-0" />
              </div>
              <div className="p-4 flex-1">
                {r.notes.trim() ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">{r.notes}</p>
                ) : (
                  <p className="text-sm text-gray-300">아직 작성된 안내·문의 내용이 없습니다.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
