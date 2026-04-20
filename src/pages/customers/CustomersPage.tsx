import { useState } from 'react'
import Header from '@/components/layout/Header'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import CustomerForm from './CustomerForm'
import { useCustomers } from '@/hooks/useCustomers'
import { useAuthStore } from '@/store/authStore'
import type { Customer, BranchType, CustomerStatus } from '@/types'
import { ALL_BRANCHES } from '@/types'
import { Plus, Trash2, Download, Upload, Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import * as XLSX from 'xlsx'

const BRANCHES: (BranchType | '전체')[] = ['전체', ...ALL_BRANCHES]
const STATUSES: (CustomerStatus | '전체')[] = ['전체', '완료', '진행', '대기', '해지']

export default function CustomersPage() {
  const { user } = useAuthStore()
  const {
    customers, totalCount, isLoading, error,
    filters, setFilters,
    page, setPage, pageSize,
    refetch, deleteCustomers,
  } = useCustomers()

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)

  const totalPages = Math.ceil(totalCount / pageSize)
  const canEdit = user?.role !== 'VIEWER'
  const canDelete = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_ADMIN'

  const handleOpenForm = (customer?: Customer) => {
    setEditingCustomer(customer ?? null)
    setIsFormOpen(true)
  }

  const handleSave = () => {
    setIsFormOpen(false)
    setEditingCustomer(null)
    refetch()
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(customers.map((c) => c.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds)
    if (checked) next.add(id)
    else next.delete(id)
    setSelectedIds(next)
  }

  const handleDelete = async () => {
    try {
      await deleteCustomers(Array.from(selectedIds))
      setSelectedIds(new Set())
    } catch (err) {
      alert(err instanceof Error ? err.message : '삭제에 실패했습니다.')
    }
  }

  // 엑셀 내보내기
  const handleExport = () => {
    if (customers.length === 0) return
    const exportData = customers.map((c) => ({
      '브랜치': c.branch,
      '상태': c.status,
      '업체명': c.company_name,
      '사업자번호': c.business_number,
      '유형': c.type,
      '상품': c.product,
      '계약일자': c.contract_date,
      '업태': c.business_type,
      '업종/주품목': c.industry,
      'ERP종류': c.erp_type,
      'ERP업체': c.erp_company,
      'ERP제조사': c.erp_manufacturer,
      'DB종류': c.db_type,
      'ERP연계일자': c.erp_link_date,
      '연계방식': c.link_method,
      '해지일자': c.cancel_date,
      '해지사유': c.cancel_reason,
      '업종(작업)': c.work_industry,
      '개설완료일자': c.open_date,
      '컨설턴트(주)': c.consultant_main,
      '컨설턴트(부)': c.consultant_sub,
      '매출액(백만)': c.revenue,
      '계열사수': c.affiliate_count,
      '계좌수': c.account_count,
      '카드수': c.card_count,
      '비고': c.notes,
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '고객정보')
    XLSX.writeFile(wb, `고객정보_${filters.branch}_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  // 엑셀 가져오기
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

        if (rows.length === 0) {
          alert('데이터가 없습니다.')
          return
        }

        const mapped = rows.map((row) => ({
          branch: row['브랜치'] || 'IBK',
          status: row['상태'] || '대기',
          company_name: row['업체명'] || '',
          business_number: row['사업자번호'] || null,
          type: row['유형'] || null,
          product: row['상품'] || null,
          contract_date: row['계약일자'] || null,
          business_type: row['업태'] || null,
          industry: row['업종/주품목'] || null,
          erp_type: row['ERP종류'] || null,
          erp_company: row['ERP업체'] || null,
          erp_manufacturer: row['ERP제조사'] || null,
          db_type: row['DB종류'] || null,
          erp_link_date: row['ERP연계일자'] || null,
          link_method: row['연계방식'] || null,
          cancel_date: row['해지일자'] || null,
          cancel_reason: row['해지사유'] || null,
          work_industry: row['업종(작업)'] || null,
          open_date: row['개설완료일자'] || null,
          consultant_main: row['컨설턴트(주)'] || null,
          consultant_sub: row['컨설턴트(부)'] || null,
          revenue: row['매출액(백만)'] ? Number(row['매출액(백만)']) : null,
          affiliate_count: row['계열사수'] ? Number(row['계열사수']) : null,
          account_count: row['계좌수'] ? Number(row['계좌수']) : null,
          card_count: row['카드수'] ? Number(row['카드수']) : null,
          notes: row['비고'] || null,
          created_by: user?.id,
        })).filter((r) => r.company_name)

        if (mapped.length === 0) {
          alert('유효한 데이터가 없습니다. 업체명은 필수입니다.')
          return
        }

        const { error: insertError } = await (await import('@/lib/supabase')).supabase
          .from('customers')
          .insert(mapped)

        if (insertError) throw insertError

        alert(`${mapped.length}건이 등록되었습니다.`)
        refetch()
      } catch (err) {
        alert(err instanceof Error ? err.message : '업로드에 실패했습니다.')
      }
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  return (
    <div>
      <Header title="고객정보 관리" />
      <div className="p-6">
        {/* 필터 영역 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* 브랜치 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">브랜치</label>
              <select
                value={filters.branch}
                onChange={(e) => setFilters((f) => ({ ...f, branch: e.target.value as BranchType | '전체' }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">상태</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as CustomerStatus | '전체' }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* 연도 */}
            <div>
              <label className="block text-xs text-gray-500 mb-1">연도</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">전체</option>
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            {/* 키워드 검색 */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs text-gray-500 mb-1">검색</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.keyword}
                  onChange={(e) => setFilters((f) => ({ ...f, keyword: e.target.value }))}
                  placeholder="업체명 또는 사업자번호 검색"
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 액션 버튼 영역 */}
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            총 <span className="font-semibold text-gray-800">{totalCount}</span>건
            {selectedIds.size > 0 && (
              <span className="ml-2 text-primary">({selectedIds.size}건 선택)</span>
            )}
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <>
                <label className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer flex items-center gap-1.5 transition-colors">
                  <Upload size={16} />
                  엑셀 업로드
                  <input type="file" accept=".xlsx,.xls" onChange={handleImport} className="hidden" />
                </label>
                <button onClick={handleExport} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <Download size={16} />
                  엑셀 다운로드
                </button>
              </>
            )}
            {canDelete && selectedIds.size > 0 && (
              <button onClick={() => setIsDeleteOpen(true)} className="px-3 py-2 text-sm bg-danger text-white rounded-lg hover:bg-red-700 flex items-center gap-1.5 transition-colors">
                <Trash2 size={16} />
                삭제 ({selectedIds.size})
              </button>
            )}
            {canEdit && (
              <button onClick={() => handleOpenForm()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-1.5 transition-colors">
                <Plus size={16} />
                신규 등록
              </button>
            )}
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {canDelete && (
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={customers.length > 0 && selectedIds.size === customers.length}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded"
                      />
                    </th>
                  )}
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜치</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">업체명</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사업자번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ERP종류</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">계약일자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">컨설턴트(주)</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">매출액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={canDelete ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
                      로딩 중...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={canDelete ? 9 : 8} className="px-4 py-12 text-center text-red-500">
                      {error}
                    </td>
                  </tr>
                ) : customers.length === 0 ? (
                  <tr>
                    <td colSpan={canDelete ? 9 : 8} className="px-4 py-12 text-center text-gray-400">
                      데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => canEdit && handleOpenForm(c)}
                    >
                      {canDelete && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(c.id)}
                            onChange={(e) => handleSelectOne(c.id, e.target.checked)}
                            className="rounded"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {c.branch}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                          c.status === '완료' ? 'bg-green-100 text-green-800' :
                          c.status === '진행' ? 'bg-yellow-100 text-yellow-800' :
                          c.status === '대기' ? 'bg-gray-100 text-gray-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{c.company_name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <span>{c.business_number || '-'}</span>
                          {c.company_name && (
                            <a
                              href={`https://www.biznet.co.kr/#/search?keyword=${encodeURIComponent(c.company_name)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors shrink-0"
                              title={`Biznet에서 "${c.company_name}" 검색`}
                            >
                              <ExternalLink size={10} />
                              Biznet
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{c.erp_type || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.contract_date || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.consultant_main || '-'}</td>
                      <td className="px-4 py-3 text-gray-500">{c.revenue ? `${c.revenue}백만` : '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {(page - 1) * pageSize + 1}~{Math.min(page * pageSize, totalCount)} / {totalCount}건
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4))
                  const p = startPage + i
                  if (p > totalPages) return null
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                        p === page ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {p}
                    </button>
                  )
                })}
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 등록/수정 모달 */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => { setIsFormOpen(false); setEditingCustomer(null) }}
        title={editingCustomer ? '고객 정보 수정' : '신규 고객 등록'}
        size="xl"
      >
        <CustomerForm
          customer={editingCustomer}
          onSave={handleSave}
          onCancel={() => { setIsFormOpen(false); setEditingCustomer(null) }}
        />
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="고객 삭제"
        message={`선택한 ${selectedIds.size}건을 삭제하시겠습니까? 삭제된 데이터는 복구 가능합니다.`}
        confirmText="삭제"
        variant="danger"
      />
    </div>
  )
}
