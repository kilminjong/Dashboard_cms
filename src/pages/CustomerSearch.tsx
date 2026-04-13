import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, User, Building2, Server, FileText } from 'lucide-react'

export default function CustomerSearch() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    setSearched(true)
    setSelectedCustomer(null)

    const q = search.trim()
    const { data } = await supabase
      .from('customers')
      .select('*')
      .or(`customer_name.ilike.%${q}%,business_number.ilike.%${q}%,customer_number.ilike.%${q}%,manager.ilike.%${q}%`)
      .order('created_at', { ascending: false })
      .limit(50)

    setResults(data || [])
    setLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const statusBadge = (s: string) => {
    if (s === '개설완료' || s === '이행완료') return 'bg-emerald-100 text-emerald-700'
    if (s === '개설대기') return 'bg-amber-100 text-amber-700'
    if (s === '개설진행') return 'bg-blue-100 text-blue-700'
    if (s === '개설취소') return 'bg-red-100 text-red-700'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">고객 상세 정보</h2>
      <p className="text-sm text-gray-400 mb-6">고객을 검색하여 기본정보, ERP정보, 담당자, 계약현황을 한눈에 확인합니다.</p>

      {/* 검색 */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={handleKeyDown}
            placeholder="고객명, 사업자번호, 고객번호, 담당자명으로 검색..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" />
        </div>
        <button onClick={handleSearch} disabled={loading}
          className="px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition text-sm font-medium shrink-0">
          {loading ? '검색 중...' : '검색'}
        </button>
      </div>

      {!searched ? (
        <div className="text-center py-20">
          <Search size={48} className="text-gray-200 mx-auto mb-4" />
          <p className="text-gray-400">검색어를 입력하여 고객 상세 정보를 조회하세요.</p>
        </div>
      ) : loading ? (
        <p className="text-center py-12 text-gray-400">검색 중...</p>
      ) : results.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-gray-400">"{search}"에 대한 검색 결과가 없습니다.</p>
        </div>
      ) : (
        <div className="flex gap-6">
          {/* 좌측: 검색 결과 목록 */}
          <div className={`space-y-2 ${selectedCustomer ? 'w-1/3 hidden lg:block' : 'w-full'}`}>
            <p className="text-sm text-gray-500 mb-2">검색 결과: <strong>{results.length}</strong>건</p>
            {results.map((c) => (
              <div key={c.id}
                onClick={() => setSelectedCustomer(c)}
                className={`bg-white rounded-xl border shadow-sm p-4 cursor-pointer transition ${
                  selectedCustomer?.id === c.id ? 'border-emerald-300 bg-emerald-50/30' : 'border-gray-100 hover:border-gray-200'
                }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-800">{c.customer_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(c.opening_status || '')}`}>
                    {c.opening_status || '미정'}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{c.customer_number || '-'} · {c.business_number || '-'} · {c.manager || '-'}</p>
              </div>
            ))}
          </div>

          {/* 우측: 선택된 고객 상세 */}
          {selectedCustomer && (
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden sticky top-4">
                {/* 헤더 */}
                <div className="bg-slate-800 text-white px-5 py-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold">{selectedCustomer.customer_name}</h3>
                      <p className="text-sm text-slate-300 mt-0.5">
                        {selectedCustomer.customer_number || '-'} · {selectedCustomer.business_number || '-'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(selectedCustomer.opening_status || '')}`}>
                        {selectedCustomer.opening_status || '미정'}
                      </span>
                      <button onClick={() => navigate(`/customers/${selectedCustomer.id}`)}
                        className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition">
                        상세 페이지
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
                  {/* 기본 정보 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 size={15} className="text-blue-600" />
                      <span className="text-sm font-semibold text-gray-700">기본 정보</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
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
                      ].map(([label, val]) => (
                        <div key={label} className="flex">
                          <span className="text-gray-400 w-20 shrink-0">{label}</span>
                          <span className="text-gray-800 font-medium">{val || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* 계약 현황 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={15} className="text-amber-600" />
                      <span className="text-sm font-semibold text-gray-700">계약 현황</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        ['신규접수일', selectedCustomer.reception_date],
                        ['개설상태', selectedCustomer.opening_status],
                        ['개설/이행일', selectedCustomer.opening_date],
                        ['연계상태', selectedCustomer.connection_status],
                        ['연계일자', selectedCustomer.connection_date],
                        ['해지일자', selectedCustomer.termination_date],
                      ].map(([label, val]) => (
                        <div key={label} className="flex">
                          <span className="text-gray-400 w-20 shrink-0">{label}</span>
                          <span className="text-gray-800 font-medium">{val || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* ERP/서버 정보 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Server size={15} className="text-purple-600" />
                      <span className="text-sm font-semibold text-gray-700">ERP/서버 정보</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        ['ERP회사', selectedCustomer.erp_company],
                        ['ERP종류', selectedCustomer.erp_type],
                        ['ERP DB', selectedCustomer.erp_db],
                        ['연계방식', selectedCustomer.connection_method],
                        ['서버위치', selectedCustomer.server_location],
                        ['스케줄사용', selectedCustomer.schedule_use],
                        ['고객사 IP', selectedCustomer.customer_ip],
                      ].map(([label, val]) => (
                        <div key={label} className="flex">
                          <span className="text-gray-400 w-20 shrink-0">{label}</span>
                          <span className="text-gray-800 font-medium">{val || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-gray-100" />

                  {/* 담당자 정보 */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <User size={15} className="text-emerald-600" />
                      <span className="text-sm font-semibold text-gray-700">담당자 정보</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                      {[
                        ['고객담당자', selectedCustomer.customer_contact_person],
                        ['담당부서', selectedCustomer.customer_department],
                        ['연락처', selectedCustomer.contact_phone],
                        ['이메일', selectedCustomer.contact_email],
                      ].map(([label, val]) => (
                        <div key={label} className="flex">
                          <span className="text-gray-400 w-20 shrink-0">{label}</span>
                          <span className="text-gray-800 font-medium">{val || '-'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
