import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { loadBranchqRecords, statusTone, BUILD_STATUSES, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import { Rocket, RefreshCw, ChevronRight } from 'lucide-react'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

export default function BranchQStatus() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
  const [loading, setLoading] = useState(true)

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

  const rows = useMemo(() => records.map((rec) => {
    const m = custByNumber.get(String(rec.customer_number)) || {}
    return {
      customer_number: rec.customer_number,
      customer_name: rec.customer_name || m.customer_name || '-',
      build_status: rec.build_status || m.branchq_status || '구축대기',
      build_date: rec.build_date || m.branchq_date || '',
      contact_date: rec.contact_date || '',
    }
  }), [records, custByNumber])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    BUILD_STATUSES.forEach((s) => { c[s] = rows.filter((r) => r.build_status === s).length })
    return c
  }, [rows])

  const total = rows.length
  const doneRate = total > 0 ? Math.round((counts['구축완료'] / total) * 100) : 0

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><Rocket size={17} className="text-emerald-600" /></span>
        <h2 className="text-2xl font-bold text-gray-800">POC 진행 현황</h2>
      </div>
      <p className="text-sm text-gray-400 mb-5">브랜치Q POC 대상 {total}개사의 구축 진행 상황 요약입니다.</p>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <p className="text-xs text-gray-500 mb-1">전체 대상</p>
          <p className="text-2xl font-bold text-gray-800">{total}<span className="text-sm font-normal text-gray-400 ml-0.5">개사</span></p>
        </div>
        {BUILD_STATUSES.map((s) => (
          <div key={s} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{s}</p>
            <p className="text-2xl font-bold text-gray-800">{counts[s]}<span className="text-sm font-normal text-gray-400 ml-0.5">개사</span></p>
          </div>
        ))}
      </div>

      {/* 구축 완료율 */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">구축 완료율</p>
          <p className="text-sm font-bold text-emerald-600">{doneRate}% <span className="text-gray-400 font-normal">({counts['구축완료']}/{total})</span></p>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden flex">
          {BUILD_STATUSES.map((s) => {
            const w = total > 0 ? (counts[s] / total) * 100 : 0
            const color = s === '구축완료' ? 'bg-emerald-500' : s === '구축예정' ? 'bg-blue-400' : s === '구축보류' ? 'bg-amber-400' : 'bg-gray-300'
            return w > 0 ? <div key={s} className={color} style={{ width: `${w}%` }} title={`${s} ${counts[s]}`} /> : null
          })}
        </div>
      </div>

      {/* 대상 목록 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50"><h3 className="font-semibold text-gray-700 text-sm">대상고객 목록</h3></div>
        <div className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">POC 대상고객이 없습니다.</p>
          ) : rows.map((r) => (
            <div key={r.customer_number} onClick={() => navigate(`/branchq/customer/${encodeURIComponent(r.customer_number)}`)}
              className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-emerald-50/30 cursor-pointer transition group">
              <div className="flex items-center gap-3 min-w-0">
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusTone(r.build_status)}`}>{r.build_status}</span>
                <span className="font-semibold text-gray-800 group-hover:text-emerald-700 truncate">{r.customer_name}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 text-xs text-gray-400 tabular-nums">
                {r.contact_date && <span>컨택 {r.contact_date}</span>}
                {r.build_date && <span>구축 {r.build_date}</span>}
                <ChevronRight size={14} className="text-gray-300 group-hover:text-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
