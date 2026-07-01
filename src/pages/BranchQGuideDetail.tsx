import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getGuide, saveGuide, uploadMedia, type BranchQGuide, type GuideStep } from '../lib/branchqGuides'
import { ChevronLeft, Pencil, Save, X, RefreshCw, Plus, Trash2, ArrowUp, ArrowDown, Image as ImageIcon, Upload } from 'lucide-react'

export default function BranchQGuideDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  const [guide, setGuide] = useState<BranchQGuide | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(sp.get('edit') === '1')
  const [saving, setSaving] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [steps, setSteps] = useState<GuideStep[]>([])
  const [uploading, setUploading] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const targetRef = useRef<{ idx: number; kind: 'image' | 'video' } | null>(null)

  const load = async () => {
    setLoading(true)
    const g = await getGuide(id || '')
    setGuide(g)
    if (g) { setTitle(g.title); setDescription(g.description || ''); setSteps(g.steps.length ? g.steps : [{ title: '1단계', body: '' }]) }
    setLoading(false)
  }
  useEffect(() => { load() }, [id])

  const setStep = (idx: number, patch: Partial<GuideStep>) => setSteps((ss) => ss.map((s, i) => (i === idx ? { ...s, ...patch } : s)))
  const addStep = () => setSteps((ss) => [...ss, { title: `${ss.length + 1}단계`, body: '' }])
  const removeStep = (idx: number) => setSteps((ss) => ss.filter((_, i) => i !== idx))
  const moveStep = (idx: number, dir: -1 | 1) => setSteps((ss) => {
    const j = idx + dir
    if (j < 0 || j >= ss.length) return ss
    const next = [...ss]; const t = next[idx]; next[idx] = next[j]; next[j] = t; return next
  })

  const pickFile = (idx: number, kind: 'image' | 'video') => {
    targetRef.current = { idx, kind }
    if (fileRef.current) { fileRef.current.accept = kind === 'image' ? 'image/*' : 'video/*'; fileRef.current.value = ''; fileRef.current.click() }
  }
  const MAX_IMAGE_MB = 10
  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; const tgt = targetRef.current
    if (!file || !tgt) return
    // 형식·용량 제한 (현재 이미지 업로드만 지원)
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드할 수 있습니다. (jpg, png, gif 등)'); return }
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) { alert(`이미지는 ${MAX_IMAGE_MB}MB 이하만 업로드할 수 있습니다.`); return }
    setUploading(tgt.idx)
    try {
      const url = await uploadMedia(file)
      setStep(tgt.idx, tgt.kind === 'image' ? { image_url: url } : { video_url: url })
    } catch (err) { alert('업로드 실패: ' + String((err as any)?.message || err)) }
    finally { setUploading(null) }
  }

  const save = async () => {
    if (!guide) return
    if (!title.trim()) { alert('가이드 제목을 입력해주세요.'); return }
    setSaving(true)
    try {
      await saveGuide({ ...guide, title: title.trim(), description: description.trim(), steps })
      await load()
      setEditing(false)
    } catch (e) { alert('저장 실패: ' + String((e as any)?.message || e)) }
    finally { setSaving(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>
  if (!guide) return (
    <div className="text-center py-16">
      <p className="text-gray-400 mb-3">가이드를 찾을 수 없습니다.</p>
      <button onClick={() => navigate('/branchq/guides')} className="text-emerald-600 text-sm hover:underline">목록으로</button>
    </div>
  )

  return (
    <div className="max-w-3xl mx-auto">
      {/* 상단 바 */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button onClick={() => navigate('/branchq/guides')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"><ChevronLeft size={16} /> 메뉴얼 목록</button>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm"><Pencil size={14} /> 편집</button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => { setEditing(false); load() }} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm"><X size={14} /> 취소</button>
            <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm disabled:opacity-50"><Save size={14} /> {saving ? '저장 중…' : '저장'}</button>
          </div>
        )}
      </div>

      {/* 제목/설명 */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
        {!editing ? (
          <>
            <h1 className="text-2xl font-bold text-gray-800">{guide.title}</h1>
            {guide.description && <p className="text-sm text-gray-500 mt-2 whitespace-pre-wrap leading-relaxed">{guide.description}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">가이드 제목</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-base font-semibold outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">설명</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="이 가이드의 목적·대상을 적어주세요." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
        )}
      </div>

      {/* 단계 */}
      <div className="space-y-4">
        {steps.map((s, idx) => (
          <div key={idx} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* 단계 헤더 */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/50">
              <span className="w-7 h-7 rounded-full bg-emerald-600 text-white grid place-items-center text-sm font-bold shrink-0">{idx + 1}</span>
              {!editing ? (
                <h3 className="font-bold text-gray-800">{s.title || `${idx + 1}단계`}</h3>
              ) : (
                <input value={s.title || ''} onChange={(e) => setStep(idx, { title: e.target.value })} placeholder={`${idx + 1}단계 제목`} className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm font-semibold outline-none focus:ring-2 focus:ring-emerald-500" />
              )}
              {editing && (
                <div className="flex items-center gap-0.5 ml-auto shrink-0">
                  <button onClick={() => moveStep(idx, -1)} disabled={idx === 0} className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="위로"><ArrowUp size={14} /></button>
                  <button onClick={() => moveStep(idx, 1)} disabled={idx === steps.length - 1} className="p-1.5 text-gray-400 hover:text-gray-700 disabled:opacity-30" title="아래로"><ArrowDown size={14} /></button>
                  <button onClick={() => removeStep(idx)} className="p-1.5 text-gray-400 hover:text-red-500" title="단계 삭제"><Trash2 size={14} /></button>
                </div>
              )}
            </div>

            <div className="p-4 space-y-3">
              {/* 본문 */}
              {!editing ? (
                s.body ? <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{s.body}</p> : null
              ) : (
                <textarea value={s.body || ''} onChange={(e) => setStep(idx, { body: e.target.value })} rows={3} placeholder="이 단계에서 안내·확인할 내용을 적어주세요." className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none outline-none focus:ring-2 focus:ring-emerald-500" />
              )}

              {/* 이미지 */}
              {s.image_url && <img src={s.image_url} alt="" className="rounded-xl border border-gray-100 max-h-96 w-auto" />}
              {/* 영상 */}
              {s.video_url && <video src={s.video_url} controls className="rounded-xl border border-gray-100 w-full max-h-96 bg-black" />}

              {/* 편집: 이미지 버튼 (영상은 현재 업로드 미지원 — 필요 시 담당자에게 요청) */}
              {editing && (
                <div className="flex items-center gap-2 flex-wrap pt-1">
                  <button onClick={() => pickFile(idx, 'image')} disabled={uploading === idx} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                    <ImageIcon size={13} /> {s.image_url ? '이미지 교체' : '이미지 추가'}
                  </button>
                  {s.image_url && <button onClick={() => setStep(idx, { image_url: '' })} className="text-xs text-gray-400 hover:text-red-500">이미지 삭제</button>}
                  {uploading === idx && <span className="flex items-center gap-1 text-xs text-emerald-600"><Upload size={12} className="animate-pulse" /> 업로드 중…</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {editing && (
          <button onClick={addStep} className="w-full flex items-center justify-center gap-1.5 py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-500 hover:border-emerald-300 hover:text-emerald-600 transition">
            <Plus size={15} /> 단계 추가
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
    </div>
  )
}
