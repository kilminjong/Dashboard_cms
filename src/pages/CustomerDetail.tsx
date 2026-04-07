import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer, CustomerMemo, CustomerHistory } from '../types'
import { ArrowLeft, Save, Plus, Sparkles, RefreshCw, Clock } from 'lucide-react'

const TABS = ['기본정보', 'ERP정보', '담당자', '계약현황', '메모'] as const
type Tab = typeof TABS[number]

const FIELD_GROUPS: Record<string, { key: string; label: string; type?: string }[]> = {
  '기본정보': [
    { key: 'customer_name', label: '고객명' },
    { key: 'business_number', label: '사업자번호' },
    { key: 'customer_number', label: '고객번호' },
    { key: 'management_code', label: '관리코드' },
    { key: 'build_type', label: '구축구분' },
    { key: 'management_type', label: '관리구분' },
    { key: 'construction_type', label: '구축형' },
    { key: 'sensitive_customer', label: '민감고객' },
    { key: 'intimacy', label: '친밀도' },
    { key: 'duplicate_check', label: '중복체크' },
  ],
  'ERP정보': [
    { key: 'erp_company', label: 'ERP회사' },
    { key: 'erp_type', label: 'ERP 종류' },
    { key: 'erp_db', label: 'ERP DB' },
    { key: 'connection_method', label: '연계방식' },
    { key: 'server_location', label: '서버PC 상세위치' },
    { key: 'schedule_use', label: '스케줄사용여부' },
    { key: 'customer_ip', label: '고객사 IP' },
  ],
  '담당자': [
    { key: 'manager', label: '담당자' },
    { key: 'customer_contact_person', label: '고객담당자' },
    { key: 'customer_department', label: '담당 부서' },
    { key: 'contact_phone', label: '담당자 연락처' },
    { key: 'contact_email', label: '담당자 이메일', type: 'email' },
  ],
  '계약현황': [
    { key: 'reception_date', label: '신규접수일', type: 'date' },
    { key: 'opening_status', label: '개설상태' },
    { key: 'opening_date', label: '개설/이행일', type: 'date' },
    { key: 'connection_status', label: '연계상태' },
    { key: 'connection_date', label: '연계일자', type: 'date' },
  ],
}

const FIELD_LABELS: Record<string, string> = {}
Object.values(FIELD_GROUPS).forEach((fields) => {
  fields.forEach((f) => { FIELD_LABELS[f.key] = f.label })
})

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [originalForm, setOriginalForm] = useState<Record<string, string>>({})
  const [activeTab, setActiveTab] = useState<Tab>('기본정보')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  // 메모
  const [memos, setMemos] = useState<CustomerMemo[]>([])
  const [newMemo, setNewMemo] = useState('')
  const [memoLoading, setMemoLoading] = useState(false)

  // AI 요약
  const [aiMemoSummary, setAiMemoSummary] = useState('')
  const [aiMemoLoading, setAiMemoLoading] = useState(false)

  // 변경 이력
  const [history, setHistory] = useState<CustomerHistory[]>([])

  useEffect(() => {
    if (id) {
      loadCustomer()
      loadMemos()
      loadHistory()
    }
  }, [id])

  const loadCustomer = async () => {
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single()

    if (data) {
      setCustomer(data)
      const f: Record<string, string> = {}
      Object.values(FIELD_GROUPS).flat().forEach(({ key }) => {
        f[key] = (data as any)[key] || ''
      })
      setForm(f)
      setOriginalForm(f)
    }
    setLoading(false)
  }

  const loadMemos = async () => {
    const { data } = await supabase
      .from('customer_memos')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: false })
    setMemos(data || [])
  }

  const loadHistory = async () => {
    const { data } = await supabase
      .from('customer_history')
      .select('*')
      .eq('customer_id', id)
      .order('changed_at', { ascending: false })
      .limit(50)
    setHistory(data || [])
  }

  const handleSave = async () => {
    if (!customer) return
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()

    // 변경된 필드만 이력 저장
    const changes: { field_name: string; old_value: string; new_value: string }[] = []
    Object.keys(form).forEach((key) => {
      if (form[key] !== originalForm[key]) {
        changes.push({
          field_name: FIELD_LABELS[key] || key,
          old_value: originalForm[key] || '',
          new_value: form[key] || '',
        })
      }
    })

    // 고객 정보 업데이트
    await supabase
      .from('customers')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', customer.id)

    // 변경 이력 저장
    if (changes.length > 0 && user) {
      await supabase.from('customer_history').insert(
        changes.map((c) => ({
          customer_id: customer.id,
          field_name: c.field_name,
          old_value: c.old_value,
          new_value: c.new_value,
          changed_by: user.id,
        }))
      )
    }

    setOriginalForm({ ...form })
    setEditing(false)
    setSaving(false)
    loadHistory()
  }

  const handleAddMemo = async () => {
    if (!newMemo.trim() || !id) return
    setMemoLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('customer_memos').insert([{
      customer_id: id,
      content: newMemo.trim(),
      created_by: user?.id,
    }])

    setNewMemo('')
    setMemoLoading(false)
    loadMemos()
  }

  const handleAiMemoSummary = async () => {
    if (memos.length === 0) {
      setAiMemoSummary('요약할 메모가 없습니다.')
      return
    }

    setAiMemoLoading(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          todaySchedules: [],
          recentCustomers: [],
          managerName: '',
          date: new Date().toISOString().split('T')[0],
          memoSummaryRequest: true,
          customerName: customer?.customer_name || '',
          memos: memos.map((m) => ({
            content: m.content,
            date: new Date(m.created_at).toLocaleDateString('ko-KR'),
          })),
        }),
      })

      const text = await res.text()
      if (!res.ok) {
        console.error(`[AI 메모 요약 에러 ${res.status}]`, text)
        setAiMemoSummary('오류가 발생했습니다. 관리자에게 문의해주세요.')
      } else {
        const data = JSON.parse(text)
        setAiMemoSummary(data?.summary || '요약을 생성할 수 없습니다.')
      }
    } catch (err) {
      console.error('[AI 메모 요약 에러]', err)
      setAiMemoSummary('오류가 발생했습니다. 관리자에게 문의해주세요.')
    }
    setAiMemoLoading(false)
  }

  if (loading) {
    return <div className="text-center py-8 text-gray-400">불러오는 중...</div>
  }

  if (!customer) {
    return <div className="text-center py-8 text-gray-400">고객 정보를 찾을 수 없습니다.</div>
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/customers')} className="p-2 hover:bg-gray-100 rounded-lg transition">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-gray-800">{customer.customer_name}</h2>
          <p className="text-sm text-gray-500">{customer.business_number || '사업자번호 없음'} · {customer.manager || '담당자 미지정'}</p>
        </div>
        {editing ? (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setForm({ ...originalForm }) }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"
            >
              <Save size={16} />
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"
          >
            수정
          </button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex overflow-x-auto border-b border-gray-200 mb-6 -mx-1">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition border-b-2 mx-1 ${
              activeTab === tab
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 내용: 기본정보 / ERP정보 / 담당자 / 계약현황 */}
      {activeTab !== '메모' && FIELD_GROUPS[activeTab] && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FIELD_GROUPS[activeTab].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-500 mb-1">{field.label}</label>
                {editing ? (
                  <input
                    type={field.type || 'text'}
                    value={form[field.key] || ''}
                    onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />
                ) : (
                  <p className="px-3 py-2.5 bg-gray-50 rounded-lg text-sm text-gray-800 min-h-[42px]">
                    {form[field.key] || '-'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 메모 탭 */}
      {activeTab === '메모' && (
        <div className="space-y-4">
          {/* AI 요약 */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">AI 메모 요약</span>
              </div>
              <button
                onClick={handleAiMemoSummary}
                disabled={aiMemoLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs"
              >
                {aiMemoLoading ? (
                  <><RefreshCw size={12} className="animate-spin" /> 분석 중...</>
                ) : (
                  <><Sparkles size={12} /> AI 자동 요약</>
                )}
              </button>
            </div>
            {aiMemoSummary && (
              <p className="text-sm text-gray-700 leading-relaxed mt-2">{aiMemoSummary}</p>
            )}
            {!aiMemoSummary && !aiMemoLoading && (
              <p className="text-sm text-gray-400 mt-2">AI 자동 요약 버튼을 눌러 메모를 요약해보세요.</p>
            )}
          </div>

          {/* 메모 입력 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <textarea
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none"
              placeholder="메모를 입력하세요 (영업 이력, 특이사항 등)"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddMemo}
                disabled={memoLoading || !newMemo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-sm"
              >
                <Plus size={16} />
                {memoLoading ? '저장 중...' : '메모 추가'}
              </button>
            </div>
          </div>

          {/* 메모 목록 */}
          <div className="space-y-3">
            {memos.length === 0 ? (
              <p className="text-center py-8 text-gray-400">등록된 메모가 없습니다.</p>
            ) : (
              memos.map((memo) => (
                <div key={memo.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{memo.content}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {new Date(memo.created_at).toLocaleString('ko-KR')}
                  </p>
                </div>
              ))
            )}
          </div>

          {/* 변경 이력 */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <Clock size={16} className="text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-700">변경 이력</h4>
              </div>
              <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="px-4 py-3">
                    <p className="text-sm text-gray-700">
                      <span className="font-medium text-gray-800">{h.field_name}</span>
                      {' '}변경: <span className="text-red-500 line-through">{h.old_value || '(없음)'}</span>
                      {' → '}<span className="text-emerald-600">{h.new_value || '(없음)'}</span>
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(h.changed_at).toLocaleString('ko-KR')}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
