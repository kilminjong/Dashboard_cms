import { useEffect, useMemo, useState } from 'react'
import { POC_MANAGERS } from '../lib/branchq'
import {
  loadTestQuestions, loadTestItems, upsertTestItem, bulkAssignManager, testStatusTone,
  TEST_STATUSES, type TestQuestion, type TestItemState,
} from '../lib/testItems'
import {
  ClipboardList, RefreshCw, Search, CheckCircle2, Circle, UserCog, Users, X,
} from 'lucide-react'

interface Row extends TestQuestion, TestItemState {}

export default function BranchQTest() {
  const [questions, setQuestions] = useState<TestQuestion[]>([])
  const [items, setItems] = useState<Map<string, TestItemState>>(new Map())
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [managerFilter, setManagerFilter] = useState('전체')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkManager, setBulkManager] = useState('')
  const [savingSeq, setSavingSeq] = useState<string | null>(null)
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400) }

  const load = async () => {
    const [qs, its] = await Promise.all([loadTestQuestions(), loadTestItems()])
    setQuestions(qs)
    setItems(its)
  }
  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])
  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const rows: Row[] = useMemo(() => questions.map((q) => ({ ...q, ...(items.get(q.seq) || {}) })), [questions, items])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows
      .filter((r) => managerFilter === '전체' || (managerFilter === '미배정' ? !r.poc_manager : r.poc_manager === managerFilter))
      .filter((r) => statusFilter === '전체' || (r.status || '대기') === statusFilter)
      .filter((r) => !kw || r.question.toLowerCase().includes(kw) || String(r.seq).includes(kw))
  }, [rows, managerFilter, statusFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: rows.length, 미배정: rows.filter((r) => !r.poc_manager).length }
    POC_MANAGERS.forEach((m) => { c[m] = rows.filter((r) => r.poc_manager === m).length })
    return c
  }, [rows])

  const patch = async (seq: string, field: keyof TestItemState, value: string) => {
    const cur = items.get(seq) || { seq }
    const next = { ...cur, seq, [field]: value }
    setItems((prev) => new Map(prev).set(seq, next)) // 즉시 반영
    setSavingSeq(seq)
    try { await upsertTestItem(next) } finally { setSavingSeq(null) }
  }

  const toggle = (seq: string) => setSelected((prev) => { const n = new Set(prev); n.has(seq) ? n.delete(seq) : n.add(seq); return n })
  const allVisibleSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.seq))
  const toggleAll = () => setSelected(allVisibleSelected ? new Set() : new Set(filtered.map((r) => r.seq)))

  const doBulkAssign = async () => {
    if (selected.size === 0) { showToast('선택된 질문이 없습니다.'); return }
    const seqs = [...selected]
    await bulkAssignManager(seqs, bulkManager, items)
    setItems((prev) => { const n = new Map(prev); seqs.forEach((s) => n.set(s, { ...(n.get(s) || { seq: s }), seq: s, poc_manager: bulkManager })); return n })
    showToast(`${seqs.length}건 담당자 ${bulkManager || '미배정'} 지정`)
    setSelected(new Set())
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><ClipboardList size={17} className="text-emerald-600" /></span>
          <h2 className="text-2xl font-bold text-gray-800">브랜치Q 테스트 관리</h2>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-4">구글시트 ‘테스트항목’ 탭의 점검 항목을 담당자별로 배정하고, 데이터 정합성 테스트 진행·결과·신고를 관리합니다.</p>

      {/* 담당자 필터 (본인 것만 보기) */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-xs font-semibold text-gray-400 mr-1">담당자</span>
        {['전체', '미배정', ...POC_MANAGERS].map((m) => (
          <button key={m} onClick={() => setManagerFilter(m)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${managerFilter === m ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {m} <span className={managerFilter === m ? 'text-emerald-100' : 'text-gray-400'}>{counts[m] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* 상태 필터 + 검색 */}
      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className="text-xs font-semibold text-gray-400 mr-1">진행</span>
        {['전체', ...TEST_STATUSES].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition ${statusFilter === s ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="질문·순번 검색"
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
        </div>
      </div>

      {/* 일괄 담당자 지정 바 (선택 시 노출) */}
      {selected.size > 0 && (
        <div className="mb-3 rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-emerald-800 inline-flex items-center gap-1.5"><Users size={15} /> {selected.size}건 선택</span>
          <div className="flex items-center gap-2 ml-auto">
            <select value={bulkManager} onChange={(e) => setBulkManager(e.target.value)}
              className="py-1.5 pl-2.5 pr-7 border border-emerald-200 rounded-lg text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer">
              <option value="">미배정</option>
              {POC_MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <button onClick={doBulkAssign} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition">
              <UserCog size={14} /> 담당자 일괄 지정
            </button>
            <button onClick={() => setSelected(new Set())} className="p-1.5 text-emerald-500 hover:text-emerald-700"><X size={15} /></button>
          </div>
        </div>
      )}

      {/* 표 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <th className="px-3 py-3 w-10 text-center">
                  <button onClick={toggleAll} className="align-middle">
                    {allVisibleSelected ? <CheckCircle2 size={17} className="text-emerald-500" /> : <Circle size={17} className="text-gray-300" />}
                  </button>
                </th>
                <th className="text-center px-3 py-3 text-xs font-bold w-14">순번</th>
                <th className="text-left px-4 py-3 text-xs font-bold min-w-[240px]">테스트 항목</th>
                <th className="text-center px-4 py-3 text-xs font-bold w-32">담당자</th>
                <th className="text-center px-4 py-3 text-xs font-bold w-28">테스트 진행여부</th>
                <th className="text-left px-4 py-3 text-xs font-bold min-w-[180px]">결과(정합성)</th>
                <th className="text-left px-4 py-3 text-xs font-bold min-w-[160px]">신고 내용</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-14 text-gray-400 text-sm">
                  {rows.length === 0 ? "구글시트 ‘테스트항목’ 탭에 항목을 입력해주세요 (순번·테스트항목)." : '조건에 맞는 항목이 없습니다.'}
                </td></tr>
              ) : filtered.map((r) => (
                <tr key={r.seq} className={`transition ${selected.has(r.seq) ? 'bg-emerald-50/40' : 'hover:bg-gray-50/60'}`}>
                  <td className="px-3 py-2.5 text-center">
                    <button onClick={() => toggle(r.seq)}>
                      {selected.has(r.seq) ? <CheckCircle2 size={17} className="text-emerald-500" /> : <Circle size={17} className="text-gray-300" />}
                    </button>
                  </td>
                  <td className="text-center px-3 py-2.5 text-gray-400 tabular-nums">{r.seq}</td>
                  <td className="px-4 py-2.5 text-gray-800 leading-snug">{r.question}</td>
                  <td className="text-center px-4 py-2.5">
                    <select value={r.poc_manager || ''} onChange={(e) => patch(r.seq, 'poc_manager', e.target.value)}
                      className={`appearance-none cursor-pointer text-center pl-3 pr-6 py-1 rounded-lg text-xs font-semibold border outline-none focus:ring-2 focus:ring-emerald-400 bg-[length:12px] bg-[right_0.4rem_center] bg-no-repeat ${r.poc_manager ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-400'}`}
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
                      <option value="">미배정</option>
                      {POC_MANAGERS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </td>
                  <td className="text-center px-4 py-2.5">
                    <select value={r.status || '대기'} onChange={(e) => patch(r.seq, 'status', e.target.value)}
                      className={`appearance-none cursor-pointer text-center pl-3 pr-6 py-1 rounded-full text-xs font-bold border-0 outline-none focus:ring-2 focus:ring-emerald-400 bg-[length:12px] bg-[right_0.4rem_center] bg-no-repeat ${testStatusTone(r.status)}`}
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='3'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E\")" }}>
                      {TEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5">
                    <input defaultValue={r.result || ''} onBlur={(e) => { if ((e.target.value || '') !== (r.result || '')) patch(r.seq, 'result', e.target.value) }}
                      placeholder="결과 입력"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
                  </td>
                  <td className="px-4 py-2.5">
                    <input defaultValue={r.report || ''} onBlur={(e) => { if ((e.target.value || '') !== (r.report || '')) patch(r.seq, 'report', e.target.value) }}
                      placeholder="신고 내용"
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">* 순번·테스트 항목은 구글시트 ‘테스트항목’ 탭에서 읽어옵니다. 담당자·진행여부·결과·신고는 이 화면에서 수정하면 자동 저장됩니다. {savingSeq && <span className="text-emerald-500">저장 중…</span>}</p>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}
