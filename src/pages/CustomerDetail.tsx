import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer, CustomerMemo, CustomerHistory } from '../types'
import { ArrowLeft, Save, Plus, Sparkles, RefreshCw, Clock, Building2, Server, UserCircle, FileText, MessageSquare, Trash2 } from 'lucide-react'

const TABS = [
  { key: '기본정보', icon: Building2 },
  { key: 'ERP정보', icon: Server },
  { key: '담당자', icon: UserCircle },
  { key: '계약현황', icon: FileText },
  { key: '메모', icon: MessageSquare },
] as const
type Tab = typeof TABS[number]['key']

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

const statusBadge = (status: string) => {
  if (!status) return 'bg-gray-100 text-gray-600'
  if (status === '개설완료' || status === '이행완료') return 'bg-emerald-100 text-emerald-700'
  if (status === '개설대기') return 'bg-amber-100 text-amber-700'
  if (status === '개설진행') return 'bg-blue-100 text-blue-700'
  if (status === '개설취소') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

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

  const [memos, setMemos] = useState<CustomerMemo[]>([])
  const [newMemo, setNewMemo] = useState('')
  const [memoLoading, setMemoLoading] = useState(false)

  const [aiMemoSummary, setAiMemoSummary] = useState('')
  const [aiMemoLoading, setAiMemoLoading] = useState(false)

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

    await supabase
      .from('customers')
      .update({ ...form, updated_at: new Date().toISOString() })
      .eq('id', customer.id)

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
    loadCustomer()
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
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw size={24} className="animate-spin text-emerald-500" />
      </div>
    )
  }

  if (!customer) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-4">고객 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate('/customers')} className="text-emerald-600 hover:underline text-sm">
          목록으로 돌아가기
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 헤더 카드 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-5">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/customers')} className="p-2 hover:bg-gray-100 rounded-lg transition mt-0.5 shrink-0">
            <ArrowLeft size={20} className="text-gray-500" />
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-gray-800 truncate">{customer.customer_name}</h2>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <span className="text-sm text-gray-500">{customer.business_number || '사업자번호 없음'}</span>
                  <span className="text-gray-300">·</span>
                  <span className="text-sm text-gray-500">{customer.manager || '담당자 미지정'}</span>
                  {customer.opening_status && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(customer.opening_status)}`}>
                        {customer.opening_status}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {editing ? (
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => { setEditing(false); setForm({ ...originalForm }) }}
                    className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 transition text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"
                  >
                    <Save size={15} />
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setEditing(true)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm shrink-0"
                >
                  수정
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 탭 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-5 overflow-hidden">
        <div className="flex overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 flex-1 justify-center min-w-0 ${
                activeTab === tab.key
                  ? 'border-emerald-600 text-emerald-600 bg-emerald-50/50'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:bg-gray-50'
              }`}
            >
              <tab.icon size={15} />
              <span className="hidden sm:inline">{tab.key}</span>
              <span className="sm:hidden text-xs">{tab.key}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 탭 내용: 필드 그룹 */}
      {activeTab !== '메모' && FIELD_GROUPS[activeTab] && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="divide-y divide-gray-50">
            {FIELD_GROUPS[activeTab].map((field) => (
              <div key={field.key} className="flex flex-col sm:flex-row sm:items-center px-5 py-3.5 gap-1 sm:gap-0">
                <label className="text-sm font-medium text-gray-500 sm:w-40 shrink-0">{field.label}</label>
                <div className="flex-1">
                  {editing ? (
                    <input
                      type={field.type || 'text'}
                      value={form[field.key] || ''}
                      onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                    />
                  ) : (
                    <span className="text-sm text-gray-800">
                      {field.key === 'opening_status' && form[field.key] ? (
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusBadge(form[field.key])}`}>
                          {form[field.key]}
                        </span>
                      ) : (
                        form[field.key] || <span className="text-gray-300">-</span>
                      )}
                    </span>
                  )}
                </div>
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
            <div className="flex items-center justify-between mb-2">
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
            {aiMemoSummary ? (
              <p className="text-sm text-gray-700 leading-relaxed bg-white/60 rounded-lg p-3 mt-2">{aiMemoSummary}</p>
            ) : (
              <p className="text-sm text-emerald-600/60 mt-2">AI 자동 요약 버튼을 눌러 메모를 요약해보세요.</p>
            )}
          </div>

          {/* 메모 입력 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <textarea
              value={newMemo}
              onChange={(e) => setNewMemo(e.target.value)}
              rows={3}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none placeholder-gray-300"
              placeholder="메모를 입력하세요 (영업 이력, 특이사항, 통화 내용 등)"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddMemo}
                disabled={memoLoading || !newMemo.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition text-sm"
              >
                <Plus size={15} />
                {memoLoading ? '저장 중...' : '메모 추가'}
              </button>
            </div>
          </div>

          {/* 메모 타임라인 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100">
              <h4 className="text-sm font-semibold text-gray-700">메모 기록 ({memos.length}건)</h4>
            </div>
            {memos.length === 0 ? (
              <p className="text-center py-10 text-gray-300 text-sm">등록된 메모가 없습니다.</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {memos.map((memo) => (
                  <div key={memo.id} className="px-5 py-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{memo.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">
                        {new Date(memo.created_at).toLocaleString('ko-KR')}
                      </p>
                      <button
                        onClick={async () => {
                          if (!confirm('이 메모를 삭제하시겠습니까?')) return
                          await supabase.from('customer_memos').delete().eq('id', memo.id)
                          loadMemos()
                        }}
                        className="p-1 text-gray-300 hover:text-red-500 transition"
                        title="메모 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 변경 이력 */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2">
                <Clock size={15} className="text-gray-400" />
                <h4 className="text-sm font-semibold text-gray-700">변경 이력</h4>
              </div>
              <div className="divide-y divide-gray-50 max-h-[350px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{h.field_name}</span>
                      <span className="text-gray-400">:</span>
                      <span className="text-red-400 line-through text-xs">{h.old_value || '(없음)'}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-emerald-600 font-medium text-xs">{h.new_value || '(없음)'}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
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
