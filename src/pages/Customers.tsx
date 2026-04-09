import { useEffect, useState, useRef, useMemo, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types'
import { Plus, Search, Edit2, Trash2, X, Upload, Download, Filter, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'

const CUSTOMER_FIELDS: { key: string; label: string; required?: boolean; type?: string; options?: string[] }[] = [
  // 필수 입력사항 (상단 배치)
  { key: 'customer_name', label: '고객명', required: true },
  { key: 'business_number', label: '사업자번호', required: true },
  { key: 'customer_number', label: '고객번호', required: true },
  { key: 'manager', label: '담당자', required: true },
  { key: 'reception_date', label: '신규접수일', type: 'date', required: true },
  { key: 'opening_status', label: '개설상태', type: 'select', options: ['개설대기', '개설진행', '개설취소', '개설완료', '이행완료'], required: true },
  // 선택 입력사항
  { key: 'management_code', label: '관리코드' },
  { key: 'build_type', label: '구축구분' },
  { key: 'management_type', label: '관리구분' },
  { key: 'construction_type', label: '구축형' },
  { key: 'customer_contact_person', label: '고객담당자' },
  { key: 'customer_department', label: '담당 부서', type: 'select-other', options: ['인사팀', '재무팀', '전산팀'] },
  { key: 'contact_phone', label: '담당자 연락처' },
  { key: 'contact_email', label: '담당자 이메일', type: 'email' },
  { key: 'opening_date', label: '개설/이행일', type: 'date' },
  { key: 'connection_status', label: '연계상태', type: 'select', options: ['ERP연계대기', 'ERP연계진행', 'ERP연계완료', 'ERP청구완료', '연계청구보류'] },
  { key: 'connection_date', label: '연계일자', type: 'date' },
  { key: 'erp_company', label: 'ERP회사' },
  { key: 'erp_type', label: 'ERP 종류', type: 'select', options: ['영림원', 'Amaranth10', 'ERP10', '옴니이솔', 'IU', 'ICUBE', 'SAP', '오직', '디모데'] },
  { key: 'erp_db', label: 'ERP DB' },
  { key: 'connection_method', label: '연계방식', type: 'select', options: ['DB to DB', 'API', '3 Tire', 'RFC'] },
  { key: 'server_location', label: '서버PC 상세위치', type: 'select-other', options: ['내부', '전산실'] },
  { key: 'schedule_use', label: '스케줄사용여부', type: 'select', options: ['Y', 'N'] },
  { key: 'customer_ip', label: '고객사 IP' },
  { key: 'sensitive_customer', label: '민감고객', type: 'select', options: ['Y', 'N'] },
  { key: 'intimacy', label: '친밀도', type: 'select', options: ['상', '중', '하'] },
  { key: 'duplicate_check', label: '중복체크' },
]

const TABLE_COLUMNS = [
  'customer_name', 'business_number', 'manager', 'opening_status',
  'connection_status', 'erp_company',
]

const emptyForm = () => {
  const f: any = {}
  CUSTOMER_FIELDS.forEach(({ key }) => (f[key] = ''))
  return f
}

export default function Customers() {
  const navigate = useNavigate()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 필터
  const [showFilters, setShowFilters] = useState(false)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterManager, setFilterManager] = useState('')
  const [filterErp, setFilterErp] = useState('')
  const [filterConnection, setFilterConnection] = useState('')

  // 정렬
  const [sortKey, setSortKey] = useState<string>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  // 페이지네이션
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 9999)
    setCustomers(data || [])
    setLoading(false)
  }

  // 필터 옵션 추출 (실제 데이터에서)
  const filterOptions = useMemo(() => {
    const statuses = [...new Set(customers.map((c) => c.opening_status).filter(Boolean))].sort()
    const managers = [...new Set(customers.map((c) => c.manager).filter(Boolean))].sort()
    const erps = [...new Set(customers.map((c) => c.erp_company).filter(Boolean))].sort()
    const connections = [...new Set(customers.map((c) => c.connection_status).filter(Boolean))].sort()
    return { statuses, managers, erps, connections }
  }, [customers])

  // 필터 + 검색 + 정렬
  const filtered = useMemo(() => {
    let result = customers

    // 텍스트 검색
    if (search) {
      const q = search.toLowerCase()
      result = result.filter((c) =>
        c.customer_name?.toLowerCase().includes(q) ||
        c.business_number?.toLowerCase().includes(q) ||
        c.manager?.toLowerCase().includes(q) ||
        c.customer_number?.toLowerCase().includes(q)
      )
    }

    // 조건 필터
    if (filterStatus) result = result.filter((c) => c.opening_status === filterStatus)
    if (filterManager) result = result.filter((c) => c.manager === filterManager)
    if (filterErp) result = result.filter((c) => c.erp_company === filterErp)
    if (filterConnection) result = result.filter((c) => c.connection_status === filterConnection)

    // 정렬
    result = [...result].sort((a, b) => {
      const aVal = (a as any)[sortKey] || ''
      const bVal = (b as any)[sortKey] || ''
      if (aVal < bVal) return sortAsc ? -1 : 1
      if (aVal > bVal) return sortAsc ? 1 : -1
      return 0
    })

    return result
  }, [customers, search, filterStatus, filterManager, filterErp, filterConnection, sortKey, sortAsc])

  // 페이지네이션
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, filterStatus, filterManager, filterErp, filterConnection])

  const activeFilterCount = [filterStatus, filterManager, filterErp, filterConnection].filter(Boolean).length

  const clearFilters = () => {
    setFilterStatus('')
    setFilterManager('')
    setFilterErp('')
    setFilterConnection('')
    setSearch('')
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(true)
    }
  }

  const SortIcon = ({ col }: { col: string }) => {
    if (sortKey !== col) return <ChevronUp size={12} className="text-gray-300" />
    return sortAsc
      ? <ChevronUp size={12} className="text-emerald-600" />
      : <ChevronDown size={12} className="text-emerald-600" />
  }

  const openCreate = () => {
    setEditingCustomer(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    const f: any = {}
    CUSTOMER_FIELDS.forEach(({ key }) => (f[key] = (customer as any)[key] || ''))
    setForm(f)
    setShowModal(true)
  }

  const handleSave = async () => {
    // 필수 입력 검증
    const requiredFields = CUSTOMER_FIELDS.filter((f) => f.required)
    const missing = requiredFields.filter((f) => !form[f.key]?.trim())
    if (missing.length > 0) {
      alert(`필수 입력정보를 확인해주세요.\n\n미입력 항목: ${missing.map((f) => f.label).join(', ')}`)
      return
    }

    // 사업자번호 10자리 검증
    const bizNum = form.business_number?.replace(/[^0-9]/g, '')
    if (bizNum && bizNum.length !== 10) {
      alert('사업자번호는 10자리로 입력해주세요.')
      return
    }

    // 고객번호 9자리 검증
    const custNum = form.customer_number?.replace(/[^0-9]/g, '')
    if (custNum && custNum.length !== 9) {
      alert('고객번호는 9자리로 입력해주세요.')
      return
    }

    // 빈 날짜 필드를 null로 변환 (DB date 타입 에러 방지)
    const cleanForm = { ...form }
    CUSTOMER_FIELDS.forEach((field) => {
      if (field.type === 'date' && !cleanForm[field.key]?.trim()) {
        cleanForm[field.key] = null
      }
    })

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update({ ...cleanForm, updated_at: new Date().toISOString() })
        .eq('id', editingCustomer.id)
      if (error) { alert('수정 실패: ' + error.message); return }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('customers').insert([{ ...cleanForm, created_by: user?.id }])
      if (error) { alert('등록 실패: ' + error.message); return }
    }
    setShowModal(false)
    loadCustomers()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    const { error } = await supabase.from('customers').delete().eq('id', id)
    if (error) { alert('삭제 실패: ' + error.message); return }
    loadCustomers()
  }

  // CSV 일괄등록
  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    // 쉼표가 따옴표 안에 있을 수 있으므로 간단한 CSV 파싱
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) {
      alert('데이터가 없습니다.')
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''))
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
      const row: any = {}
      headers.forEach((h, i) => {
        const field = CUSTOMER_FIELDS.find((f) => f.label === h || f.key === h)
        if (field) row[field.key] = values[i] || ''
      })
      return row
    }).filter((r) => r.customer_name)

    if (rows.length === 0) {
      alert('유효한 데이터가 없습니다. CSV 헤더를 확인해주세요.\n헤더는 한글 라벨(고객명, 사업자번호 등) 또는 영문 키(customer_name 등) 모두 지원합니다.')
      return
    }

    if (!confirm(`${rows.length}건을 등록하시겠습니까?`)) return

    const { data: { user } } = await supabase.auth.getUser()
    const rowsWithUser = rows.map((r) => ({ ...r, created_by: user?.id }))

    // 대량 데이터는 500건씩 분할 insert
    let successCount = 0
    let failCount = 0
    for (let i = 0; i < rowsWithUser.length; i += 500) {
      const batch = rowsWithUser.slice(i, i + 500)
      const { error } = await supabase.from('customers').insert(batch)
      if (error) {
        failCount += batch.length
      } else {
        successCount += batch.length
      }
    }

    await supabase.from('import_logs').insert([{
      user_id: user?.id,
      file_name: file.name,
      total_count: rows.length,
      success_count: successCount,
      fail_count: failCount,
    }])

    if (failCount > 0) {
      alert(`등록 완료: 성공 ${successCount}건, 실패 ${failCount}건`)
    } else {
      alert(`${successCount}건이 등록되었습니다.`)
    }
    loadCustomers()

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const downloadTemplate = () => {
    const headers = CUSTOMER_FIELDS.map((f) => f.label)
    // 예시 데이터 2행 포함
    const example1 = [
      '(주)테스트기업', '1234567890', '123456789', '담당자명', '2025-01-15', '개설대기',
      '', '', '', '', '', '인사팀', '010-1234-5678', 'test@test.com',
      '', 'ERP연계대기', '', '더존비즈온', 'ICUBE', '', 'DB to DB',
      '전산실', 'Y', '192.168.0.1', 'N', '중', '',
    ]
    const example2 = [
      '(주)샘플회사', '9876543210', '987654321', '담당자명', '2025-02-01', '개설진행',
      '', '', '', '', '', '전산팀', '010-9876-5432', 'sample@sample.com',
      '', 'ERP연계진행', '', '영림원', 'ERP10', '', 'API',
      '내부', 'N', '10.0.0.1', 'Y', '상', '',
    ]

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + example1.join(',') + '\n' + example2.join(',') + '\n'
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '고객등록_양식.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const statusBadge = (status: string) => {
    if (status === '개설완료' || status === '이행완료') return 'bg-emerald-100 text-emerald-800'
    if (status === '개설대기') return 'bg-amber-100 text-amber-800'
    if (status === '개설진행') return 'bg-blue-100 text-blue-800'
    if (status === '개설취소') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-600'
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-800">고객정보관리</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">
            <Download size={16} /> 템플릿
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm cursor-pointer">
            <Upload size={16} /> 일괄등록
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleBulkImport} className="hidden" />
          </label>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm">
            <Plus size={16} /> 고객 등록
          </button>
        </div>
      </div>

      {/* 검색 + 필터 토글 */}
      <div className="flex gap-2 mb-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="고객명, 사업자번호, 담당자, 고객번호로 검색..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
          />
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2.5 border rounded-lg transition text-sm shrink-0 ${
            activeFilterCount > 0
              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Filter size={16} />
          필터{activeFilterCount > 0 && ` (${activeFilterCount})`}
        </button>
      </div>

      {/* 필터 패널 */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-gray-700">조건 필터</span>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
                <RotateCcw size={12} /> 초기화
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">개설상태</label>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">전체</option>
                {filterOptions.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">담당자</label>
              <select value={filterManager} onChange={(e) => setFilterManager(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">전체</option>
                {filterOptions.managers.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ERP회사</label>
              <select value={filterErp} onChange={(e) => setFilterErp(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">전체</option>
                {filterOptions.erps.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">연계상태</label>
              <select value={filterConnection} onChange={(e) => setFilterConnection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="">전체</option>
                {filterOptions.connections.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* 건수 */}
      <p className="text-sm text-gray-500 mb-3">
        검색 결과 <strong className="text-gray-700">{filtered.length.toLocaleString()}</strong>건
        {filtered.length !== customers.length && ` / 전체 ${customers.length.toLocaleString()}건`}
      </p>

      {/* 테이블 (데스크탑) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col}
                    onClick={() => handleSort(col)}
                    className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap cursor-pointer hover:bg-gray-100 transition select-none"
                  >
                    <div className="flex items-center gap-1">
                      {CUSTOMER_FIELDS.find((f) => f.key === col)?.label}
                      <SortIcon col={col} />
                    </div>
                  </th>
                ))}
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">불러오는 중...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">데이터가 없습니다</td></tr>
              ) : (
                paged.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    {TABLE_COLUMNS.map((col) => (
                      <td key={col} className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {col === 'customer_name' ? (
                          <button onClick={() => navigate(`/customers/${c.id}`)}
                            className="text-emerald-600 font-medium hover:underline">
                            {(c as any)[col] || '-'}
                          </button>
                        ) : col === 'opening_status' ? (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge((c as any)[col])}`}>
                            {(c as any)[col] || '-'}
                          </span>
                        ) : (
                          (c as any)[col] || '-'
                        )}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(c)} className="p-1 text-gray-400 hover:text-emerald-600">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="p-1 text-gray-400 hover:text-red-600 ml-1">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 페이지네이션 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4 border-t border-gray-100">
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition">
              이전
            </button>
            <span className="text-sm text-gray-500">{page} / {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition">
              다음
            </button>
          </div>
        )}
      </div>

      {/* 카드 (모바일) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-gray-400">불러오는 중...</p>
        ) : paged.length === 0 ? (
          <p className="text-center py-8 text-gray-400">데이터가 없습니다</p>
        ) : (
          <>
            {paged.map((c) => (
              <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <button onClick={() => navigate(`/customers/${c.id}`)} className="font-medium text-emerald-600 hover:underline truncate">
                    {c.customer_name}
                  </button>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${statusBadge(c.opening_status)}`}>
                    {c.opening_status || '미정'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{c.business_number || '-'}</p>
                <p className="text-sm text-gray-500">담당: {c.manager || '-'} · ERP: {c.erp_company || '-'}</p>
                <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
                  <button onClick={() => openEdit(c)} className="text-sm text-emerald-600 font-medium">수정</button>
                  <button onClick={() => handleDelete(c.id)} className="text-sm text-red-500 font-medium">삭제</button>
                </div>
              </div>
            ))}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 py-3">
                <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition">
                  이전
                </button>
                <span className="text-sm text-gray-500">{page} / {totalPages}</span>
                <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-30 transition">
                  다음
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 등록/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {editingCustomer ? '고객 수정' : '고객 등록'}
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            {(() => {
              const requiredCount = CUSTOMER_FIELDS.filter((f) => f.required).length
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {CUSTOMER_FIELDS.map((field, idx) => (
                    <Fragment key={field.key}>
                      {idx === requiredCount && (
                        <div className="col-span-1 sm:col-span-2 border-t border-gray-200 pt-2 mt-1">
                          <p className="text-xs text-gray-400">선택 입력사항</p>
                        </div>
                      )}
                      <div className={field.required ? 'bg-blue-50/60 border border-blue-100 rounded-lg p-2.5' : ''}>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        {field.type === 'select' && field.options ? (
                          <select
                            value={form[field.key]}
                            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white"
                          >
                            <option value="">선택하세요</option>
                            {field.options.map((opt) => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        ) : field.type === 'select-other' && field.options ? (
                          <div className="flex gap-2">
                            <select
                              value={field.options.includes(form[field.key]) ? form[field.key] : form[field.key] ? '기타' : ''}
                              onChange={(e) => {
                                if (e.target.value === '기타') setForm({ ...form, [field.key]: '' })
                                else setForm({ ...form, [field.key]: e.target.value })
                              }}
                              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white"
                            >
                              <option value="">선택하세요</option>
                              {field.options.map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                              <option value="기타">기타(직접입력)</option>
                            </select>
                            {form[field.key] && !field.options.includes(form[field.key]) && (
                              <input
                                type="text"
                                value={form[field.key]}
                                onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                                placeholder="직접 입력"
                              />
                            )}
                          </div>
                        ) : (
                          <input
                            type={field.type || 'text'}
                            value={form[field.key]}
                            onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                          />
                        )}
                      </div>
                    </Fragment>
                  ))}
                </div>
              )
            })()}

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">
                취소
              </button>
              <button onClick={handleSave}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium">
                {editingCustomer ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
