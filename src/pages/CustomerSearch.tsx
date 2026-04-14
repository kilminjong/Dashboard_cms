import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, User, Building2, Server, FileText, X, ChevronLeft } from 'lucide-react'

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
    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 9999)
    setCustomers(data || [])
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

      <div className="flex gap-4 h-[calc(100vh-14rem)]">
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
          {selectedCustomer ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden w-full flex flex-col">
              {/* 헤더 */}
              <div className="bg-slate-800 text-white px-5 py-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setSelectedCustomer(null)} className="lg:hidden p-1 hover:bg-slate-700 rounded">
                      <ChevronLeft size={18} />
                    </button>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold truncate">{selectedCustomer.customer_name}</h3>
                      <p className="text-sm text-slate-300 mt-0.5">
                        {selectedCustomer.customer_number || '-'} · {selectedCustomer.business_number || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(selectedCustomer.opening_status || '')}`}>
                      {selectedCustomer.opening_status || '미정'}
                    </span>
                    <button onClick={() => navigate(`/customers/${selectedCustomer.id}`)}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition">
                      수정/메모
                    </button>
                  </div>
                </div>
              </div>

              {/* 상세 내용 */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 기본 정보 */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Building2 size={15} className="text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">기본 정보</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    {[
                      ['고객명', selectedCustomer.customer_name],
                      ['고객번호', selectedCustomer.customer_number],
                      ['사업자번호', selectedCustomer.business_number],
                      ['담당자', selectedCustomer.manager],
                      ['구축구분', selectedCustomer.build_type],
                      ['관리구분', selectedCustomer.management_type],
                      ['구축형', selectedCustomer.construction_type],
                      ['민감고객', selectedCustomer.sensitive_customer],
                      ['친밀도', selectedCustomer.intimacy],
                    ].map(([label, val], i) => (
                      <div key={label} className={`flex text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
                        <span className="px-3 py-2 text-gray-800">{val || '-'}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 계약 현황 */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <FileText size={15} className="text-amber-600" />
                    <span className="text-sm font-semibold text-gray-700">계약 현황</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    {[
                      ['신규접수일', selectedCustomer.reception_date],
                      ['개설상태', selectedCustomer.opening_status],
                      ['개설/이행일', selectedCustomer.opening_date],
                      ['연계상태', selectedCustomer.connection_status],
                      ['연계일자', selectedCustomer.connection_date],
                      ['해지일자', selectedCustomer.termination_date],
                      ['CMS IP', selectedCustomer.cms_ip],
                    ].map(([label, val], i) => (
                      <div key={label} className={`flex text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
                        <span className="px-3 py-2 text-gray-800">
                          {label === '개설상태' && val ? (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(val)}`}>{val}</span>
                          ) : val || '-'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ERP/서버 정보 */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <Server size={15} className="text-purple-600" />
                    <span className="text-sm font-semibold text-gray-700">ERP / 서버 정보</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    {[
                      ['ERP회사', selectedCustomer.erp_company],
                      ['ERP종류', selectedCustomer.erp_type],
                      ['ERP DB', selectedCustomer.erp_db],
                      ['연계방식', selectedCustomer.connection_method],
                      ['서버위치', selectedCustomer.server_location],
                      ['스케줄사용', selectedCustomer.schedule_use],
                      ['고객사 IP', selectedCustomer.customer_ip],
                      ['CMS IP', selectedCustomer.cms_ip],
                    ].map(([label, val], i) => (
                      <div key={label} className={`flex text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
                        <span className="px-3 py-2 text-gray-800">{val || '-'}</span>
                      </div>
                    ))}
                  </div>
                </section>

                {/* 담당자 정보 */}
                <section>
                  <div className="flex items-center gap-2 mb-3">
                    <User size={15} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-gray-700">담당자 정보</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    {[
                      ['고객담당자', selectedCustomer.customer_contact_person],
                      ['담당부서', selectedCustomer.customer_department],
                      ['연락처', selectedCustomer.contact_phone],
                      ['이메일', selectedCustomer.contact_email],
                    ].map(([label, val], i) => (
                      <div key={label} className={`flex text-xs ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                        <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
                        <span className="px-3 py-2 text-gray-800">{val || '-'}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          ) : (
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
