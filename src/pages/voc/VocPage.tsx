import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import Modal from '@/components/ui/Modal'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Customer, VocHistory, BranchType } from '@/types'
import { Search, Plus, MessageSquare, Building2 } from 'lucide-react'

const BRANCHES: (BranchType | '전체')[] = ['전체', 'IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch']

export default function VocPage() {
  const { user } = useAuthStore()
  const canEdit = user?.role !== 'VIEWER'

  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [branch, setBranch] = useState<BranchType | '전체'>('전체')
  const [keyword, setKeyword] = useState('')

  // 선택된 고객 & VOC 이력
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [vocList, setVocList] = useState<VocHistory[]>([])
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isVocFormOpen, setIsVocFormOpen] = useState(false)

  // VOC 입력 폼
  const [vocForm, setVocForm] = useState({
    voc_date: new Date().toISOString().slice(0, 10),
    content: '',
    employee_count: '',
    company_size: '',
    ceo_name: '',
    founded_date: '',
  })

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    let query = supabase.from('customers').select('*')
    if (branch !== '전체') query = query.eq('branch', branch)
    if (keyword) {
      query = query.or(`company_name.ilike.%${keyword}%,business_number.ilike.%${keyword}%`)
    }
    const { data } = await query.order('company_name').limit(100)
    if (data) setCustomers(data as Customer[])
    setIsLoading(false)
  }, [branch, keyword])

  useEffect(() => { fetchCustomers() }, [fetchCustomers])

  const openDetail = async (customer: Customer) => {
    setSelectedCustomer(customer)
    const { data } = await supabase
      .from('voc_history')
      .select('*')
      .eq('customer_id', customer.id)
      .order('voc_date', { ascending: false })
    if (data) setVocList(data as VocHistory[])
    setIsDetailOpen(true)
  }

  const openVocForm = () => {
    setVocForm({
      voc_date: new Date().toISOString().slice(0, 10),
      content: '',
      employee_count: '',
      company_size: '',
      ceo_name: '',
      founded_date: '',
    })
    setIsVocFormOpen(true)
  }

  const handleSaveVoc = async () => {
    if (!vocForm.content.trim()) { alert('VOC 내용을 입력해주세요.'); return }
    if (!selectedCustomer) return

    await supabase.from('voc_history').insert({
      customer_id: selectedCustomer.id,
      voc_date: vocForm.voc_date,
      content: vocForm.content.trim(),
      employee_count: vocForm.employee_count ? Number(vocForm.employee_count) : null,
      company_size: vocForm.company_size || null,
      ceo_name: vocForm.ceo_name || null,
      founded_date: vocForm.founded_date || null,
      created_by: user?.id,
    })

    setIsVocFormOpen(false)
    // 새로고침
    const { data } = await supabase
      .from('voc_history')
      .select('*')
      .eq('customer_id', selectedCustomer.id)
      .order('voc_date', { ascending: false })
    if (data) setVocList(data as VocHistory[])
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none"

  return (
    <div>
      <Header title="VOC 대상 고객" />
      <div className="p-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={branch} onChange={(e) => setBranch(e.target.value as BranchType | '전체')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <div className="relative flex-1 max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="업체명 또는 사업자번호 검색"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        {/* 고객 목록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜치</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">업체명</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">사업자번호</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">업태</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">업종</th>
                <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">매출액(백만)</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">VOC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : customers.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">검색 결과가 없습니다</td></tr>
              ) : (
                customers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => openDetail(c)}>
                    <td className="px-5 py-3">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">{c.branch}</span>
                    </td>
                    <td className="px-5 py-3 font-medium text-gray-900">{c.company_name}</td>
                    <td className="px-5 py-3 text-gray-500">{c.business_number || '-'}</td>
                    <td className="px-5 py-3 text-gray-500">{c.business_type || '-'}</td>
                    <td className="px-5 py-3 text-gray-500">{c.industry || '-'}</td>
                    <td className="px-5 py-3 text-right text-gray-700">{c.revenue ? c.revenue.toLocaleString() : '-'}</td>
                    <td className="px-5 py-3 text-center">
                      <MessageSquare size={16} className="inline text-gray-400" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 고객 상세 + VOC 이력 모달 */}
      <Modal isOpen={isDetailOpen} onClose={() => setIsDetailOpen(false)} title={selectedCustomer?.company_name ?? ''} size="xl">
        {selectedCustomer && (
          <div className="space-y-6">
            {/* 기업 정보 */}
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                <Building2 size={16} /> 기업 정보
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 rounded-lg p-4">
                <div><span className="text-xs text-gray-500">브랜치</span><p className="text-sm font-medium">{selectedCustomer.branch}</p></div>
                <div><span className="text-xs text-gray-500">사업자번호</span><p className="text-sm font-medium">{selectedCustomer.business_number || '-'}</p></div>
                <div><span className="text-xs text-gray-500">업태</span><p className="text-sm font-medium">{selectedCustomer.business_type || '-'}</p></div>
                <div><span className="text-xs text-gray-500">업종</span><p className="text-sm font-medium">{selectedCustomer.industry || '-'}</p></div>
                <div><span className="text-xs text-gray-500">매출액(백만)</span><p className="text-sm font-medium">{selectedCustomer.revenue?.toLocaleString() || '-'}</p></div>
                <div><span className="text-xs text-gray-500">상태</span><p className="text-sm font-medium">{selectedCustomer.status}</p></div>
              </div>
            </div>

            {/* VOC 이력 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <MessageSquare size={16} /> VOC 이력 ({vocList.length}건)
                </h4>
                {canEdit && (
                  <button onClick={openVocForm} className="px-3 py-1.5 text-xs bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-1 transition-colors">
                    <Plus size={14} /> VOC 등록
                  </button>
                )}
              </div>

              {vocList.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">등록된 VOC 이력이 없습니다</p>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto">
                  {vocList.map((voc) => (
                    <div key={voc.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-primary">{voc.voc_date}</span>
                        <div className="flex gap-3 text-xs text-gray-400">
                          {voc.employee_count && <span>직원수: {voc.employee_count}</span>}
                          {voc.company_size && <span>규모: {voc.company_size}</span>}
                          {voc.ceo_name && <span>대표: {voc.ceo_name}</span>}
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{voc.content}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* VOC 등록 모달 */}
      <Modal isOpen={isVocFormOpen} onClose={() => setIsVocFormOpen(false)} title="VOC 등록" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VOC 일자 *</label>
            <input type="date" value={vocForm.voc_date} onChange={(e) => setVocForm((f) => ({ ...f, voc_date: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VOC 내용 *</label>
            <textarea value={vocForm.content} onChange={(e) => setVocForm((f) => ({ ...f, content: e.target.value }))} className={inputClass} rows={5} placeholder="VOC 내용을 입력하세요" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직원수</label>
              <input type="number" value={vocForm.employee_count} onChange={(e) => setVocForm((f) => ({ ...f, employee_count: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">기업규모</label>
              <input type="text" value={vocForm.company_size} onChange={(e) => setVocForm((f) => ({ ...f, company_size: e.target.value }))} className={inputClass} placeholder="중소/중견/대기업" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">대표자명</label>
              <input type="text" value={vocForm.ceo_name} onChange={(e) => setVocForm((f) => ({ ...f, ceo_name: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">설립일</label>
              <input type="date" value={vocForm.founded_date} onChange={(e) => setVocForm((f) => ({ ...f, founded_date: e.target.value }))} className={inputClass} />
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button onClick={() => setIsVocFormOpen(false)} className="px-5 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">취소</button>
          <button onClick={handleSaveVoc} className="px-5 py-2.5 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors">등록</button>
        </div>
      </Modal>
    </div>
  )
}
