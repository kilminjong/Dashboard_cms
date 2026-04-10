import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Search, User } from 'lucide-react'

export default function CustomerSearch() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  const handleSearch = async () => {
    if (!search.trim()) return
    setLoading(true)
    setSearched(true)

    const q = search.trim()
    const { data } = await supabase
      .from('customers')
      .select('id, customer_name, customer_number, business_number, opening_status, manager, reception_date, connection_status, erp_company, erp_type, contact_phone, contact_email, customer_contact_person')
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
      <p className="text-sm text-gray-400 mb-6">고객명, 사업자번호, 고객번호, 담당자로 검색하여 상세 정보를 조회합니다.</p>

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

      {/* 결과 */}
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
        <div>
          <p className="text-sm text-gray-500 mb-3">검색 결과: <strong className="text-gray-700">{results.length}</strong>건</p>
          <div className="space-y-3">
            {results.map((c) => (
              <div key={c.id} onClick={() => navigate(`/customers/${c.id}`)}
                className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:border-emerald-200 hover:shadow-md cursor-pointer transition">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-800">{c.customer_name}</h4>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(c.opening_status || '')}`}>
                        {c.opening_status || '미정'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-1.5 text-xs">
                      <div><span className="text-gray-400">고객번호</span> <span className="text-gray-700 ml-1">{c.customer_number || '-'}</span></div>
                      <div><span className="text-gray-400">사업자번호</span> <span className="text-gray-700 ml-1">{c.business_number || '-'}</span></div>
                      <div><span className="text-gray-400">담당자</span> <span className="text-gray-700 ml-1">{c.manager || '-'}</span></div>
                      <div><span className="text-gray-400">접수일</span> <span className="text-gray-700 ml-1">{c.reception_date || '-'}</span></div>
                      <div><span className="text-gray-400">연계상태</span> <span className="text-gray-700 ml-1">{c.connection_status || '-'}</span></div>
                      <div><span className="text-gray-400">ERP</span> <span className="text-gray-700 ml-1">{c.erp_company || '-'} {c.erp_type || ''}</span></div>
                      <div><span className="text-gray-400">고객담당자</span> <span className="text-gray-700 ml-1">{c.customer_contact_person || '-'}</span></div>
                      <div><span className="text-gray-400">연락처</span> <span className="text-gray-700 ml-1">{c.contact_phone || '-'}</span></div>
                    </div>
                  </div>
                  <div className="shrink-0 bg-gray-100 p-2 rounded-lg">
                    <User size={18} className="text-gray-400" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
