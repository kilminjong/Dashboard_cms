import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { ErpMaster, BranchType } from '@/types'
import { Plus, Pencil, Trash2, GripVertical } from 'lucide-react'

const ALL_BRANCHES: BranchType[] = ['IBK', 'HANA', 'KB', 'iBranch', 'eCashBranch']

export default function ErpMasterPage() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  const [erpList, setErpList] = useState<ErpMaster[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingErp, setEditingErp] = useState<ErpMaster | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ErpMaster | null>(null)

  // 폼 상태
  const [form, setForm] = useState({
    product_name: '',
    company_name: '',
    manufacturer: '',
    branches: [] as string[],
    sort_order: 0,
    is_active: true,
  })

  const fetchErpList = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase
      .from('erp_master')
      .select('*')
      .order('sort_order')
    if (data) setErpList(data as ErpMaster[])
    setIsLoading(false)
  }, [])

  useEffect(() => { fetchErpList() }, [fetchErpList])

  const openForm = (erp?: ErpMaster) => {
    if (erp) {
      setEditingErp(erp)
      setForm({
        product_name: erp.product_name,
        company_name: erp.company_name,
        manufacturer: erp.manufacturer,
        branches: erp.branches,
        sort_order: erp.sort_order,
        is_active: erp.is_active,
      })
    } else {
      setEditingErp(null)
      setForm({ product_name: '', company_name: '', manufacturer: '', branches: [], sort_order: erpList.length, is_active: true })
    }
    setIsFormOpen(true)
  }

  const handleSave = async () => {
    if (!form.product_name.trim() || !form.company_name.trim() || !form.manufacturer.trim()) {
      alert('상품명, 업체명, 제조사는 필수입니다.')
      return
    }

    const payload = {
      product_name: form.product_name.trim(),
      company_name: form.company_name.trim(),
      manufacturer: form.manufacturer.trim(),
      branches: form.branches,
      sort_order: form.sort_order,
      is_active: form.is_active,
    }

    if (editingErp) {
      await supabase.from('erp_master').update(payload).eq('id', editingErp.id)
    } else {
      await supabase.from('erp_master').insert(payload)
    }

    setIsFormOpen(false)
    fetchErpList()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    await supabase.from('erp_master').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    fetchErpList()
  }

  const toggleBranch = (branch: string) => {
    setForm((prev) => ({
      ...prev,
      branches: prev.branches.includes(branch)
        ? prev.branches.filter((b) => b !== branch)
        : [...prev.branches, branch],
    }))
  }

  return (
    <div>
      <Header title="ERP 업체/상품 관리" />
      <div className="p-6">
        {/* 상단 */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500">총 <span className="font-semibold text-gray-800">{erpList.length}</span>건</p>
          {isSuperAdmin && (
            <button onClick={() => openForm()} className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-1.5 transition-colors">
              <Plus size={16} /> 신규 등록
            </button>
          )}
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase w-10">순서</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">업체명</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">제조사</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용 브랜치</th>
                <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                {isSuperAdmin && <th className="px-5 py-3 text-center text-xs font-medium text-gray-500 uppercase w-24">관리</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">로딩 중...</td></tr>
              ) : erpList.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">등록된 ERP 데이터가 없습니다</td></tr>
              ) : (
                erpList.map((erp) => (
                  <tr key={erp.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-400"><GripVertical size={16} /></td>
                    <td className="px-5 py-3 font-medium text-gray-900">{erp.product_name}</td>
                    <td className="px-5 py-3 text-gray-700">{erp.company_name}</td>
                    <td className="px-5 py-3 text-gray-700">{erp.manufacturer}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {erp.branches.map((b) => (
                          <span key={b} className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">{b}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${erp.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                        {erp.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-5 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openForm(erp)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors">
                            <Pencil size={15} />
                          </button>
                          <button onClick={() => setDeleteTarget(erp)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                            <Trash2 size={15} />
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
      <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={editingErp ? 'ERP 정보 수정' : 'ERP 신규 등록'} size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">상품명 *</label>
            <input type="text" value={form.product_name} onChange={(e) => setForm((f) => ({ ...f, product_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none" placeholder="예: iCUBE" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">업체명 *</label>
            <input type="text" value={form.company_name} onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none" placeholder="예: 더존비즈온" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">제조사 *</label>
            <input type="text" value={form.manufacturer} onChange={(e) => setForm((f) => ({ ...f, manufacturer: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none" placeholder="예: 더존" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">사용 브랜치</label>
            <div className="flex flex-wrap gap-2">
              {ALL_BRANCHES.map((b) => (
                <button key={b} type="button" onClick={() => toggleBranch(b)}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                    form.branches.includes(b) ? 'bg-primary text-white border-primary' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}>
                  {b}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">정렬 순서</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} className="rounded" />
                <span className="text-sm text-gray-700">활성</span>
              </label>
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <button onClick={() => setIsFormOpen(false)} className="px-5 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">취소</button>
          <button onClick={handleSave} className="px-5 py-2.5 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors">
            {editingErp ? '수정' : '등록'}
          </button>
        </div>
      </Modal>

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="ERP 삭제"
        message={`"${deleteTarget?.product_name}"을(를) 삭제하시겠습니까?`}
        confirmText="삭제"
        variant="danger"
      />
    </div>
  )
}
