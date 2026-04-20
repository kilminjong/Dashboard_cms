import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { KeyContact, BranchType } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'
import { Plus, Pencil, Trash2, Copy } from 'lucide-react'

export default function KeyContactsPage() {
  const { user } = useAuthStore()
  const canEdit = user?.role === 'SUPER_ADMIN' || user?.role === 'BRANCH_ADMIN'

  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [filterBranch, setFilterBranch] = useState<BranchType | '전체'>('전체')
  const [contacts, setContacts] = useState<KeyContact[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingContact, setEditingContact] = useState<KeyContact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<KeyContact | null>(null)
  const [isCopyOpen, setIsCopyOpen] = useState(false)

  // 등록 시 브랜치 선택
  const [formBranch, setFormBranch] = useState<BranchType>(user?.branch ?? 'IBK')

  const [form, setForm] = useState({
    name: '', position: '', department: '', phone: '', email: '', duty: '', notes: '',
  })

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from('key_contacts')
      .select('*')
      .eq('year', year)
      .order('branch')
      .order('created_at')

    if (filterBranch !== '전체') {
      query = query.eq('branch', filterBranch)
    }

    const { data } = await query
    if (data) setContacts(data as KeyContact[])
    setIsLoading(false)
  }, [year, filterBranch])

  useEffect(() => { fetchContacts() }, [fetchContacts])

  const openForm = (contact?: KeyContact) => {
    if (contact) {
      setEditingContact(contact)
      setFormBranch(contact.branch)
      setForm({
        name: contact.name, position: contact.position ?? '', department: contact.department ?? '',
        phone: contact.phone ?? '', email: contact.email ?? '', duty: contact.duty ?? '', notes: contact.notes ?? '',
      })
    } else {
      setEditingContact(null)
      setFormBranch(user?.branch ?? 'IBK')
      setForm({ name: '', position: '', department: '', phone: '', email: '', duty: '', notes: '' })
    }
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { alert('이름은 필수입니다.'); return }

    const payload = {
      year,
      branch: formBranch,
      name: form.name.trim(),
      position: form.position || null,
      department: form.department || null,
      phone: form.phone || null,
      email: form.email || null,
      duty: form.duty || null,
      notes: form.notes || null,
    }

    if (editingContact) {
      await supabase.from('key_contacts').update(payload).eq('id', editingContact.id)
    } else {
      await supabase.from('key_contacts').insert(payload)
    }

    setIsFormOpen(false)
    fetchContacts()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('key_contacts').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    fetchContacts()
  }

  // 전년도 데이터 복사
  const handleCopyPrevYear = async () => {
    const prevYear = year - 1
    let query = supabase.from('key_contacts').select('*').eq('year', prevYear)
    if (filterBranch !== '전체') query = query.eq('branch', filterBranch)
    const { data: prevData } = await query

    if (!prevData || prevData.length === 0) {
      alert(`${prevYear}년 데이터가 없습니다.`)
      return
    }

    const copied = prevData.map((c) => ({
      year,
      branch: c.branch,
      name: c.name,
      position: c.position,
      department: c.department,
      phone: c.phone,
      email: c.email,
      duty: c.duty,
      notes: c.notes,
    }))

    await supabase.from('key_contacts').insert(copied)
    setIsCopyOpen(false)
    fetchContacts()
  }

  // 브랜치별 그룹핑 (색상 구분용)
  const branchColorMap: Record<string, string> = {
    NH: 'bg-green-50', IBK: 'bg-blue-50', HANA: 'bg-cyan-50',
    KB: 'bg-yellow-50', IMBANK: 'bg-purple-50', iBranch: 'bg-pink-50', eCashBranch: 'bg-orange-50',
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none"

  return (
    <div>
      <Header title="핵심 인력 연락처" />
      <div className="p-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {Array.from({ length: 10 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value as BranchType | '전체')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            <option value="전체">전체 브랜치</option>
            {ALL_BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
          </select>

          <span className="text-sm text-gray-500 ml-2">
            총 <span className="font-semibold text-gray-800">{contacts.length}</span>명
          </span>

          <div className="ml-auto flex gap-2">
            {canEdit && (
              <>
                <button onClick={() => setIsCopyOpen(true)} className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
                  <Copy size={16} /> 전년도 복사
                </button>
                <button onClick={() => openForm()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-1.5 transition-colors">
                  <Plus size={16} /> 인력 등록
                </button>
              </>
            )}
          </div>
        </div>

        {/* 통합 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜치</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">구분</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">직책</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">부서</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">연락처</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">담당업무</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">비고</th>
                {canEdit && <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-20">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={canEdit ? 10 : 9} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : contacts.length === 0 ? (
                <tr><td colSpan={canEdit ? 10 : 9} className="px-4 py-12 text-center text-gray-400">{year}년 핵심 인력 데이터가 없습니다</td></tr>
              ) : (
                contacts.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${branchColorMap[c.branch] || ''}`}>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {BRANCH_LABELS[c.branch] ?? c.branch}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.duty || '-'}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.position || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-700">{c.department || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-700 font-mono text-xs">{c.phone || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.email || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{c.duty || '-'}</td>
                    <td className="px-4 py-2.5 text-gray-400 text-xs max-w-[120px] truncate">{c.notes || '-'}</td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-0.5">
                          <button onClick={() => openForm(c)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => setDeleteTarget(c)} className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 등록/수정 모달 */}
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingContact ? '인력 정보 수정' : '핵심 인력 등록'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">소속 브랜치 *</label>
            <select value={formBranch} onChange={(e) => setFormBranch(e.target.value as BranchType)} className={inputClass}>
              {ALL_BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
            <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직책</label>
              <input type="text" value={form.position} onChange={(e) => setForm((f) => ({ ...f, position: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <input type="text" value={form.department} onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">연락처</label>
              <input type="text" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className={inputClass} placeholder="010-0000-0000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">담당업무</label>
            <input type="text" value={form.duty} onChange={(e) => setForm((f) => ({ ...f, duty: e.target.value }))} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비고</label>
            <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className={inputClass} rows={2} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">취소</button>
          <button onClick={handleSave} className="px-5 py-2.5 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors">
            {editingContact ? '수정' : '등록'}
          </button>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="인력 삭제"
        message={`"${deleteTarget?.name}"을(를) 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
      />

      {/* 전년도 복사 확인 */}
      <ConfirmDialog
        isOpen={isCopyOpen}
        onClose={() => setIsCopyOpen(false)}
        onConfirm={handleCopyPrevYear}
        title="전년도 데이터 복사"
        message={`${year - 1}년 ${filterBranch === '전체' ? '전체 브랜치' : BRANCH_LABELS[filterBranch]} 핵심 인력 데이터를 ${year}년으로 복사하시겠습니까?`}
        confirmText="복사"
        variant="primary"
      />
    </div>
  )
}
