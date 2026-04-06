import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import type { Customer } from '../types'
import { Plus, Search, Edit2, Trash2, X, Upload, Download } from 'lucide-react'

const CUSTOMER_FIELDS = [
  { key: 'customer_name', label: '고객명', required: true },
  { key: 'business_number', label: '사업자번호' },
  { key: 'customer_number', label: '고객번호' },
  { key: 'management_code', label: '관리코드' },
  { key: 'build_type', label: '구축구분' },
  { key: 'management_type', label: '관리구분' },
  { key: 'construction_type', label: '구축형' },
  { key: 'manager', label: '담당자' },
  { key: 'reception_date', label: '신규접수일', type: 'date' },
  { key: 'customer_contact_person', label: '고객담당자' },
  { key: 'customer_department', label: '담당 부서' },
  { key: 'contact_phone', label: '담당자 연락처' },
  { key: 'contact_email', label: '담당자 이메일', type: 'email' },
  { key: 'opening_status', label: '개설상태' },
  { key: 'opening_date', label: '개설/이행일', type: 'date' },
  { key: 'connection_status', label: '연계상태' },
  { key: 'connection_date', label: '연계일자', type: 'date' },
  { key: 'erp_company', label: 'ERP회사' },
  { key: 'erp_type', label: 'ERP 종류' },
  { key: 'erp_db', label: 'ERP DB' },
  { key: 'connection_method', label: '연계방식' },
  { key: 'server_location', label: '서버PC 상세위치' },
  { key: 'schedule_use', label: '스케줄사용여부' },
  { key: 'customer_ip', label: '고객사 IP' },
  { key: 'sensitive_customer', label: '민감고객' },
  { key: 'intimacy', label: '친밀도' },
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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<any>(emptyForm())
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async () => {
    const { data, count } = await supabase
      .from('customers')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(0, 9999)
    setCustomers(data || [])
    setLoading(false)
  }

  const filtered = customers.filter((c) =>
    c.customer_name.includes(search) ||
    c.business_number.includes(search) ||
    c.manager.includes(search) ||
    c.customer_number.includes(search)
  )

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
    if (editingCustomer) {
      await supabase
        .from('customers')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingCustomer.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('customers').insert([{ ...form, created_by: user?.id }])
    }
    setShowModal(false)
    loadCustomers()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return
    await supabase.from('customers').delete().eq('id', id)
    loadCustomers()
  }

  // CSV 일괄등록
  const handleBulkImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const text = await file.text()
    const lines = text.split('\n').filter((l) => l.trim())
    if (lines.length < 2) {
      alert('데이터가 없습니다.')
      return
    }

    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = lines.slice(1).map((line) => {
      const values = line.split(',').map((v) => v.trim())
      const row: any = {}
      headers.forEach((h, i) => {
        const field = CUSTOMER_FIELDS.find((f) => f.label === h)
        if (field) row[field.key] = values[i] || ''
      })
      return row
    }).filter((r) => r.customer_name)

    if (rows.length === 0) {
      alert('유효한 데이터가 없습니다. CSV 헤더를 확인해주세요.')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const rowsWithUser = rows.map((r) => ({ ...r, created_by: user?.id }))

    const { error } = await supabase.from('customers').insert(rowsWithUser)

    // 이력 기록
    await supabase.from('import_logs').insert([{
      user_id: user?.id,
      file_name: file.name,
      total_count: rows.length,
      success_count: error ? 0 : rows.length,
      fail_count: error ? rows.length : 0,
    }])

    if (error) {
      alert('등록 실패: ' + error.message)
    } else {
      alert(`${rows.length}건이 등록되었습니다.`)
      loadCustomers()
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // CSV 템플릿 다운로드
  const downloadTemplate = () => {
    const headers = CUSTOMER_FIELDS.map((f) => f.label).join(',')
    const blob = new Blob(['\uFEFF' + headers + '\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '고객등록_템플릿.csv'
    a.click()
    URL.revokeObjectURL(url)
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

      {/* 검색 */}
      <div className="relative mb-4">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="고객명, 사업자번호, 담당자, 고객번호로 검색..."
          className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none"
        />
      </div>

      {/* 건수 */}
      <p className="text-sm text-gray-500 mb-3">총 {filtered.length}건</p>

      {/* 테이블 (데스크탑) */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {TABLE_COLUMNS.map((col) => (
                  <th key={col} className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                    {CUSTOMER_FIELDS.find((f) => f.key === col)?.label}
                  </th>
                ))}
                <th className="text-right px-5 py-3 text-xs font-medium text-gray-500 uppercase">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">불러오는 중...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-400">데이터가 없습니다</td></tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    {TABLE_COLUMNS.map((col) => (
                      <td key={col} className="px-5 py-3 text-sm text-gray-700 whitespace-nowrap">
                        {(c as any)[col] || '-'}
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
      </div>

      {/* 카드 (모바일) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <p className="text-center py-8 text-gray-400">불러오는 중...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center py-8 text-gray-400">데이터가 없습니다</p>
        ) : (
          filtered.map((c) => (
            <div key={c.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-800">{c.customer_name}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  c.opening_status === '개설완료' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'
                }`}>
                  {c.opening_status || '미정'}
                </span>
              </div>
              <p className="text-sm text-gray-500">{c.business_number || '-'}</p>
              <p className="text-sm text-gray-500">담당: {c.manager || '-'}</p>
              <div className="flex justify-end gap-3 mt-3 pt-3 border-t border-gray-100">
                <button onClick={() => openEdit(c)} className="text-sm text-emerald-600 font-medium">수정</button>
                <button onClick={() => handleDelete(c.id)} className="text-sm text-red-500 font-medium">삭제</button>
              </div>
            </div>
          ))
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {CUSTOMER_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} {field.required && '*'}
                  </label>
                  <input
                    type={field.type || 'text'}
                    value={form[field.key]}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                    required={field.required}
                  />
                </div>
              ))}
            </div>

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
