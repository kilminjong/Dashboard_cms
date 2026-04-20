import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { Customer, CustomerStatus } from '@/types'
import { ALL_BRANCHES } from '@/types'
const STATUSES: CustomerStatus[] = ['완료', '진행', '대기', '해지']

interface CustomerFormProps {
  customer: Customer | null  // null이면 신규 등록
  onSave: () => void
  onCancel: () => void
}

interface ErpOption {
  id: string
  product_name: string
  company_name: string
  manufacturer: string
}

export default function CustomerForm({ customer, onSave, onCancel }: CustomerFormProps) {
  const { user } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [erpOptions, setErpOptions] = useState<ErpOption[]>([])

  const [form, setForm] = useState({
    branch: customer?.branch ?? user?.branch ?? 'IBK',
    type: customer?.type ?? '',
    product: customer?.product ?? '',
    company_name: customer?.company_name ?? '',
    business_number: customer?.business_number ?? '',
    contract_date: customer?.contract_date ?? '',
    business_type: customer?.business_type ?? '',
    industry: customer?.industry ?? '',
    erp_type: customer?.erp_type ?? '',
    erp_company: customer?.erp_company ?? '',
    erp_manufacturer: customer?.erp_manufacturer ?? '',
    db_type: customer?.db_type ?? '',
    erp_link_date: customer?.erp_link_date ?? '',
    link_method: customer?.link_method ?? '',
    cancel_date: customer?.cancel_date ?? '',
    cancel_reason: customer?.cancel_reason ?? '',
    work_industry: customer?.work_industry ?? '',
    status: customer?.status ?? '대기' as CustomerStatus,
    open_date: customer?.open_date ?? '',
    consultant_main: customer?.consultant_main ?? '',
    consultant_sub: customer?.consultant_sub ?? '',
    revenue: customer?.revenue?.toString() ?? '',
    affiliate_count: customer?.affiliate_count?.toString() ?? '',
    account_count: customer?.account_count?.toString() ?? '',
    card_count: customer?.card_count?.toString() ?? '',
    notes: customer?.notes ?? '',
  })

  // ERP 마스터 데이터 로드
  useEffect(() => {
    const fetchErpMaster = async () => {
      const { data } = await supabase
        .from('erp_master')
        .select('id, product_name, company_name, manufacturer')
        .eq('is_active', true)
        .order('sort_order')
      if (data) setErpOptions(data)
    }
    fetchErpMaster()
  }, [])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))

    // ERP 종류 선택 시 업체/제조사 자동 채움
    if (field === 'erp_type') {
      const selected = erpOptions.find((e) => e.product_name === value)
      if (selected) {
        setForm((prev) => ({
          ...prev,
          erp_type: value,
          erp_company: selected.company_name,
          erp_manufacturer: selected.manufacturer,
        }))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      if (!form.company_name.trim()) {
        throw new Error('업체명은 필수 입력입니다.')
      }

      const payload = {
        branch: form.branch,
        type: form.type || null,
        product: form.product || null,
        company_name: form.company_name.trim(),
        business_number: form.business_number || null,
        contract_date: form.contract_date || null,
        business_type: form.business_type || null,
        industry: form.industry || null,
        erp_type: form.erp_type || null,
        erp_company: form.erp_company || null,
        erp_manufacturer: form.erp_manufacturer || null,
        db_type: form.db_type || null,
        erp_link_date: form.erp_link_date || null,
        link_method: form.link_method || null,
        cancel_date: form.cancel_date || null,
        cancel_reason: form.cancel_reason || null,
        work_industry: form.work_industry || null,
        status: form.status,
        open_date: form.open_date || null,
        consultant_main: form.consultant_main || null,
        consultant_sub: form.consultant_sub || null,
        revenue: form.revenue ? Number(form.revenue) : null,
        affiliate_count: form.affiliate_count ? Number(form.affiliate_count) : null,
        account_count: form.account_count ? Number(form.account_count) : null,
        card_count: form.card_count ? Number(form.card_count) : null,
        notes: form.notes || null,
      }

      if (customer) {
        // 수정
        const { error: updateError } = await supabase
          .from('customers')
          .update({ ...payload, updated_by: user?.id })
          .eq('id', customer.id)
        if (updateError) throw updateError
      } else {
        // 신규 등록
        const { error: insertError } = await supabase
          .from('customers')
          .insert({ ...payload, created_by: user?.id })
        if (insertError) throw insertError
      }

      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : '저장에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none"
  const labelClass = "block text-sm font-medium text-gray-700 mb-1"

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3 mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 브랜치 */}
        <div>
          <label className={labelClass}>브랜치 *</label>
          <select
            value={form.branch}
            onChange={(e) => handleChange('branch', e.target.value)}
            className={inputClass}
            disabled={user?.role !== 'SUPER_ADMIN'}
          >
            {ALL_BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* 상태 */}
        <div>
          <label className={labelClass}>상태 *</label>
          <select value={form.status} onChange={(e) => handleChange('status', e.target.value)} className={inputClass}>
            {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* 업체명 */}
        <div>
          <label className={labelClass}>업체명 *</label>
          <input type="text" value={form.company_name} onChange={(e) => handleChange('company_name', e.target.value)} className={inputClass} placeholder="업체명 입력" />
        </div>

        {/* 사업자번호 */}
        <div>
          <label className={labelClass}>사업자번호</label>
          <input type="text" value={form.business_number} onChange={(e) => handleChange('business_number', e.target.value)} className={inputClass} placeholder="000-00-00000" />
        </div>

        {/* 유형 */}
        <div>
          <label className={labelClass}>유형</label>
          <input type="text" value={form.type} onChange={(e) => handleChange('type', e.target.value)} className={inputClass} />
        </div>

        {/* 상품 */}
        <div>
          <label className={labelClass}>상품</label>
          <input type="text" value={form.product} onChange={(e) => handleChange('product', e.target.value)} className={inputClass} />
        </div>

        {/* 계약일자 */}
        <div>
          <label className={labelClass}>계약일자</label>
          <input type="date" value={form.contract_date} onChange={(e) => handleChange('contract_date', e.target.value)} className={inputClass} />
        </div>

        {/* 업태 */}
        <div>
          <label className={labelClass}>업태</label>
          <input type="text" value={form.business_type} onChange={(e) => handleChange('business_type', e.target.value)} className={inputClass} />
        </div>

        {/* 업종/주품목 */}
        <div>
          <label className={labelClass}>업종/주품목</label>
          <input type="text" value={form.industry} onChange={(e) => handleChange('industry', e.target.value)} className={inputClass} />
        </div>

        {/* ERP 종류 */}
        <div>
          <label className={labelClass}>ERP 종류(상품명)</label>
          <select value={form.erp_type} onChange={(e) => handleChange('erp_type', e.target.value)} className={inputClass}>
            <option value="">선택</option>
            {erpOptions.map((e) => <option key={e.id} value={e.product_name}>{e.product_name}</option>)}
          </select>
        </div>

        {/* ERP 업체 */}
        <div>
          <label className={labelClass}>ERP 업체</label>
          <input type="text" value={form.erp_company} onChange={(e) => handleChange('erp_company', e.target.value)} className={inputClass} />
        </div>

        {/* ERP 제조사 */}
        <div>
          <label className={labelClass}>ERP 제조사(쇼룸)</label>
          <input type="text" value={form.erp_manufacturer} onChange={(e) => handleChange('erp_manufacturer', e.target.value)} className={inputClass} />
        </div>

        {/* DB 종류 */}
        <div>
          <label className={labelClass}>DB 종류</label>
          <input type="text" value={form.db_type} onChange={(e) => handleChange('db_type', e.target.value)} className={inputClass} />
        </div>

        {/* ERP 연계일자 */}
        <div>
          <label className={labelClass}>ERP 연계일자</label>
          <input type="date" value={form.erp_link_date} onChange={(e) => handleChange('erp_link_date', e.target.value)} className={inputClass} />
        </div>

        {/* 연계방식 */}
        <div>
          <label className={labelClass}>연계방식</label>
          <input type="text" value={form.link_method} onChange={(e) => handleChange('link_method', e.target.value)} className={inputClass} />
        </div>

        {/* 해지일자 */}
        <div>
          <label className={labelClass}>해지일자</label>
          <input type="date" value={form.cancel_date} onChange={(e) => handleChange('cancel_date', e.target.value)} className={inputClass} />
        </div>

        {/* 업종(작업) */}
        <div>
          <label className={labelClass}>업종(작업)</label>
          <input type="text" value={form.work_industry} onChange={(e) => handleChange('work_industry', e.target.value)} className={inputClass} />
        </div>

        {/* 개설완료일자 */}
        <div>
          <label className={labelClass}>개설완료일자</label>
          <input type="date" value={form.open_date} onChange={(e) => handleChange('open_date', e.target.value)} className={inputClass} />
        </div>

        {/* 컨설턴트(주) */}
        <div>
          <label className={labelClass}>컨설턴트(주)</label>
          <input type="text" value={form.consultant_main} onChange={(e) => handleChange('consultant_main', e.target.value)} className={inputClass} />
        </div>

        {/* 컨설턴트(부) */}
        <div>
          <label className={labelClass}>컨설턴트(부)</label>
          <input type="text" value={form.consultant_sub} onChange={(e) => handleChange('consultant_sub', e.target.value)} className={inputClass} />
        </div>

        {/* 매출액 */}
        <div>
          <label className={labelClass}>매출액(백만)</label>
          <input type="number" value={form.revenue} onChange={(e) => handleChange('revenue', e.target.value)} className={inputClass} placeholder="0" />
        </div>

        {/* 계열사수 */}
        <div>
          <label className={labelClass}>계열사수</label>
          <input type="number" value={form.affiliate_count} onChange={(e) => handleChange('affiliate_count', e.target.value)} className={inputClass} placeholder="0" />
        </div>

        {/* 계좌수 */}
        <div>
          <label className={labelClass}>계좌수</label>
          <input type="number" value={form.account_count} onChange={(e) => handleChange('account_count', e.target.value)} className={inputClass} placeholder="0" />
        </div>

        {/* 카드수 */}
        <div>
          <label className={labelClass}>카드수</label>
          <input type="number" value={form.card_count} onChange={(e) => handleChange('card_count', e.target.value)} className={inputClass} placeholder="0" />
        </div>

        {/* 해지사유 */}
        <div className="md:col-span-2">
          <label className={labelClass}>해지사유</label>
          <textarea value={form.cancel_reason} onChange={(e) => handleChange('cancel_reason', e.target.value)} className={inputClass} rows={2} />
        </div>

        {/* 비고 */}
        <div className="md:col-span-2 lg:col-span-3">
          <label className={labelClass}>비고</label>
          <textarea value={form.notes} onChange={(e) => handleChange('notes', e.target.value)} className={inputClass} rows={3} placeholder="메모 입력" />
        </div>
      </div>

      {/* 버튼 */}
      <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
        <button type="button" onClick={onCancel} className="px-5 py-2.5 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
          취소
        </button>
        <button type="submit" disabled={isLoading} className="px-5 py-2.5 text-sm text-white bg-primary rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50">
          {isLoading ? '저장 중...' : customer ? '수정' : '등록'}
        </button>
      </div>
    </form>
  )
}
