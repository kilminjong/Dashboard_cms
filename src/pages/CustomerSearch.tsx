import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchCustomers } from '../lib/googleSheets'
import { Search, User, X, ChevronLeft } from 'lucide-react'

// 진행 단계 색상 판단
const stepTone = (kind: string, status?: string): string => {
  if (kind === 'opening') {
    if (!status) return 'todo'
    if (status.includes('완료')) return 'done'
    if (status.includes('취소')) return 'cancel'
    if (status.includes('진행')) return 'now'
    return 'wait'
  }
  if (kind === 'connection') {
    if (!status) return 'todo'
    if (status.includes('완료')) return 'done'
    if (status.includes('진행')) return 'now'
    return 'wait'
  }
  return 'todo'
}
const TONE_ICO: Record<string, string> = {
  done: 'bg-emerald-100 text-emerald-700',
  now: 'bg-blue-100 text-blue-700 ring-[3px] ring-blue-50',
  wait: 'bg-amber-100 text-amber-700',
  cancel: 'bg-red-100 text-red-600',
  todo: 'bg-gray-100 text-gray-400',
}

export default function CustomerSearch() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 30

  useEffect(() => { loadCustomers() }, [])

  const loadCustomers = async () => {
    try {
      const data = await fetchCustomers()
      setCustomers(data || [])
    } catch (err) {
      console.error('고객 데이터 로드 실패:', err)
    }
    setLoading(false)
  }

  const statusBadge = (s: string) => {
    if (s === '개설완료' || s === '이행완료') return 'bg-emerald-100 text-emerald-700'
    if (s === '개설대기') return 'bg-amber-100 text-amber-700'
    if (s === '개설진행') return 'bg-blue-100 text-blue-700'
    if (s === '개설취소') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
  }

  // 검색 필터
  const filtered = search.trim()
    ? customers.filter((c) => {
        const q = search.toLowerCase()
        return c.customer_name?.toLowerCase().includes(q) ||
          c.business_number?.toLowerCase().includes(q) ||
          c.customer_number?.toLowerCase().includes(q) ||
          c.manager?.toLowerCase().includes(q)
      })
    : customers

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  // 모바일: 선택된 고객이 있으면 상세만 보기
  const showDetail = !!selectedCustomer

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">고객 상세 정보</h2>
          <p className="text-sm text-gray-400 mt-0.5">고객을 선택하면 상세 정보를 확인할 수 있습니다.</p>
        </div>
        <span className="text-sm text-gray-400">전체 {customers.length.toLocaleString()}건</span>
      </div>

      <div className="flex gap-4 h-[calc(100vh-12rem)] sm:h-[calc(100vh-14rem)]">
        {/* 좌측: 고객 목록 */}
        <div className={`${showDetail ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[380px] shrink-0`}>
          {/* 검색 */}
          <div className="relative mb-3">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="고객명, 사업자번호, 고객번호, 담당자 검색..."
              className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                <X size={14} />
              </button>
            )}
          </div>

          {search && <p className="text-xs text-gray-400 mb-2">검색 결과: {filtered.length}건</p>}

          {/* 목록 */}
          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {loading ? (
              <p className="text-center py-12 text-gray-400 text-sm">불러오는 중...</p>
            ) : paged.length === 0 ? (
              <p className="text-center py-12 text-gray-400 text-sm">검색 결과가 없습니다.</p>
            ) : (
              paged.map((c) => (
                <div key={c.id}
                  onClick={() => setSelectedCustomer(c)}
                  className={`bg-white rounded-lg border p-3 cursor-pointer transition ${
                    selectedCustomer?.id === c.id
                      ? 'border-emerald-300 bg-emerald-50/40 shadow-sm'
                      : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
                  }`}>
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium text-sm text-gray-800 truncate">{c.customer_name}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ml-2 ${statusBadge(c.opening_status || '')}`}>
                      {c.opening_status || '미정'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{c.customer_number || '-'} · {c.business_number || '-'} · {c.manager || '-'}</p>
                </div>
              ))
            )}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 py-2 mt-2 border-t border-gray-100">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30">이전</button>
              <span className="text-xs text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                className="px-2.5 py-1 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30">다음</button>
            </div>
          )}
        </div>

        {/* 우측: 상세 패널 */}
        <div className={`${showDetail ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          {selectedCustomer ? (() => {
            const sc = selectedCustomer
            const steps = [
              { lab: '신규접수', val: sc.reception_date ? '접수완료' : '미접수', date: sc.reception_date, tone: sc.reception_date ? 'done' : 'todo', mark: '✓' },
              { lab: '개설/이행', val: sc.opening_status || '미정', date: sc.opening_date, tone: stepTone('opening', sc.opening_status), mark: '2' },
              { lab: 'ERP연계', val: sc.connection_status || '연계대기', date: sc.connection_date, tone: stepTone('connection', sc.connection_status), mark: '3' },
              { lab: '해지', val: sc.termination_date ? '해지' : '해당없음', date: sc.termination_date, tone: sc.termination_date ? 'cancel' : 'todo', mark: sc.termination_date ? '!' : '·' },
            ]
            const persons = [
              { n: sc.customer_contact_person, d: sc.customer_department, p: sc.contact_phone, e: sc.contact_email },
              { n: sc.customer_contact_person2, d: sc.customer_department2, p: sc.contact_phone2, e: sc.contact_email2 },
              { n: sc.customer_contact_person3, d: sc.customer_department3, p: sc.contact_phone3, e: sc.contact_email3 },
            ]
            const Row = ({ k, v, mono }: { k: string; v?: string; mono?: boolean }) => (
              <div className="flex gap-2.5 px-3 py-1.5 text-xs odd:bg-[#FAFCFB]">
                <span className="w-[70px] shrink-0 text-gray-400 font-semibold">{k}</span>
                <span className={`text-gray-800 break-all ${mono ? 'tabular-nums' : ''} ${v ? '' : 'text-gray-300'}`}>{v || '-'}</span>
              </div>
            )
            return (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden w-full flex flex-col">
                <div className="flex-1 overflow-y-auto p-4">
                  {/* 헤더 */}
                  <div className="flex items-start gap-3 pb-3.5 border-b border-gray-100">
                    <button onClick={() => setSelectedCustomer(null)} className="lg:hidden w-8 h-8 grid place-items-center rounded-lg border border-gray-200 text-gray-500 shrink-0"><ChevronLeft size={16} /></button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-xl font-bold text-gray-800 truncate">{sc.customer_name}</h3>
                        {sc.opening_status && <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusBadge(sc.opening_status)}`}>{sc.opening_status}</span>}
                        {sc.management_type && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">{sc.management_type}</span>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {([['고객번호', sc.customer_number], ['사업자', sc.business_number], ['담당', sc.manager], ['친밀도', sc.intimacy]] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
                          <span key={k} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 rounded-lg px-2.5 py-1"><span className="text-gray-400 text-[11px] font-semibold">{k}</span><span className="text-gray-800 font-bold tabular-nums">{v}</span></span>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => navigate(`/customers/${sc.id}`)} className="shrink-0 h-9 px-3 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition">수정 / 메모</button>
                  </div>

                  {/* 진행 스테퍼 */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 my-3.5">
                    {steps.map((s) => (
                      <div key={s.lab} className="border border-gray-100 rounded-lg p-2.5 bg-[#FBFDFC]">
                        <div className="text-[10.5px] text-gray-400 font-semibold mb-1.5 tabular-nums">{s.date || (s.tone === 'now' ? '진행중' : s.tone === 'wait' ? '대기' : '—')}</div>
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full grid place-items-center text-[11px] font-extrabold shrink-0 ${TONE_ICO[s.tone]}`}>{s.mark}</span>
                          <div className="min-w-0"><div className="text-[10.5px] text-gray-400 font-semibold">{s.lab}</div><div className={`text-xs font-bold truncate ${s.tone === 'todo' ? 'text-gray-400' : 'text-gray-800'}`}>{s.val}</div></div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 정보 그리드 */}
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100"><span className="w-5 h-5 rounded grid place-items-center bg-emerald-50 text-emerald-600 text-[11px]">▦</span><h4 className="text-xs font-bold text-gray-800">고객 기본정보</h4></div>
                      <Row k="구축구분" v={sc.build_type} />
                      <Row k="관리구분" v={sc.management_type} />
                      <Row k="구축형" v={sc.construction_type} />
                      <Row k="주소" v={sc.address} />
                      <Row k="민감고객" v={sc.sensitive_customer} />
                      <Row k="친밀도" v={sc.intimacy} />
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100"><span className="w-5 h-5 rounded grid place-items-center bg-blue-50 text-blue-600 text-[11px]">⛳</span><h4 className="text-xs font-bold text-gray-800">계약 현황</h4></div>
                      <Row k="신규접수" v={sc.reception_date} mono />
                      <Row k="개설/이행" v={sc.opening_date} mono />
                      <Row k="연계일자" v={sc.connection_date} mono />
                      <Row k="해지일자" v={sc.termination_date} mono />
                      <Row k="CMS IP" v={sc.cms_ip} mono />
                    </div>
                    <div className="border border-gray-100 rounded-xl overflow-hidden xl:col-span-2">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100"><span className="w-5 h-5 rounded grid place-items-center bg-violet-50 text-violet-600 text-[11px]">🖥</span><h4 className="text-xs font-bold text-gray-800">ERP · 서버 정보</h4></div>
                      <div className="grid grid-cols-1 sm:grid-cols-2">
                        <div>
                          <Row k="ERP회사" v={sc.erp_company} />
                          <Row k="ERP종류" v={sc.erp_type} />
                          <Row k="ERP DB" v={sc.erp_db} />
                          <Row k="연계방식" v={sc.connection_method} />
                        </div>
                        <div>
                          <Row k="서버위치" v={sc.server_location} />
                          <Row k="스케줄" v={sc.schedule_use} />
                          <Row k="고객사IP" v={sc.customer_ip} mono />
                          <Row k="CMS IP" v={sc.cms_ip} mono />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 담당자 */}
                  <p className="text-[10.5px] font-bold tracking-wider text-gray-400 uppercase mt-3.5 mb-2 ml-1">담당자</p>
                  <div className="border border-gray-100 rounded-xl overflow-hidden grid grid-cols-1 sm:grid-cols-3">
                    {persons.map((p, i) => (
                      <div key={i} className={`p-3 ${i >= 1 ? 'border-t sm:border-t-0 sm:border-l border-gray-100' : ''}`}>
                        {p.n ? (
                          <>
                            <div className="flex items-center gap-2 mb-1.5">
                              <span className="w-7 h-7 rounded-full grid place-items-center bg-emerald-50 text-emerald-700 font-extrabold text-xs shrink-0">{p.n.slice(0, 1)}</span>
                              <div className="min-w-0"><div className="text-[13px] font-bold text-gray-800 truncate">{p.n}</div>{p.d && <div className="text-[10.5px] text-gray-400 font-semibold">{p.d}</div>}</div>
                            </div>
                            {p.p && <a href={`tel:${p.p}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-emerald-700 py-0.5"><span className="text-gray-400 w-3.5 text-center">☎</span><span className="tabular-nums">{p.p}</span></a>}
                            {p.e && <a href={`mailto:${p.e}`} className="flex items-center gap-1.5 text-xs text-gray-600 hover:text-emerald-700 py-0.5 break-all"><span className="text-gray-400 w-3.5 text-center">✉</span>{p.e}</a>}
                          </>
                        ) : <div className="min-h-[56px] grid place-items-center text-[11px] text-gray-300">담당자 {i + 1} 미등록</div>}
                      </div>
                    ))}
                  </div>

                  {/* 명함 */}
                  {sc.business_card_url && (
                    <div className="border border-gray-100 rounded-xl overflow-hidden mt-3">
                      <div className="px-3 py-2 border-b border-gray-100"><h4 className="text-xs font-bold text-gray-600">담당자 명함</h4></div>
                      <div className="p-3"><a href={sc.business_card_url} target="_blank" rel="noopener noreferrer"><img src={sc.business_card_url} alt="명함" className="rounded-lg max-h-[150px] w-auto" /></a></div>
                    </div>
                  )}
                </div>
              </div>
            )
          })() : (
            <div className="flex items-center justify-center w-full h-full">
              <div className="text-center">
                <User size={48} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">좌측 목록에서 고객을 선택하면<br />상세 정보가 여기에 표시됩니다.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
