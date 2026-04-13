import { useEffect, useState, useRef, useMemo, Fragment } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types'
import { Plus, Search, Edit2, Trash2, X, Upload, FileSpreadsheet, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react'
import * as XLSX from 'xlsx'

const CUSTOMER_FIELDS: { key: string; label: string; required?: boolean; type?: string; options?: string[]; default?: string }[] = [
  // 필수 입력사항 (상단 배치)
  { key: 'customer_name', label: '고객명', required: true },
  { key: 'business_number', label: '사업자번호', required: true },
  { key: 'customer_number', label: '고객번호', required: true },
  { key: 'manager', label: '담당자', required: true },
  { key: 'reception_date', label: '신규접수일', type: 'date', required: true },
  { key: 'opening_status', label: '개설상태', type: 'select', options: ['개설대기', '개설진행', '개설취소', '개설완료', '이행완료'], required: true, default: '개설대기' },
  // 선택 입력사항
  { key: 'build_type', label: '구축구분', type: 'select', options: ['신규', '해지후재구축', '이행'] },
  { key: 'management_type', label: '관리구분', type: 'select', options: ['정상', '해지', '취소'] },
  { key: 'construction_type', label: '구축형', type: 'select', options: ['기본형', '연계형'] },
  { key: 'customer_contact_person', label: '고객담당자' },
  { key: 'customer_department', label: '담당 부서', type: 'select-other', options: ['인사팀', '재무팀', '전산팀'] },
  { key: 'contact_phone', label: '담당자 연락처' },
  { key: 'contact_email', label: '담당자 이메일', type: 'email' },
  { key: 'opening_date', label: '개설/이행일', type: 'date' },
  { key: 'connection_status', label: '연계상태', type: 'select', options: ['ERP연계대기', 'ERP연계진행', 'ERP연계완료', 'ERP청구완료', '연계청구보류'] },
  { key: 'connection_date', label: '연계일자', type: 'date' },
  { key: 'termination_date', label: '해지일자', type: 'date' },
  { key: 'erp_company', label: 'ERP회사' },
  { key: 'erp_type', label: 'ERP 종류', type: 'select', options: ['영림원', 'Amaranth10', 'ERP10', '옴니이솔', 'IU', 'ICUBE', 'SAP', '오직', '디모데'] },
  { key: 'erp_db', label: 'ERP DB' },
  { key: 'connection_method', label: '연계방식', type: 'select', options: ['DB to DB', 'API', '3 Tire', 'RFC'] },
  { key: 'server_location', label: '서버PC 상세위치', type: 'select-other', options: ['내부', '전산실'] },
  { key: 'schedule_use', label: '스케줄사용여부', type: 'select', options: ['Y', 'N'] },
  { key: 'customer_ip', label: '고객사 IP' },
  { key: 'sensitive_customer', label: '민감고객', type: 'select', options: ['Y', 'N'] },
  { key: 'intimacy', label: '친밀도', type: 'select', options: ['상', '중', '하'] },
]

const TABLE_COLUMNS = [
  'customer_name', 'customer_number', 'business_number', 'manager', 'opening_status',
  'connection_status', 'erp_company',
]

const emptyForm = () => {
  const f: any = {}
  CUSTOMER_FIELDS.forEach((field) => (f[field.key] = field.default || ''))
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

  // 일괄등록 미리보기
  const [importPreview, setImportPreview] = useState<any[]>([])
  const [importFileName, setImportFileName] = useState('')
  const [showImportModal, setShowImportModal] = useState(false)
  const [importing, setImporting] = useState(false)
  const [editingImportIdx, setEditingImportIdx] = useState<number | null>(null)
  const [editingImportForm, setEditingImportForm] = useState<any>({})

  // URL 파라미터에서 필터 초기값 가져오기
  const [searchParams] = useSearchParams()
  const urlStatus = searchParams.get('status') || ''

  // 필터 (항상 표시)
  const [filterStatus, setFilterStatus] = useState(urlStatus)
  const [filterManager, setFilterManager] = useState('')
  const [filterErp, setFilterErp] = useState('')
  const [filterConnection, setFilterConnection] = useState('')
  const [filterReceptionFrom, setFilterReceptionFrom] = useState('')
  const [filterReceptionTo, setFilterReceptionTo] = useState('')
  const [filterOpeningFrom, setFilterOpeningFrom] = useState('')
  const [filterOpeningTo, setFilterOpeningTo] = useState('')

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
    if (filterStatus) {
      if (filterStatus === '개설완료') {
        result = result.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료')
      } else {
        result = result.filter((c) => c.opening_status === filterStatus)
      }
    }
    if (filterManager) result = result.filter((c) => c.manager === filterManager)
    if (filterErp) result = result.filter((c) => c.erp_company === filterErp)
    if (filterConnection) result = result.filter((c) => c.connection_status === filterConnection)
    if (filterReceptionFrom) result = result.filter((c) => c.reception_date && c.reception_date >= filterReceptionFrom)
    if (filterReceptionTo) result = result.filter((c) => c.reception_date && c.reception_date <= filterReceptionTo)
    if (filterOpeningFrom) result = result.filter((c) => c.opening_date && c.opening_date >= filterOpeningFrom)
    if (filterOpeningTo) result = result.filter((c) => c.opening_date && c.opening_date <= filterOpeningTo)

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

  useEffect(() => { setPage(1) }, [search, filterStatus, filterManager, filterErp, filterConnection, filterReceptionFrom, filterReceptionTo, filterOpeningFrom, filterOpeningTo])

  const activeFilterCount = [filterStatus, filterManager, filterErp, filterConnection, filterReceptionFrom, filterReceptionTo, filterOpeningFrom, filterOpeningTo].filter(Boolean).length

  const clearFilters = () => {
    setFilterStatus('')
    setFilterManager('')
    setFilterErp('')
    setFilterConnection('')
    setFilterReceptionFrom('')
    setFilterReceptionTo('')
    setFilterOpeningFrom('')
    setFilterOpeningTo('')
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

  // Excel/CSV 파일 읽기 → 미리보기 모달
  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    let rows: any[] = []

    try {
      const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')

      if (isExcel) {
        const buffer = await file.arrayBuffer()
        const wb = XLSX.read(buffer, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const jsonData = XLSX.utils.sheet_to_json<any>(ws, { header: 1, defval: '' })

        if (jsonData.length < 2) { alert('데이터가 없습니다. (1행은 헤더, 2행부터 데이터)'); return }

        // 1행 = 헤더, 2행부터 = 데이터
        const headers = (jsonData[0] as string[]).map((h: any) => String(h).trim())
        rows = jsonData.slice(1).map((values: any) => {
          const row: any = {}
          headers.forEach((h, i) => {
            const field = CUSTOMER_FIELDS.find((f) => f.label === h || f.key === h)
            if (field) {
              let val = values[i] != null ? String(values[i]).trim() : ''
              if (val.endsWith('.0')) val = val.replace('.0', '')
              if (field.type === 'date' && val && !isNaN(Number(val))) {
                const d = XLSX.SSF.parse_date_code(Number(val))
                if (d) val = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
              }
              row[field.key] = val
            }
          })
          return row
        }).filter((r: any) => r.customer_name)
      } else {
        const text = await file.text()
        const lines = text.split('\n').filter((l) => l.trim())
        if (lines.length < 2) { alert('데이터가 없습니다. (1행은 헤더, 2행부터 데이터)'); return }

        // 1행 = 헤더, 2행부터 = 데이터
        const headers = lines[0].split(',').map((h) => h.trim().replace(/^["']|["']$/g, ''))
        rows = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim().replace(/^["']|["']$/g, ''))
          const row: any = {}
          headers.forEach((h, i) => {
            const field = CUSTOMER_FIELDS.find((f) => f.label === h || f.key === h)
            if (field) {
              let val = values[i] || ''
              if (val.endsWith('.0')) val = val.replace('.0', '')
              row[field.key] = val
            }
          })
          return row
        }).filter((r) => r.customer_name)
      }
    } catch {
      alert('파일을 읽는 중 오류가 발생했습니다. 양식을 확인해주세요.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    if (rows.length === 0) {
      alert('유효한 데이터가 없습니다.\n\n"일괄등록 양식 다운로드" 버튼으로 양식을 다운받아 작성해주세요.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    // 정제
    rows = rows.map((r) => {
      const cleaned = { ...r }
      CUSTOMER_FIELDS.forEach((f) => {
        if (f.type === 'date' && !cleaned[f.key]?.trim()) cleaned[f.key] = null
        if (f.key === 'business_number' && cleaned[f.key]) cleaned[f.key] = cleaned[f.key].replace(/[^0-9]/g, '')
        if (f.key === 'customer_number' && cleaned[f.key]) cleaned[f.key] = cleaned[f.key].replace(/[^0-9]/g, '')
      })
      return cleaned
    })

    // 미리보기 모달 열기
    setImportPreview(rows)
    setImportFileName(file.name)
    setShowImportModal(true)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 미리보기 확인 후 실제 업로드
  const handleConfirmImport = async () => {
    setImporting(true)

    const { data: { user } } = await supabase.auth.getUser()
    const rowsWithUser = importPreview.map((r) => ({ ...r, created_by: user?.id }))

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
      file_name: importFileName,
      total_count: importPreview.length,
      success_count: successCount,
      fail_count: failCount,
    }])

    setImporting(false)
    setShowImportModal(false)
    setImportPreview([])

    if (failCount > 0) {
      alert(`등록 완료: 성공 ${successCount}건, 실패 ${failCount}건`)
    } else {
      alert(`${successCount}건이 등록되었습니다.`)
    }
    loadCustomers()
  }

  const downloadTemplate = () => {
    const headers = CUSTOMER_FIELDS.map((f) => f.label)
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

    const ws = XLSX.utils.aoa_to_sheet([headers, example1, example2])
    // 컬럼 너비 자동 조정
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '고객등록양식')
    XLSX.writeFile(wb, '고객_일괄등록_양식.xlsx')
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
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm">
            <FileSpreadsheet size={16} /> 일괄등록 양식 다운로드
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm cursor-pointer">
            <Upload size={16} /> 일괄등록
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleBulkImport} className="hidden" />
          </label>
          <button onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm">
            <Plus size={16} /> 고객 등록
          </button>
        </div>
      </div>

      {/* 검색 */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명, 사업자번호, 담당자, 고객번호로 검색..."
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
        />
      </div>

      {/* 조건 필터 (항상 표시) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-700">조건 필터</span>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
              <RotateCcw size={12} /> 초기화
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">신규접수일 (시작)</label>
            <input type="date" value={filterReceptionFrom} onChange={(e) => setFilterReceptionFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">신규접수일 (종료)</label>
            <input type="date" value={filterReceptionTo} onChange={(e) => setFilterReceptionTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">개설/이행일 (시작)</label>
            <input type="date" value={filterOpeningFrom} onChange={(e) => setFilterOpeningFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">개설/이행일 (종료)</label>
            <input type="date" value={filterOpeningTo} onChange={(e) => setFilterOpeningTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none" />
          </div>
        </div>
      </div>

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
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">불러오는 중...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-8 text-gray-400">데이터가 없습니다</td></tr>
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
                        ) : col === 'business_number' && (c as any)[col] ? (
                          <a
                            href={`https://bizno.net/?query=${encodeURIComponent(c.customer_name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                            title="사업자번호 조회 (bizno.net)"
                          >
                            {(c as any)[col]}
                          </a>
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
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100">
                  {c.business_number ? (
                    <a
                      href={`https://bizno.net/?query=${encodeURIComponent(c.customer_name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 border border-blue-200 bg-blue-50 px-2.5 py-1 rounded-lg"
                    >
                      BIZNO.NET 검색
                    </a>
                  ) : <div />}
                  <div className="flex gap-3">
                    <button onClick={() => openEdit(c)} className="text-sm text-emerald-600 font-medium">수정</button>
                    <button onClick={() => handleDelete(c.id)} className="text-sm text-red-500 font-medium">삭제</button>
                  </div>
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
                            onChange={(e) => {
                              let val = e.target.value
                              // 사업자번호/고객번호는 숫자만 허용
                              if (field.key === 'business_number' || field.key === 'customer_number') {
                                val = val.replace(/[^0-9]/g, '')
                              }
                              setForm({ ...form, [field.key]: val })
                            }}
                            maxLength={field.key === 'business_number' ? 10 : field.key === 'customer_number' ? 9 : undefined}
                            inputMode={field.key === 'business_number' || field.key === 'customer_number' ? 'numeric' : undefined}
                            placeholder={field.key === 'business_number' ? '숫자 10자리' : field.key === 'customer_number' ? '숫자 9자리' : undefined}
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

      {/* 일괄등록 미리보기 모달 */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-bold text-gray-800">일괄등록 미리보기</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  파일: {importFileName} · <strong className="text-emerald-600">{importPreview.length}건</strong> 등록 예정
                </p>
              </div>
              <button onClick={() => { setShowImportModal(false); setImportPreview([]); setEditingImportIdx(null) }} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-3">
              <p className="text-xs text-gray-400">1행(헤더)은 제외되었습니다. 카드를 클릭하면 수정/추가할 수 있습니다.</p>

              {importPreview.slice(0, 100).map((row, i) => {
                // 입력된 필드 수 계산
                const filledCount = CUSTOMER_FIELDS.filter((f) => row[f.key] && String(row[f.key]).trim()).length
                // 추가 정보 (기본 6개 외)
                const extraFields = CUSTOMER_FIELDS.filter(
                  (f) => !['customer_name','business_number','customer_number','manager','reception_date','opening_status'].includes(f.key) && row[f.key] && String(row[f.key]).trim()
                )

                return (
                  <div key={i}
                    className="border border-gray-200 rounded-xl p-4 hover:border-emerald-300 hover:bg-emerald-50/30 cursor-pointer transition"
                    onClick={() => { setEditingImportIdx(i); setEditingImportForm({ ...row }) }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        {/* 상단: 핵심 정보 */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">#{i + 1}</span>
                          <span className="font-semibold text-gray-800 truncate">{row.customer_name || '-'}</span>
                          {row.opening_status && (
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusBadge(row.opening_status)}`}>
                              {row.opening_status}
                            </span>
                          )}
                        </div>

                        {/* 중단: 주요 정보 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-1 text-xs">
                          <div><span className="text-gray-400">사업자번호</span> <span className="text-gray-700 ml-1">{row.business_number || '-'}</span></div>
                          <div><span className="text-gray-400">고객번호</span> <span className="text-gray-700 ml-1">{row.customer_number || '-'}</span></div>
                          <div><span className="text-gray-400">담당자</span> <span className="text-gray-700 ml-1">{row.manager || '-'}</span></div>
                          <div><span className="text-gray-400">접수일</span> <span className="text-gray-700 ml-1">{row.reception_date || '-'}</span></div>
                        </div>

                        {/* 하단: 추가 입력된 정보 태그 */}
                        {extraFields.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {extraFields.map((f) => (
                              <span key={f.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded text-xs border border-emerald-100">
                                {f.label}: {String(row[f.key]).length > 10 ? String(row[f.key]).substring(0, 10) + '...' : row[f.key]}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* 우측: 수정/삭제 + 입력률 */}
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5">
                          <button className="p-1.5 text-gray-300 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" onClick={(e) => { e.stopPropagation(); setEditingImportIdx(i); setEditingImportForm({ ...row }) }}>
                            <Edit2 size={14} />
                          </button>
                          <button className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition" onClick={(e) => {
                            e.stopPropagation()
                            setImportPreview((prev) => prev.filter((_, idx) => idx !== i))
                          }}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                        <span className="text-xs text-gray-400">{filledCount}/{CUSTOMER_FIELDS.length}항목</span>
                      </div>
                    </div>
                  </div>
                )
              })}

              {importPreview.length > 100 && (
                <p className="text-xs text-gray-400 text-center">상위 100건만 표시 · 전체 {importPreview.length}건 등록 예정</p>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => { setShowImportModal(false); setImportPreview([]); setEditingImportIdx(null) }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={importing || importPreview.length === 0}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-sm font-medium"
              >
                {importing ? '등록 중...' : `${importPreview.length}건 등록하기`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄등록 개별 수정 모달 */}
      {editingImportIdx !== null && (
        <div className="fixed inset-0 bg-black/30 z-[60] flex items-center justify-center p-4" onClick={() => setEditingImportIdx(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-bold text-gray-800">
                #{editingImportIdx + 1} {editingImportForm.customer_name || '고객'} 수정
              </h4>
              <button onClick={() => setEditingImportIdx(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CUSTOMER_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {field.label} {field.required && <span className="text-red-500">*</span>}
                  </label>
                  {field.type === 'select' && field.options ? (
                    <select
                      value={editingImportForm[field.key] || ''}
                      onChange={(e) => setEditingImportForm({ ...editingImportForm, [field.key]: e.target.value })}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">선택</option>
                      {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === 'select-other' && field.options ? (
                    <div className="flex gap-1.5">
                      <select
                        value={field.options.includes(editingImportForm[field.key]) ? editingImportForm[field.key] : editingImportForm[field.key] ? '기타' : ''}
                        onChange={(e) => {
                          if (e.target.value === '기타') setEditingImportForm({ ...editingImportForm, [field.key]: '' })
                          else setEditingImportForm({ ...editingImportForm, [field.key]: e.target.value })
                        }}
                        className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                      >
                        <option value="">선택</option>
                        {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        <option value="기타">기타</option>
                      </select>
                      {editingImportForm[field.key] && !field.options.includes(editingImportForm[field.key]) && (
                        <input type="text" value={editingImportForm[field.key]} onChange={(e) => setEditingImportForm({ ...editingImportForm, [field.key]: e.target.value })}
                          className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="직접 입력" />
                      )}
                    </div>
                  ) : (
                    <input
                      type={field.type || 'text'}
                      value={editingImportForm[field.key] || ''}
                      onChange={(e) => {
                        let val = e.target.value
                        if (field.key === 'business_number' || field.key === 'customer_number') val = val.replace(/[^0-9]/g, '')
                        setEditingImportForm({ ...editingImportForm, [field.key]: val })
                      }}
                      maxLength={field.key === 'business_number' ? 10 : field.key === 'customer_number' ? 9 : undefined}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setEditingImportIdx(null)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm">
                취소
              </button>
              <button onClick={() => {
                setImportPreview((prev) => prev.map((row, idx) => idx === editingImportIdx ? { ...editingImportForm } : row))
                setEditingImportIdx(null)
              }}
                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm">
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
