import { useEffect, useMemo, useState } from 'react'
import { loadSendLog, type SendLogRow } from '../lib/formSend'
import {
  History, RefreshCw, CheckCircle2, XCircle, Filter,
} from 'lucide-react'

const KIND_TONE: Record<string, string> = {
  자동: 'bg-emerald-100 text-emerald-700',
  수동: 'bg-blue-100 text-blue-700',
  테스트: 'bg-violet-100 text-violet-700',
}

export default function GoogleFormSendLog() {
  const [log, setLog] = useState<SendLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [kindFilter, setKindFilter] = useState<string>('전체')
  const [resultFilter, setResultFilter] = useState<string>('전체')

  const load = async () => setLog(await loadSendLog())
  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])
  const handleRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false) }

  const filtered = useMemo(() => log.filter((r) =>
    (kindFilter === '전체' || r.kind === kindFilter) &&
    (resultFilter === '전체' || r.result === resultFilter)
  ), [log, kindFilter, resultFilter])

  const stats = useMemo(() => {
    const total = log.length
    const ok = log.filter((r) => r.result === '성공').length
    const fail = log.filter((r) => r.result === '실패').length
    return { total, ok, fail }
  }, [log])

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><History size={16} className="text-emerald-600" /></span>
          <h2 className="text-2xl font-bold text-gray-800">발송 이력</h2>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> 새로고침
        </button>
      </div>
      <p className="text-sm text-gray-400 mb-5">자동/수동 발송 결과가 시간순으로 기록됩니다. 실패 건(이메일 미입력·형식오류 등)을 여기서 확인하세요.</p>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: '전체 발송', value: stats.total, tone: 'text-slate-700' },
          { label: '성공', value: stats.ok, tone: 'text-emerald-600' },
          { label: '실패', value: stats.fail, tone: 'text-red-500' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-500 mb-1">{c.label}</p>
            <p className={`text-2xl font-bold ${c.tone}`}>{c.value}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span></p>
          </div>
        ))}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <Filter size={14} className="text-gray-400" />
        {['전체', '자동', '수동', '테스트'].map((k) => (
          <button key={k} onClick={() => setKindFilter(k)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition ${kindFilter === k ? 'bg-slate-700 text-white border-slate-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{k}</button>
        ))}
        <span className="w-px h-4 bg-gray-200 mx-1" />
        {['전체', '성공', '실패'].map((r) => (
          <button key={r} onClick={() => setResultFilter(r)}
            className={`text-xs px-2.5 py-1 rounded-lg border transition ${resultFilter === r ? (r === '실패' ? 'bg-red-500 text-white border-red-500' : 'bg-emerald-600 text-white border-emerald-600') : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{r}</button>
        ))}
        <span className="ml-auto text-xs text-gray-400">{filtered.length}건</span>
      </div>

      {/* 이력 테이블 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs text-gray-500">
                <th className="px-4 py-2.5 font-medium whitespace-nowrap">발송일시</th>
                <th className="px-4 py-2.5 font-medium">구분</th>
                <th className="px-4 py-2.5 font-medium">업체명</th>
                <th className="px-4 py-2.5 font-medium">이메일</th>
                <th className="px-4 py-2.5 font-medium">결과</th>
                <th className="px-4 py-2.5 font-medium">사유</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-gray-400">발송 이력이 없습니다.</td></tr>
              ) : filtered.map((r, i) => (
                <tr key={i} className={r.result === '실패' ? 'bg-red-50/40' : 'hover:bg-gray-50/60'}>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap tabular-nums">{r.when}</td>
                  <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium ${KIND_TONE[r.kind] || 'bg-gray-100 text-gray-600'}`}>{r.kind}</span></td>
                  <td className="px-4 py-2.5 text-gray-800 font-medium">{r.name || '-'}</td>
                  <td className="px-4 py-2.5 text-gray-500">{r.email || '-'}</td>
                  <td className="px-4 py-2.5">
                    {r.result === '성공'
                      ? <span className="inline-flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 size={14} /> 성공</span>
                      : <span className="inline-flex items-center gap-1 text-red-500 font-medium"><XCircle size={14} /> 실패</span>}
                  </td>
                  <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[240px] truncate" title={r.reason}>{r.reason || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        ※ “형식은 맞지만 존재하지 않는 주소”는 발송 시점엔 성공으로 기록되고, 이후 발송 계정 메일함에 반송(bounce) 메일로 돌아옵니다.
      </p>
    </div>
  )
}
