import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { fetchCustomers, updateBranchqInSheet } from '../lib/googleSheets'
import { loadBranchqRecords, upsertBranchqRecord, statusTone, BUILD_STATUSES, DEV_MOCK_CUSTOMERS, loadVocByCustomer, addVoc, deleteVoc, vocTone, VOC_TYPES, getNotes, NOTES_TEMPLATE, type BranchQRecord, type BranchQVoc } from '../lib/branchq'
import { useAuth } from '../hooks/useAuth'
import { ChevronLeft, Pencil, Save, X, RefreshCw, Phone, ClipboardList, StickyNote, CalendarDays, MessageSquareText, Plus, Trash2, CheckCircle2, Lightbulb } from 'lucide-react'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

const emptyForm = (): BranchQRecord => ({ customer_number: '', build_status: '구축대기', build_date: '', contact_date: '', notes: '', memo: '' })

export default function BranchQDetail() {
  const { id } = useParams<{ id: string }>()
  const customerNumber = decodeURIComponent(id || '')
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [toast, setToast] = useState('')
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2400) }
  const [master, setMaster] = useState<any | null>(null)
  const [rec, setRec] = useState<BranchQRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BranchQRecord>(emptyForm())
  const [vocList, setVocList] = useState<BranchQVoc[]>([])
  const todayStr = (() => { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` })()
  const [vocForm, setVocForm] = useState({ voc_date: todayStr, voc_type: '문의', content: '' })
  const [vocSaving, setVocSaving] = useState(false)

  const load = async () => {
    setLoading(true)
    let cust: any[] = []
    try { cust = await fetchCustomers() } catch { /* 오프라인 */ }
    if ((!cust || cust.length === 0) && isDev) cust = DEV_MOCK_CUSTOMERS
    const m = (cust || []).find((c) => String(c.customer_number) === customerNumber) || null
    setMaster(m)
    const records = await loadBranchqRecords()
    const r = records.find((x) => String(x.customer_number) === customerNumber) || null
    setRec(r)
    setVocList(await loadVocByCustomer(customerNumber))
    setLoading(false)
  }
  useEffect(() => { load() }, [customerNumber])

  const submitVoc = async () => {
    if (!vocForm.content.trim()) { alert('VOC 내용을 입력해주세요.'); return }
    setVocSaving(true)
    try {
      await addVoc({ customer_number: customerNumber, customer_name: view.customer_name !== '-' ? view.customer_name : undefined, voc_date: vocForm.voc_date, voc_type: vocForm.voc_type, content: vocForm.content.trim(), author: profile?.name || undefined })
      setVocForm({ voc_date: todayStr, voc_type: '문의', content: '' })
      setVocList(await loadVocByCustomer(customerNumber))
      showToast('VOC가 등록되었습니다.')
    } finally { setVocSaving(false) }
  }
  const removeVoc = async (id: string) => {
    if (!confirm('이 VOC를 삭제하시겠습니까?')) return
    await deleteVoc(id)
    setVocList(await loadVocByCustomer(customerNumber))
  }

  // 표시값: 앱 관리값(rec) 우선, 없으면 시트값(master)
  const view = useMemo(() => ({
    customer_name: rec?.customer_name || master?.customer_name || '-',
    customer_number: customerNumber,
    business_number: rec?.business_number || master?.business_number || '-',
    management_code: rec?.management_code || master?.management_code || '-',
    manager: master?.manager || '-',
    build_status: rec?.build_status || master?.branchq_status || '구축대기',
    build_date: rec?.build_date || master?.branchq_date || '',
    contact_date: rec?.contact_date || '',
    notes: getNotes(rec),
    memo: rec?.memo || '',
  }), [rec, master, customerNumber])

  const startEdit = () => {
    setForm({
      customer_number: customerNumber,
      management_code: view.management_code !== '-' ? view.management_code : '',
      customer_name: view.customer_name !== '-' ? view.customer_name : '',
      business_number: view.business_number !== '-' ? view.business_number : '',
      build_status: view.build_status,
      build_date: view.build_date,
      contact_date: view.contact_date,
      notes: view.notes || NOTES_TEMPLATE,   // 비어 있으면 예시 양식을 채워 담당자가 보고 작성
      memo: view.memo,
    })
    setEditing(true)
  }

  const save = async () => {
    // 구축완료인데 구축일자가 없으면 확인
    if (form.build_status === '구축완료' && !form.build_date) {
      if (!confirm('구축여부가 ‘구축완료’인데 구축일자가 비어 있습니다.\n이대로 저장하시겠습니까? (구축일자 입력을 권장합니다)')) return
    }
    setSaving(true)
    try {
      await upsertBranchqRecord(form)
      // 구축여부/구축일자를 구글시트(브랜치Q 컬럼)에 반영 — 원본 행 정보가 있을 때만 시도
      let sheetMsg = ''
      let sheetFailed = ''
      if (master && Array.isArray(master._raw)) {
        try {
          await updateBranchqInSheet(master, form.build_status || '', form.build_date || '')
          sheetMsg = ' · 구글시트 반영됨'
        } catch (err) {
          sheetFailed = '\n\n단, 구글시트 반영은 실패했습니다:\n' + String((err as any)?.message || err)
        }
      }
      await load()
      setEditing(false)
      if (sheetFailed) alert('앱에는 저장되었습니다.' + sheetFailed)
      else showToast('저장되었습니다.' + sheetMsg)
    } catch (e) {
      alert('저장 실패: ' + String((e as any)?.message || e))
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  const set = (k: keyof BranchQRecord, v: string) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="max-w-4xl mx-auto">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button onClick={() => navigate('/branchq')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft size={16} /> 목록</button>
        {!editing ? (
          <button onClick={startEdit} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm"><Pencil size={14} /> 수정</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"><X size={14} /> 취소</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"><Save size={14} /> {saving ? '저장 중…' : '저장'}</button>
          </div>
        )}
      </div>

      {/* 헤더 카드 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-800">{view.customer_name}</h2>
              {!editing ? (
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusTone(view.build_status)}`}>{view.build_status}</span>
              ) : (
                <select value={form.build_status} onChange={(e) => set('build_status', e.target.value)} className="px-2.5 py-1 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500">
                  {BUILD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {([['고객번호', view.customer_number], ['사업자번호', view.business_number], ['관리코드', view.management_code], ['담당자', view.manager]] as [string, string][]).map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1.5 text-xs bg-gray-50 rounded-lg px-2.5 py-1"><span className="text-gray-400 text-[11px] font-semibold">{k}</span><span className="text-gray-800 font-bold tabular-nums">{v || '-'}</span></span>
              ))}
            </div>
          </div>
          {/* 구축일자 */}
          <div className="text-right shrink-0">
            <p className="text-[11px] text-gray-400 font-semibold mb-1">브랜치Q 구축일자</p>
            {!editing ? (
              <p className="text-lg font-bold text-gray-800 tabular-nums">{view.build_date || '-'}</p>
            ) : (
              <input type="date" value={form.build_date || ''} onChange={(e) => set('build_date', e.target.value)} className="px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            )}
          </div>
        </div>
      </div>

      {/* 컨택일 · 메모 (한눈에) */}
      <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 mb-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2"><CalendarDays size={14} className="text-emerald-600" /><p className="text-xs font-bold text-gray-500">최근 컨택일</p></div>
          {!editing ? (
            <p className="text-xl font-bold text-gray-800 tabular-nums">{view.contact_date || '-'}</p>
          ) : (
            <input type="date" value={form.contact_date || ''} onChange={(e) => set('contact_date', e.target.value)} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
          )}
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-1.5 mb-2"><StickyNote size={14} className="text-amber-500" /><p className="text-xs font-bold text-gray-500">메모</p></div>
          {!editing ? (
            <p className={`text-sm whitespace-pre-wrap ${view.memo ? 'text-gray-700' : 'text-gray-300'}`}>{view.memo || '메모가 없습니다.'}</p>
          ) : (
            <textarea value={form.memo || ''} onChange={(e) => set('memo', e.target.value)} rows={2} placeholder="빠른 메모를 입력하세요." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-emerald-500" />
          )}
        </div>
      </div>

      {/* 고객 안내사항 및 문의사항 (통합) */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="w-6 h-6 rounded-lg grid place-items-center bg-emerald-50"><ClipboardList size={13} className="text-emerald-600" /></span>
          <h4 className="text-sm font-bold text-gray-800">고객 안내사항 및 문의사항</h4>
          {editing && (
            <button onClick={() => { if (!form.notes?.trim() || confirm('현재 내용을 예시 양식으로 교체할까요?')) set('notes', NOTES_TEMPLATE) }}
              className="ml-auto flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1 hover:bg-emerald-100">
              <Lightbulb size={12} /> 예시 양식 삽입
            </button>
          )}
        </div>
        <div className="p-4">
          {!editing ? (
            view.notes ? (
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{view.notes}</p>
            ) : (
              <p className="text-sm text-gray-300">기재된 내용이 없습니다. ‘수정’을 누르면 예시 양식이 표시됩니다.</p>
            )
          ) : (
            <textarea value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} rows={16}
              placeholder="고객 안내사항 및 문의사항을 입력하세요." className="w-full min-h-[360px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm leading-relaxed resize-y outline-none focus:ring-2 focus:ring-emerald-500 font-[inherit]" />
          )}
        </div>
      </div>

      {/* VOC 기록 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mt-4">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <span className="w-6 h-6 rounded-lg grid place-items-center bg-blue-50"><MessageSquareText size={13} className="text-blue-600" /></span>
          <h4 className="text-sm font-bold text-gray-800">VOC 기록</h4>
          <span className="text-xs text-gray-400">{vocList.length}건</span>
        </div>

        {/* 입력 폼 */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex flex-col sm:flex-row gap-2">
            <input type="date" value={vocForm.voc_date} onChange={(e) => setVocForm((f) => ({ ...f, voc_date: e.target.value }))}
              className="px-2.5 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 shrink-0" />
            <select value={vocForm.voc_type} onChange={(e) => setVocForm((f) => ({ ...f, voc_type: e.target.value }))}
              className="px-2.5 py-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-emerald-500 shrink-0">
              {VOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={vocForm.content} onChange={(e) => setVocForm((f) => ({ ...f, content: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter' && !vocSaving) submitVoc() }}
              placeholder="VOC 내용을 입력하고 Enter 또는 추가" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500" />
            <button onClick={submitVoc} disabled={vocSaving} className="flex items-center justify-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50 shrink-0"><Plus size={14} /> 추가</button>
          </div>
        </div>

        {/* 이력 */}
        <div className="divide-y divide-gray-50">
          {vocList.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-sm">아직 등록된 VOC가 없습니다.</p>
          ) : vocList.map((v) => (
            <div key={v.id} className="flex items-start gap-3 px-4 py-3 group">
              <span className="text-xs text-gray-400 tabular-nums w-24 shrink-0 pt-0.5">{v.voc_date}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${vocTone(v.voc_type)}`}>{v.voc_type}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{v.content}</p>
                {v.author && <p className="text-[11px] text-gray-400 mt-0.5">— {v.author}</p>}
              </div>
              <button onClick={() => removeVoc(v.id)} className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition shrink-0" title="삭제"><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      </div>

      {view.manager && view.manager !== '-' && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-gray-400"><Phone size={12} /> 내부 담당자: <b className="text-gray-600">{view.manager}</b></div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 text-white text-sm px-4 py-2.5 rounded-lg shadow-lg flex items-center gap-2">
          <CheckCircle2 size={15} className="text-emerald-400" /> {toast}
        </div>
      )}
    </div>
  )
}
