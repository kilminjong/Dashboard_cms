import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Plus, Search, X, Edit2, Trash2, ChevronLeft, Save } from 'lucide-react'

interface Lead {
  id: string
  company_name: string
  business_number: string
  product: string
  status: string
  manager: string
  contact_person: string
  contact_phone: string
  contact_email: string
  notes: string
  proposal_date: string | null
  next_action_date: string | null
  created_at: string
}

interface HistoryItem {
  id: string
  action_type: string
  content: string
  created_at: string
}

const PRODUCTS = ['대시보드', '글로벌대시보드', '이음텍스']
const STATUSES = ['제안', '미팅 예정', '미팅 완료', 'PoC 진행', '계약 협의', '계약 완료', '보류', '실패']
const ACTION_TYPES = ['전화 상담', '미팅', '이메일', '제안서 발송', 'PoC', '계약', '기타']

const statusColor = (s: string) => {
  if (s === '제안') return 'bg-gray-100 text-gray-700'
  if (s === '미팅 예정' || s === '미팅 완료') return 'bg-blue-100 text-blue-700'
  if (s === 'PoC 진행') return 'bg-purple-100 text-purple-700'
  if (s === '계약 협의') return 'bg-amber-100 text-amber-700'
  if (s === '계약 완료') return 'bg-emerald-100 text-emerald-700'
  if (s === '보류') return 'bg-orange-100 text-orange-700'
  if (s === '실패') return 'bg-red-100 text-red-700'
  return 'bg-gray-100 text-gray-600'
}

export default function Marketing() {
  const { profile } = useAuth()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterProduct, setFilterProduct] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [newAction, setNewAction] = useState({ action_type: '전화 상담', content: '' })

  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [form, setForm] = useState({ company_name: '', business_number: '', product: '대시보드', status: '제안', manager: '', contact_person: '', contact_phone: '', contact_email: '', notes: '', proposal_date: '', next_action_date: '' })

  useEffect(() => { loadLeads() }, [])

  const loadLeads = async () => {
    const { data } = await supabase.from('marketing_leads').select('*').order('created_at', { ascending: false })
    setLeads(data || [])
    setLoading(false)
  }

  const loadHistory = async (leadId: string) => {
    const { data } = await supabase.from('marketing_history').select('*').eq('lead_id', leadId).order('created_at', { ascending: false })
    setHistory(data || [])
  }

  const selectLead = (lead: Lead) => {
    setSelectedLead(lead)
    loadHistory(lead.id)
  }

  const openForm = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead)
      setForm({ company_name: lead.company_name, business_number: lead.business_number, product: lead.product, status: lead.status, manager: lead.manager, contact_person: lead.contact_person, contact_phone: lead.contact_phone, contact_email: lead.contact_email, notes: lead.notes, proposal_date: lead.proposal_date || '', next_action_date: lead.next_action_date || '' })
    } else {
      setEditingLead(null)
      setForm({ company_name: '', business_number: '', product: '대시보드', status: '제안', manager: profile?.name || '', contact_person: '', contact_phone: '', contact_email: '', notes: '', proposal_date: new Date().toISOString().split('T')[0], next_action_date: '' })
    }
    setShowForm(true)
  }

  const saveForm = async () => {
    if (!form.company_name.trim()) { alert('업체명을 입력해주세요.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const cleanForm = { ...form, proposal_date: form.proposal_date || null, next_action_date: form.next_action_date || null }

    if (editingLead) {
      await supabase.from('marketing_leads').update({ ...cleanForm, updated_at: new Date().toISOString() }).eq('id', editingLead.id)
    } else {
      await supabase.from('marketing_leads').insert([{ ...cleanForm, created_by: user?.id }])
    }
    setShowForm(false)
    loadLeads()
    if (selectedLead && editingLead?.id === selectedLead.id) {
      const { data } = await supabase.from('marketing_leads').select('*').eq('id', selectedLead.id).single()
      if (data) setSelectedLead(data)
    }
  }

  const deleteLead = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await supabase.from('marketing_leads').delete().eq('id', id)
    if (selectedLead?.id === id) { setSelectedLead(null); setHistory([]) }
    loadLeads()
  }

  const addHistory = async () => {
    if (!newAction.content.trim() || !selectedLead) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('marketing_history').insert([{ lead_id: selectedLead.id, action_type: newAction.action_type, content: newAction.content.trim(), created_by: user?.id }])
    setNewAction({ action_type: '전화 상담', content: '' })
    loadHistory(selectedLead.id)
  }

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase()
    const matchSearch = !q || l.company_name.toLowerCase().includes(q) || l.manager?.toLowerCase().includes(q)
    const matchProduct = !filterProduct || l.product === filterProduct
    const matchStatus = !filterStatus || l.status === filterStatus
    return matchSearch && matchProduct && matchStatus
  })

  // 상품별 통계
  const productStats = PRODUCTS.map((p) => ({
    name: p,
    total: leads.filter((l) => l.product === p).length,
    active: leads.filter((l) => l.product === p && !['계약 완료', '보류', '실패'].includes(l.status)).length,
    completed: leads.filter((l) => l.product === p && l.status === '계약 완료').length,
  }))

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">마케팅</h2>
          <p className="text-sm text-gray-400 mt-0.5">대시보드 · 글로벌대시보드 · 이음텍스 제안 관리</p>
        </div>
        <button onClick={() => openForm()} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm">
          <Plus size={16} /> 제안 등록
        </button>
      </div>

      {/* 상품별 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {productStats.map((p) => (
          <div key={p.name} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-sm font-semibold text-gray-700 mb-2">{p.name}</p>
            <div className="flex items-end gap-3">
              <div><p className="text-2xl font-bold text-gray-800">{p.total}</p><p className="text-xs text-gray-400">전체</p></div>
              <div><p className="text-lg font-bold text-blue-600">{p.active}</p><p className="text-xs text-gray-400">진행중</p></div>
              <div><p className="text-lg font-bold text-emerald-600">{p.completed}</p><p className="text-xs text-gray-400">완료</p></div>
            </div>
          </div>
        ))}
      </div>

      {/* 검색 + 필터 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="업체명, 담당자 검색..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
        </div>
        <select value={filterProduct} onChange={(e) => setFilterProduct(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">전체 상품</option>
          {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
          <option value="">전체 상태</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="flex gap-4 h-[calc(100vh-22rem)]">
        {/* 좌측: 목록 */}
        <div className={`${selectedLead ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-[360px] shrink-0`}>
          <p className="text-xs text-gray-400 mb-2">{filtered.length}건</p>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {loading ? <p className="text-center py-8 text-gray-400 text-sm">불러오는 중...</p> : filtered.length === 0 ? <p className="text-center py-8 text-gray-400 text-sm">데이터가 없습니다.</p> : (
              filtered.map((l) => (
                <div key={l.id} onClick={() => selectLead(l)}
                  className={`bg-white rounded-lg border p-3 cursor-pointer transition ${selectedLead?.id === l.id ? 'border-emerald-300 bg-emerald-50/40' : 'border-gray-100 hover:border-gray-200'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-gray-800 truncate">{l.company_name}</span>
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium shrink-0 ml-2 ${statusColor(l.status)}`}>{l.status}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{l.product}</span>
                    <span>{l.manager || '-'}</span>
                    {l.proposal_date && <span>{l.proposal_date}</span>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 우측: 상세 */}
        <div className={`${selectedLead ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0`}>
          {selectedLead ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden w-full flex flex-col">
              <div className="bg-slate-800 text-white px-5 py-4 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <button onClick={() => setSelectedLead(null)} className="lg:hidden p-1 hover:bg-slate-700 rounded"><ChevronLeft size={18} /></button>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold truncate">{selectedLead.company_name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-slate-300">{selectedLead.product}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColor(selectedLead.status)}`}>{selectedLead.status}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openForm(selectedLead)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700"><Edit2 size={13} /></button>
                    <button onClick={() => deleteLead(selectedLead.id)} className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs hover:bg-red-700"><Trash2 size={13} /></button>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-5">
                {/* 업체 정보 */}
                <div className="bg-gray-50 rounded-lg overflow-hidden text-xs">
                  {[
                    ['업체명', selectedLead.company_name], ['사업자번호', selectedLead.business_number],
                    ['상품', selectedLead.product], ['상태', selectedLead.status],
                    ['담당자', selectedLead.manager], ['고객담당자', selectedLead.contact_person],
                    ['연락처', selectedLead.contact_phone], ['이메일', selectedLead.contact_email],
                    ['제안일', selectedLead.proposal_date], ['다음 액션', selectedLead.next_action_date],
                    ['비고', selectedLead.notes],
                  ].map(([label, val], i) => (
                    <div key={label} className={`flex ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <span className="px-3 py-2 w-24 shrink-0 font-medium text-gray-500 border-r border-gray-100">{label}</span>
                      <span className="px-3 py-2 text-gray-800">{val || '-'}</span>
                    </div>
                  ))}
                </div>

                {/* 활동 기록 입력 */}
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-2">활동 기록 추가</p>
                  <div className="flex gap-2 mb-2">
                    <select value={newAction.action_type} onChange={(e) => setNewAction({ ...newAction, action_type: e.target.value })} className="px-2 py-1.5 border border-gray-300 rounded text-xs bg-white">
                      {ACTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="text" value={newAction.content} onChange={(e) => setNewAction({ ...newAction, content: e.target.value })}
                      placeholder="활동 내용을 입력하세요" className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-emerald-500 outline-none"
                      onKeyDown={(e) => { if (e.key === 'Enter') addHistory() }} />
                    <button onClick={addHistory} className="px-3 py-1.5 bg-emerald-600 text-white rounded text-xs hover:bg-emerald-700">추가</button>
                  </div>
                </div>

                {/* 히스토리 타임라인 */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-2">활동 히스토리 ({history.length}건)</p>
                  {history.length === 0 ? <p className="text-center py-6 text-gray-300 text-xs">기록이 없습니다.</p> : (
                    <div className="space-y-2">
                      {history.map((h) => (
                        <div key={h.id} className="flex gap-3 items-start">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 shrink-0"></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600">{h.action_type}</span>
                              <span className="text-[10px] text-gray-400">{new Date(h.created_at).toLocaleString('ko-KR')}</span>
                            </div>
                            <p className="text-xs text-gray-700 mt-0.5">{h.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center w-full h-full">
              <div className="text-center"><Plus size={48} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">좌측에서 업체를 선택하거나<br />"제안 등록" 버튼을 눌러 시작하세요.</p></div>
            </div>
          )}
        </div>
      </div>

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">{editingLead ? '제안 수정' : '제안 등록'}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">업체명 *</label><input type="text" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="업체명" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">사업자번호</label><input type="text" value={form.business_number} onChange={(e) => setForm({ ...form, business_number: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">상품 *</label><select value={form.product} onChange={(e) => setForm({ ...form, product: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">{PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">상태</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">담당자</label><input type="text" value={form.manager} onChange={(e) => setForm({ ...form, manager: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">고객담당자</label><input type="text" value={form.contact_person} onChange={(e) => setForm({ ...form, contact_person: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">연락처</label><input type="text" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">이메일</label><input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 mb-1">제안일</label><input type="date" value={form.proposal_date} onChange={(e) => setForm({ ...form, proposal_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">다음 액션일</label><input type="date" value={form.next_action_date} onChange={(e) => setForm({ ...form, next_action_date: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" /></div>
              </div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">비고</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none" placeholder="메모" /></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">취소</button>
              <button onClick={saveForm} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center justify-center gap-1.5"><Save size={15} />{editingLead ? '수정' : '등록'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
