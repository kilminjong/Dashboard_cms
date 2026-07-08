import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers, updateBranchqInSheet } from '../lib/googleSheets'
import { loadBranchqRecords, upsertBranchqRecord, removeBranchqRecord, deleteVocByCustomer, statusTone, BUILD_STATUSES, POC_MANAGERS, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import { Search, X, Plus, Trash2, Rocket, RefreshCw, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface Row {
  customer_number: string
  customer_name: string
  business_number: string
  management_code: string
  poc_manager: string
  build_status: string
  build_date: string
  rec: BranchQRecord
}

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

export default function BranchQList() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [records, setRecords] = useState<BranchQRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('전체')
  const [managerFilter, setManagerFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [addSearch, setAddSearch] = useState('')
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400) }

  const load = async () => {
    setLoading(true)
    let cust: any[] = []
    try { cust = await fetchCustomers() } catch { /* 오프라인 */ }
    if ((!cust || cust.length === 0) && isDev) cust = DEV_MOCK_CUSTOMERS
    setCustomers(cust || [])
    setRecords(await loadBranchqRecords())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const custByNumber = useMemo(() => {
    const m = new Map<string, any>()
    customers.forEach((c) => { if (c.customer_number) m.set(String(c.customer_number), c) })
    return m
  }, [customers])

  // POC 대상 = 등록된 레코드. 시트의 구축여부/일자를 기본값으로 병합.
  const rows: Row[] = useMemo(() => records.map((rec) => {
    const m = custByNumber.get(String(rec.customer_number)) || {}
    return {
      customer_number: rec.customer_number,
      customer_name: rec.customer_name || m.customer_name || '-',
      business_number: rec.business_number || m.business_number || '-',
      management_code: rec.management_code || m.management_code || '-',
      poc_manager: rec.poc_manager || '',
      build_status: rec.build_status || m.branchq_status || '구축대기',
      build_date: rec.build_date || m.branchq_date || '',
      rec,
    }
  }), [records, custByNumber])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows
      .filter((r) => statusFilter === '전체' || r.build_status === statusFilter)
      .filter((r) => managerFilter === '전체' || (managerFilter === '미배정' ? !r.poc_manager : r.poc_manager === managerFilter))
      .filter((r) => !q || r.customer_name.toLowerCase().includes(q) || String(r.customer_number).includes(q) || String(r.business_number).includes(q))
  }, [rows, statusFilter, managerFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: rows.length }
    BUILD_STATUSES.forEach((s) => { c[s] = rows.filter((r) => r.build_status === s).length })
    return c
  }, [rows])

  // 추가 모달: 아직 POC에 없는 고객 검색
  const addCandidates = useMemo(() => {
    const existing = new Set(records.map((r) => String(r.customer_number)))
    const q = addSearch.trim().toLowerCase()
    if (!q) return [] as any[]
    return customers
      .filter((c) => c.customer_number && !existing.has(String(c.customer_number)))
      .filter((c) =>
        c.customer_name?.toLowerCase().includes(q) ||
        String(c.customer_number).toLowerCase().includes(q) ||
        String(c.business_number || '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [customers, records, addSearch])

  const addToPoc = async (c: any) => {
    const status = c.branchq_status || '구축대기'
    const date = c.branchq_date || ''
    await upsertBranchqRecord({
      customer_number: String(c.customer_number),
      management_code: c.management_code || '',
      customer_name: c.customer_name || '',
      business_number: c.business_number || '',
      build_status: status,
      build_date: date,
    })
    // POC 추가 시 구글시트(브랜치Q 구축여부)에도 즉시 반영
    let sheetMsg = ''
    if (Array.isArray(c._raw)) {
      try { await updateBranchqInSheet(c, status, date); sheetMsg = ' · 시트 반영됨' } catch { sheetMsg = ' · 시트 반영 실패' }
    }
    setRecords(await loadBranchqRecords())
    showToast(`${c.customer_name || '고객'} 추가됨${sheetMsg}`)
  }

  // 제외 확인 모달
  const [removeTarget, setRemoveTarget] = useState<Row | null>(null)
  const [removing, setRemoving] = useState(false)
  const removeFromPoc = (e: React.MouseEvent, row: Row) => {
    e.stopPropagation()
    setRemoveTarget(row)
  }
  const confirmRemove = async (withVoc: boolean) => {
    if (!removeTarget) return
    setRemoving(true)
    try {
      const name = removeTarget.customer_name
      await removeBranchqRecord(removeTarget.customer_number)
      if (withVoc) await deleteVocByCustomer(removeTarget.customer_number)
      setRecords(await loadBranchqRecords())
      setRemoveTarget(null)
      showToast(`${name} POC 제외됨${withVoc ? ' · VOC 삭제' : ' · VOC 유지'}`)
    } finally { setRemoving(false) }
  }

  // 목록에서 POC 담당자 바로 배정 (Supabase branchq_poc)
  const [savingMgr, setSavingMgr] = useState<string | null>(null)
  const changeManager = async (row: Row, newManager: string) => {
    if (newManager === row.poc_manager) return
    setSavingMgr(row.customer_number)
    try {
      await upsertBranchqRecord({ ...row.rec, customer_number: row.customer_number, poc_manager: newManager })
      await loadBranchqRecords().then(setRecords)
      showToast(newManager ? `담당자: ${newManager}` : '담당자 배정 해제')
    } finally { setSavingMgr(null) }
  }

  // 목록에서 구축여부 바로 수정 (상세 진입 없이) → Supabase + 구글시트 동시 반영
  const [savingNo, setSavingNo] = useState<string | null>(null)
  const changeStatus = async (row: Row, newStatus: string) => {
    if (newStatus === row.build_status) return
    setSavingNo(row.customer_number)
    try {
      await upsertBranchqRecord({ ...row.rec, customer_number: row.customer_number, build_status: newStatus })
      const master = custByNumber.get(String(row.customer_number))
      let sheetMsg = ''
      if (master && Array.isArray(master._raw)) {
        try { await updateBranchqInSheet(master, newStatus, row.build_date || ''); sheetMsg = ' · 시트 반영됨' } catch { sheetMsg = ' · 시트 반영 실패' }
      }
      await loadBranchqRecords().then(setRecords)
      if (newStatus === '구축완료' && !row.build_date) showToast(`‘구축완료’로 변경됨. 구축일자는 상세에서 입력하세요.`)
      else showToast(`구축여부: ${newStatus}${sheetMsg}`)
    } finally { setSavingNo(null) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><Rocket size={17} className="text-emerald-600" /></span>
            <h2 className="text-2xl font-bold text-gray-800">POC 대상고객 관리</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">브랜치Q POC 대상으로 선정된 고객을 관리합니다. 고객명을 클릭하면 상세·VOC를 확인할 수 있습니다.</p>
        </div>
        <button onClick={() => { setShowAdd(true); setAddSearch('') }}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm shrink-0">
          <Plus size={15} /> 고객 추가
        </button>
      </div>

      {/* 상태 필터 + 검색 */}
      <div className="flex items-center gap-1.5 flex-wrap mb-4">
        {['전체', ...BUILD_STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${statusFilter === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s} <span className={statusFilter === s ? 'text-emerald-100' : 'text-gray-400'}>{counts[s] ?? 0}</span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <select value={managerFilter} onChange={(e) => setManagerFilter(e.target.value)}
            className="py-1.5 pl-2.5 pr-7 border border-gray-300 rounded-lg text-xs font-semibold text-gray-600 outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
            <option value="전체">담당자 전체</option>
            <option value="미배정">미배정</option>
            {POC_MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명·번호 검색"
              className="pl-8 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"><X size={13} /></button>}
          </div>
        </div>
      </div>

      {/* 목록 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <th className="text-center px-3 py-3 text-xs font-bold w-14">순번</th>
                <th className="text-left px-4 py-3 text-xs font-bold">고객명</th>
                <th className="text-left px-4 py-3 text-xs font-bold">고객번호</th>
                <th className="text-left px-4 py-3 text-xs font-bold">사업자번호</th>
                <th className="text-center px-4 py-3 text-xs font-bold">POC 담당자</th>
                <th className="text-center px-4 py-3 text-xs font-bold">브랜치Q 구축여부</th>
                <th className="text-center px-4 py-3 text-xs font-bold">브랜치Q 구축일자</th>
                <th className="px-2 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-14 text-gray-400 text-sm">
                  {rows.length === 0 ? '아직 POC 대상고객이 없습니다. ‘고객 추가’로 선정하세요.' : '해당 상태의 고객이 없습니다.'}
                </td></tr>
              ) : filtered.map((r, i) => (
                <tr key={r.customer_number} onClick={() => navigate(`/branchq/customer/${encodeURIComponent(r.customer_number)}`)}
                  className="hover:bg-emerald-50/30 cursor-pointer transition group">
                  <td className="text-center px-3 py-3 text-gray-400 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-800 group-hover:text-emerald-700 inline-flex items-center gap-1">{r.customer_name}<ChevronRight size={13} className="opacity-0 group-hover:opacity-100 text-emerald-500" /></span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">{r.customer_number}</td>
                  <td className="px-4 py-3 text-gray-600 tabular-nums">{r.business_number}</td>
                  <td className="text-center px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <select value={r.poc_manager} disabled={savingMgr === r.customer_number} onChange={(e) => changeManager(r, e.target.value)}
                        className={`appearance-none cursor-pointer text-center pl-3 pr-6 py-1 rounded-lg text-xs font-semibold border outline-none focus:ring-2 focus:ring-emerald-400 bg-[length:12px] bg-[right_0.4rem_center] bg-no-repeat ${r.poc_manager ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-400'}`}
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
                        <option value="">미배정</option>
                        {POC_MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                      {savingMgr === r.customer_number && <RefreshCw size={12} className="animate-spin text-gray-400" />}
                    </div>
                  </td>
                  <td className="text-center px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      <select value={r.build_status} disabled={savingNo === r.customer_number} onChange={(e) => changeStatus(r, e.target.value)}
                        className={`appearance-none cursor-pointer text-center pl-3 pr-6 py-1 rounded-full text-xs font-bold border-0 outline-none focus:ring-2 focus:ring-emerald-400 bg-[length:14px] bg-[right_0.4rem_center] bg-no-repeat ${statusTone(r.build_status)}`}
                        style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
                        {BUILD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {savingNo === r.customer_number && <RefreshCw size={12} className="animate-spin text-gray-400" />}
                    </div>
                  </td>
                  <td className="text-center px-4 py-3 text-gray-600 tabular-nums">{r.build_date || '-'}</td>
                  <td className="px-2 py-3 text-center">
                    <button onClick={(e) => removeFromPoc(e, r)} className="p-1.5 text-gray-300 hover:text-red-500 rounded transition" title="POC 대상에서 제외"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">* 구축여부·구축일자는 구글시트(브랜치Q 구축여부/구축일자 컬럼)에서 자동으로 읽어오며, 상세 화면에서 앱 관리값으로 덮어쓸 수 있습니다.</p>

      {/* 고객 추가 모달 */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center p-4 pt-[10vh]" onClick={() => setShowAdd(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[70vh]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">POC 대상고객 추가</h3>
                <p className="text-xs text-gray-400 mt-0.5">고객원장에서 검색하여 선정합니다.</p>
              </div>
              <button onClick={() => setShowAdd(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input autoFocus value={addSearch} onChange={(e) => setAddSearch(e.target.value)}
                  placeholder="고객명, 고객번호, 사업자번호 검색..."
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {!addSearch.trim() ? (
                <p className="text-center py-10 text-gray-400 text-sm">고객명 또는 번호를 검색하세요.</p>
              ) : addCandidates.length === 0 ? (
                <p className="text-center py-10 text-gray-400 text-sm">검색 결과가 없습니다. (이미 추가된 고객은 제외)</p>
              ) : addCandidates.map((c) => (
                <button key={c.id || c.customer_number} onClick={() => addToPoc(c)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-emerald-50 text-left transition">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 text-sm truncate">{c.customer_name}</p>
                    <p className="text-xs text-gray-400 tabular-nums">{c.customer_number || '-'} · {c.business_number || '-'} · {c.manager || '-'}</p>
                  </div>
                  <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-emerald-600"><Plus size={13} /> 추가</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* POC 제외 확인 모달 */}
      {removeTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !removing && setRemoveTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-red-50 grid place-items-center shrink-0"><AlertTriangle size={20} className="text-red-500" /></span>
              <div>
                <h3 className="text-lg font-bold text-gray-800">POC 대상 제외</h3>
                <p className="text-sm text-gray-500 mt-1"><b className="text-gray-700">{removeTarget.customer_name}</b>을(를) POC 대상에서 제외합니다.</p>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5">
              <p className="text-sm text-amber-800 leading-relaxed">POC 제외 시 이 고객의 <b>VOC도 함께 삭제됩니다.</b> 삭제하시겠습니까?<br /><span className="text-xs text-amber-600">‘VOC 유지’를 누르면 VOC 기록은 보존됩니다.</span></p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <button onClick={() => setRemoveTarget(null)} disabled={removing} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">취소</button>
              <button onClick={() => confirmRemove(false)} disabled={removing} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-semibold disabled:opacity-50">VOC 유지</button>
              <button onClick={() => confirmRemove(true)} disabled={removing} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-50">VOC도 함께 삭제</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}
