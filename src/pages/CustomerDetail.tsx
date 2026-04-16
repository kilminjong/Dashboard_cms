import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchCustomers, updateCustomer } from '../lib/googleSheets'
import type { Customer, CustomerMemo, CustomerHistory } from '../types'
import { ArrowLeft, Save, Plus, Sparkles, RefreshCw, Clock, Trash2, Edit2, Upload, Image } from 'lucide-react'

const FIELD_GROUPS: Record<string, { key: string; label: string; type?: string; options?: string[] }[]> = {
  '기본정보': [
    { key: 'customer_name', label: '고객명' },
    { key: 'business_number', label: '사업자번호' },
    { key: 'customer_number', label: '고객번호' },
    { key: 'build_type', label: '구축구분', type: 'select', options: ['신규', '해지후재구축', '이행'] },
    { key: 'management_type', label: '관리구분', type: 'select', options: ['정상', '해지', '취소'] },
    { key: 'construction_type', label: '구축형', type: 'select', options: ['기본형', '연계형'] },
    { key: 'manager', label: '담당자' },
    { key: 'address', label: '주소' },
    { key: 'sensitive_customer', label: '민감고객', type: 'select', options: ['Y', 'N'] },
    { key: 'intimacy', label: '친밀도', type: 'select', options: ['상', '중', '하'] },
    // 계약현황 통합
    { key: 'reception_date', label: '신규접수일', type: 'date' },
    { key: 'opening_status', label: '개설상태', type: 'select', options: ['개설대기', '개설진행', '개설취소', '개설완료', '이행완료'] },
    { key: 'opening_date', label: '개설/이행일', type: 'date' },
    { key: 'connection_status', label: '연계상태', type: 'select', options: ['ERP연계대기', 'ERP연계진행', 'ERP연계완료', 'ERP청구완료', '연계청구보류'] },
    { key: 'connection_date', label: '연계일자', type: 'date' },
    { key: 'termination_date', label: '해지일자', type: 'date' },
  ],
  'ERP정보': [
    { key: 'erp_company', label: 'ERP회사' },
    { key: 'erp_type', label: 'ERP 종류', type: 'select', options: ['영림원', 'Amaranth10', 'ERP10', '옴니이솔', 'IU', 'ICUBE', 'SAP', '오직', '디모데'] },
    { key: 'erp_db', label: 'ERP DB' },
    { key: 'connection_method', label: '연계방식', type: 'select', options: ['DB to DB', 'API', '3 Tire', 'RFC'] },
    { key: 'server_location', label: '서버PC 상세위치', type: 'select-other', options: ['내부', '전산실'] },
    { key: 'schedule_use', label: '스케줄사용여부', type: 'select', options: ['Y', 'N'] },
    { key: 'customer_ip', label: '고객사 IP' },
    { key: 'cms_ip', label: 'CMS IP' },
  ],
  '담당자1': [
    { key: 'customer_contact_person', label: '담당자1 이름' },
    { key: 'customer_department', label: '담당자1 부서', type: 'select-other', options: ['인사팀', '재무팀', '전산팀'] },
    { key: 'contact_phone', label: '담당자1 연락처' },
    { key: 'contact_email', label: '담당자1 이메일', type: 'email' },
  ],
  '담당자2': [
    { key: 'customer_contact_person2', label: '담당자2 이름' },
    { key: 'customer_department2', label: '담당자2 부서', type: 'select-other', options: ['인사팀', '재무팀', '전산팀'] },
    { key: 'contact_phone2', label: '담당자2 연락처' },
    { key: 'contact_email2', label: '담당자2 이메일', type: 'email' },
  ],
  '담당자3': [
    { key: 'customer_contact_person3', label: '담당자3 이름' },
    { key: 'customer_department3', label: '담당자3 부서', type: 'select-other', options: ['인사팀', '재무팀', '전산팀'] },
    { key: 'contact_phone3', label: '담당자3 연락처' },
    { key: 'contact_email3', label: '담당자3 이메일', type: 'email' },
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
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  const [memos, setMemos] = useState<CustomerMemo[]>([])
  const [newMemo, setNewMemo] = useState('')
  const [memoLoading, setMemoLoading] = useState(false)
  const [aiMemoSummary, setAiMemoSummary] = useState('')
  const [aiMemoLoading, setAiMemoLoading] = useState(false)
  const [history, setHistory] = useState<CustomerHistory[]>([])

  const [activeSection, setActiveSection] = useState<'info' | 'memo'>('info')
  const [cardUploading, setCardUploading] = useState(false)

  useEffect(() => {
    if (id) { loadCustomer(); loadMemos(); loadHistory() }
  }, [id])

  const loadCustomer = async () => {
    try {
      // gs_로 시작하는 ID면 구글시트에서 조회
      if (id?.startsWith('gs_')) {
        const rowIndex = parseInt(id.replace('gs_', ''))
        const allCustomers = await fetchCustomers()
        const data = allCustomers.find((c: any) => c._rowIndex === rowIndex)
        if (data) {
          setCustomer(data as any)
          const f: Record<string, string> = {}
          Object.values(FIELD_GROUPS).flat().forEach(({ key }) => { f[key] = (data as any)[key] || '' })
          setForm(f); setOriginalForm(f)
        }
      } else {
        // 기존 Supabase UUID면 구글시트에서 이름으로 검색
        const allCustomers = await fetchCustomers()
        const data = allCustomers.find((c: any) => c.id === id)
        if (data) {
          setCustomer(data as any)
          const f: Record<string, string> = {}
          Object.values(FIELD_GROUPS).flat().forEach(({ key }) => { f[key] = (data as any)[key] || '' })
          setForm(f); setOriginalForm(f)
        }
      }
    } catch (err) {
      console.error('고객 로드 실패:', err)
    }
    setLoading(false)
  }

  const loadMemos = async () => {
    const { data } = await supabase.from('customer_memos').select('*').eq('customer_id', id).order('created_at', { ascending: false })
    setMemos(data || [])
  }

  const loadHistory = async () => {
    const { data } = await supabase.from('customer_history').select('*').eq('customer_id', id).order('changed_at', { ascending: false }).limit(50)
    setHistory(data || [])
  }

  const handleSave = async () => {
    if (!customer) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    const changes: { field_name: string; old_value: string; new_value: string }[] = []
    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    Object.keys(form).forEach((key) => {
      if (form[key] !== originalForm[key]) {
        updateData[key] = form[key] || null
        changes.push({ field_name: FIELD_LABELS[key] || key, old_value: originalForm[key] || '', new_value: form[key] || '' })
      }
    })
    // 빈 날짜 null 처리
    Object.values(FIELD_GROUPS).flat().forEach((f) => {
      if (f.type === 'date' && updateData[f.key] === '') updateData[f.key] = null
    })

    try {
      if ((customer as any)._rowIndex) {
        await updateCustomer((customer as any)._rowIndex, { ...form })
      }
    } catch (err: any) { alert('저장 실패: ' + err.message); setSaving(false); return }

    if (changes.length > 0 && user) {
      await supabase.from('customer_history').insert(
        changes.map((c) => ({ customer_id: customer.id, field_name: c.field_name, old_value: c.old_value, new_value: c.new_value, changed_by: user.id }))
      )
    }
    setOriginalForm({ ...form }); setEditing(false); setSaving(false)
    loadCustomer(); loadHistory()
  }

  const handleAddMemo = async () => {
    if (!newMemo.trim() || !id) return
    setMemoLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('customer_memos').insert([{ customer_id: id, content: newMemo.trim(), created_by: user?.id }])
    setNewMemo(''); setMemoLoading(false); loadMemos()
  }

  const handleAiMemoSummary = async () => {
    if (memos.length === 0) { setAiMemoSummary('요약할 메모가 없습니다.'); return }
    setAiMemoLoading(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${supabaseUrl}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`, 'apikey': supabaseAnonKey },
        body: JSON.stringify({ memoSummaryRequest: true, customerName: customer?.customer_name || '', memos: memos.map((m) => ({ content: m.content, date: new Date(m.created_at).toLocaleDateString('ko-KR') })) }),
      })
      const text = await res.text()
      if (!res.ok) { setAiMemoSummary('오류가 발생했습니다.') }
      else { const data = JSON.parse(text); setAiMemoSummary(data?.summary || '요약 실패') }
    } catch { setAiMemoSummary('오류가 발생했습니다.') }
    setAiMemoLoading(false)
  }

  // 명함 OCR: 이미지 → Base64 → Claude Vision → 텍스트 추출 → 자동 입력
  const handleCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !customer) return
    setCardUploading(true)

    try {
      // 이미지를 고해상도 Base64로 변환 (OCR 정확도 향상)
      const base64 = await new Promise<string>((resolve) => {
        const img = new window.Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          // 고해상도 유지 (최대 1600px)
          const MAX = 1600
          const scale = Math.min(1, MAX / Math.max(img.width, img.height))
          canvas.width = img.width * scale
          canvas.height = img.height * scale
          const ctx = canvas.getContext('2d')!
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          const dataUrl = canvas.toDataURL('image/png', 1.0) // PNG 무손실
          resolve(dataUrl.split(',')[1])
        }
        img.src = URL.createObjectURL(file)
      })

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`, 'apikey': supabaseAnonKey },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `이 명함 이미지를 매우 정확하게 OCR 분석해주세요.

## 중요 규칙
1. 이미지에 보이는 텍스트를 한 글자도 틀리지 않게 정확히 읽어주세요.
2. 한글 이름은 특히 주의: 받침, 모음을 정확히 구분 (예: 이하름 vs 이아름, 길민종 vs 김민종)
3. 이메일 주소는 영문 알파벳, 숫자, 특수문자(@._-)를 정확히 읽기
4. 전화번호는 숫자와 하이픈만 정확히 읽기
5. 확실하지 않은 글자가 있으면 이미지를 다시 한번 확인하고 가장 정확한 값을 입력

## 출력 형식
반드시 아래 JSON 형식으로만 답변하세요. 다른 텍스트 없이 JSON만:
{"name":"성명(풀네임)","phone":"전화번호(하이픈포함)","email":"이메일주소","department":"부서명","position":"직급/직책","company":"회사명","address":"주소"}` }],
          imageBase64: base64,
          imageType: 'image/png',
        }),
      })

      const result = await res.json()
      const reply = result?.reply || ''

      // JSON 파싱 시도
      const jsonMatch = reply.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const cardInfo = JSON.parse(jsonMatch[0])
        const newForm = { ...form }
        if (cardInfo.name) newForm.customer_contact_person = cardInfo.name
        if (cardInfo.phone) newForm.contact_phone = cardInfo.phone
        if (cardInfo.email) newForm.contact_email = cardInfo.email
        if (cardInfo.department) newForm.customer_department = cardInfo.department
        setForm(newForm)

        // 구글시트에도 반영
        if ((customer as any)._rowIndex) {
          await updateCustomer((customer as any)._rowIndex, newForm)
        }

        alert(`명함 인식 완료!\n\n이름: ${cardInfo.name || '-'}\n전화: ${cardInfo.phone || '-'}\n이메일: ${cardInfo.email || '-'}\n부서: ${cardInfo.department || '-'}\n직급: ${cardInfo.position || '-'}`)
      } else {
        alert('명함 인식 결과를 파싱할 수 없습니다. 다시 시도해주세요.')
      }
    } catch (err: any) {
      alert('명함 인식 실패: ' + err.message)
    }

    setCardUploading(false)
    e.target.value = ''
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>
  if (!customer) return <div className="text-center py-20"><p className="text-gray-400 mb-4">고객 정보를 찾을 수 없습니다.</p><button onClick={() => navigate('/customers')} className="text-emerald-600 hover:underline text-sm">목록으로</button></div>

  // 전체현황 렌더링 함수
  const renderOverview = () => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-blue-50 px-4 py-2 border-b border-blue-100"><span className="text-sm font-semibold text-blue-700">고객 / 계약 정보</span></div>
        <div className="text-xs">
          {[
            ['고객명', form.customer_name], ['사업자번호', form.business_number], ['고객번호', form.customer_number],
            ['구축구분', form.build_type], ['관리구분', form.management_type], ['구축형', form.construction_type],
            ['담당자', form.manager], ['주소', form.address], ['접수일', form.reception_date],
            ['개설상태', form.opening_status], ['개설일', form.opening_date],
            ['연계상태', form.connection_status], ['연계일자', form.connection_date],
            ['해지일자', form.termination_date], ['CMS IP', form.cms_ip], ['민감고객', form.sensitive_customer], ['친밀도', form.intimacy],
          ].map(([label, val], i) => (
            <div key={label} className={`flex ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
              <span className="px-3 py-2 text-gray-800">
                {label === '개설상태' && val ? <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(val)}`}>{val}</span> : val || '-'}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="bg-purple-50 px-4 py-2 border-b border-purple-100"><span className="text-sm font-semibold text-purple-700">ERP / 서버 정보</span></div>
        <div className="text-xs">
          {[
            ['ERP회사', form.erp_company], ['ERP종류', form.erp_type], ['ERP DB', form.erp_db],
            ['연계방식', form.connection_method], ['서버위치', form.server_location],
            ['스케줄사용', form.schedule_use], ['고객사 IP', form.customer_ip], ['CMS IP', form.cms_ip],
          ].map(([label, val], i) => (
            <div key={label} className={`flex ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
              <span className="px-3 py-2 text-gray-800">{val || '-'}</span>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 px-4 py-2 border-t border-b border-amber-100"><span className="text-sm font-semibold text-amber-700">담당자 정보</span></div>
        <div className="text-xs">
          {[
            ['담당자1', form.customer_contact_person], ['부서1', form.customer_department],
            ['연락처1', form.contact_phone], ['이메일1', form.contact_email],
            ...(form.customer_contact_person2 ? [['담당자2', form.customer_contact_person2], ['부서2', form.customer_department2], ['연락처2', form.contact_phone2], ['이메일2', form.contact_email2]] : []),
            ...(form.customer_contact_person3 ? [['담당자3', form.customer_contact_person3], ['부서3', form.customer_department3], ['연락처3', form.contact_phone3], ['이메일3', form.contact_email3]] : []),
          ].map(([label, val], i) => (
            <div key={label + i} className={`flex ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
              <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
              <span className="px-3 py-2 text-gray-800">{val || '-'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // 필드 렌더링
  const renderField = (field: any) => {
    if (field.type === 'select' && field.options) {
      return <select value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"><option value="">선택</option>{field.options.map((o: string) => <option key={o} value={o}>{o}</option>)}</select>
    }
    if (field.type === 'select-other' && field.options) {
      return <div className="flex gap-2">
        <select value={field.options.includes(form[field.key]) ? form[field.key] : form[field.key] ? '기타' : ''} onChange={(e) => { if (e.target.value === '기타') setForm({ ...form, [field.key]: '' }); else setForm({ ...form, [field.key]: e.target.value }) }} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"><option value="">선택</option>{field.options.map((o: string) => <option key={o} value={o}>{o}</option>)}<option value="기타">기타</option></select>
        {!field.options.includes(form[field.key]) && form[field.key] !== '' && <input type="text" value={form[field.key] || ''} onChange={(e) => setForm({ ...form, [field.key]: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="직접 입력" />}
      </div>
    }
    return <input type={field.type || 'text'} value={form[field.key] || ''} onChange={(e) => { let v = e.target.value; if (field.key === 'business_number' || field.key === 'customer_number') v = v.replace(/[^0-9]/g, ''); setForm({ ...form, [field.key]: v }) }} maxLength={field.key === 'business_number' ? 10 : field.key === 'customer_number' ? 9 : undefined} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/customers')} className="p-2 hover:bg-gray-100 rounded-lg transition"><ArrowLeft size={20} className="text-gray-500" /></button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-gray-800 truncate">{customer.customer_name}</h2>
          <div className="flex flex-wrap items-center gap-2 mt-0.5">
            <span className="text-sm text-gray-500">{customer.business_number || '-'}</span>
            <span className="text-gray-300">·</span>
            <span className="text-sm text-gray-500">{customer.manager || '-'}</span>
            {customer.opening_status && <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(customer.opening_status)}`}>{customer.opening_status}</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => setActiveSection('info')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeSection === 'info' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>정보</button>
          <button onClick={() => setActiveSection('memo')} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${activeSection === 'memo' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>메모 ({memos.length})</button>
        </div>
      </div>

      {/* 정보 섹션 */}
      {activeSection === 'info' && (
        <>
          {/* 전체현황 (상단 바로 표시) */}
          {!editing && renderOverview()}

          {/* 명함 인식 (OCR) */}
          {!editing && (
            <div
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4"
              onPaste={async (e) => {
                const items = e.clipboardData?.items
                if (!items) return
                for (const item of Array.from(items)) {
                  if (item.type.startsWith('image/')) {
                    e.preventDefault()
                    const file = item.getAsFile()
                    if (file) {
                      // 가짜 이벤트로 handleCardUpload 호출
                      const fakeEvent = { target: { files: [file], value: '' } } as any
                      handleCardUpload(fakeEvent)
                    }
                    break
                  }
                }
              }}
              tabIndex={0}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Image size={15} className="text-gray-500" />
                  <span className="text-sm font-semibold text-gray-700">명함 인식</span>
                  <span className="text-xs text-gray-400">(AI 자동 입력)</span>
                </div>
                <label className={`flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg text-xs cursor-pointer hover:bg-blue-100 transition ${cardUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={13} /> {cardUploading ? '인식 중...' : '명함 촬영/업로드'}
                  <input type="file" accept="image/*" onChange={handleCardUpload} className="hidden" />
                </label>
              </div>
              <p className="text-xs text-gray-400">명함 사진 업로드 또는 <strong className="text-gray-500">Ctrl+V로 붙여넣기</strong>하면 AI가 자동 인식합니다. (이 영역 클릭 후 붙여넣기)</p>
            </div>
          )}

          {/* 수정 버튼 */}
          {!editing && (
            <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm mb-4">
              <Edit2 size={15} /> 정보 수정
            </button>
          )}

          {/* 인라인 수정 폼 */}
          {editing && (
            <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">정보 수정</h3>
                <div className="flex gap-2">
                  <button onClick={() => { setEditing(false); setForm({ ...originalForm }) }} className="px-3 py-1.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">취소</button>
                  <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"><Save size={14} />{saving ? '저장 중...' : '저장'}</button>
                </div>
              </div>

              {Object.entries(FIELD_GROUPS).map(([group, fields]) => (
                <div key={group} className="mb-5">
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{group}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {fields.map((field) => (
                      <div key={field.key}>
                        <label className="block text-xs font-medium text-gray-500 mb-1">{field.label}</label>
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 메모 섹션 */}
      {activeSection === 'memo' && (
        <div className="space-y-4">
          {/* AI 요약 */}
          <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2"><Sparkles size={16} className="text-emerald-600" /><span className="text-sm font-medium text-emerald-700">AI 메모 요약</span></div>
              <button onClick={handleAiMemoSummary} disabled={aiMemoLoading} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-xs">
                {aiMemoLoading ? <><RefreshCw size={12} className="animate-spin" /> 분석 중...</> : <><Sparkles size={12} /> AI 자동 요약</>}
              </button>
            </div>
            {aiMemoSummary ? <p className="text-sm text-gray-700 bg-white/60 rounded-lg p-3 mt-2">{aiMemoSummary}</p> : <p className="text-sm text-emerald-600/60 mt-2">AI 자동 요약 버튼을 눌러 메모를 요약해보세요.</p>}
          </div>

          {/* 메모 입력 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
            <textarea value={newMemo} onChange={(e) => setNewMemo(e.target.value)} rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none placeholder-gray-300" placeholder="메모를 입력하세요 (영업 이력, 특이사항, 통화 내용 등)" />
            <div className="flex justify-end mt-2">
              <button onClick={handleAddMemo} disabled={memoLoading || !newMemo.trim()} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 transition text-sm"><Plus size={15} />{memoLoading ? '저장 중...' : '메모 추가'}</button>
            </div>
          </div>

          {/* 메모 목록 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100"><h4 className="text-sm font-semibold text-gray-700">메모 기록 ({memos.length}건)</h4></div>
            {memos.length === 0 ? <p className="text-center py-10 text-gray-300 text-sm">등록된 메모가 없습니다.</p> : (
              <div className="divide-y divide-gray-50">
                {memos.map((memo) => (
                  <div key={memo.id} className="px-5 py-4">
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{memo.content}</p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">{new Date(memo.created_at).toLocaleString('ko-KR')}</p>
                      <button onClick={async () => { if (!confirm('삭제하시겠습니까?')) return; await supabase.from('customer_memos').delete().eq('id', memo.id); loadMemos() }} className="p-1 text-gray-300 hover:text-red-500 transition"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 변경 이력 */}
          {history.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2"><Clock size={15} className="text-gray-400" /><h4 className="text-sm font-semibold text-gray-700">변경 이력</h4></div>
              <div className="divide-y divide-gray-50 max-h-[300px] overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="px-5 py-3">
                    <div className="flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="font-medium text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{h.field_name}</span>
                      <span className="text-gray-400">:</span>
                      <span className="text-red-400 line-through text-xs">{h.old_value || '(없음)'}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-emerald-600 font-medium text-xs">{h.new_value || '(없음)'}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{new Date(h.changed_at).toLocaleString('ko-KR')}</p>
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
