import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadGuides, saveGuide, deleteGuide, type BranchQGuide } from '../lib/branchqGuides'
import { BookOpen, Plus, Trash2, ChevronRight, RefreshCw, Image as ImageIcon, Film, ListChecks, ArrowUp, ArrowDown } from 'lucide-react'

export default function BranchQGuides() {
  const navigate = useNavigate()
  const [guides, setGuides] = useState<BranchQGuide[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => { setGuides(await loadGuides()); setLoading(false) }
  useEffect(() => { load() }, [])

  const createGuide = async () => {
    const g = await saveGuide({ id: '', title: '새 안내 가이드', description: '', sort_order: guides.length + 1, steps: [{ title: '1단계', body: '' }] })
    navigate(`/branchq/guides/${g.id}?edit=1`)
  }

  const remove = async (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation()
    if (!confirm(`'${title}' 가이드를 삭제하시겠습니까?`)) return
    await deleteGuide(id)
    load()
  }

  // 가이드 카드 순서 변경
  const moveGuide = async (e: React.MouseEvent, idx: number, dir: -1 | 1) => {
    e.stopPropagation()
    const j = idx + dir
    if (j < 0 || j >= guides.length) return
    const arr = [...guides]
    const t = arr[idx]; arr[idx] = arr[j]; arr[j] = t
    setGuides(arr) // 즉시 반영(낙관적)
    await Promise.all(arr.map((g, i) => (g.sort_order !== i + 1 ? saveGuide({ ...g, sort_order: i + 1 }) : null)).filter(Boolean) as Promise<unknown>[])
    load()
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><BookOpen size={17} className="text-emerald-600" /></span>
            <h2 className="text-2xl font-bold text-gray-800">고객 안내 메뉴얼</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">담당자·지원 인력이 고객에게 안내·점검해야 할 사항을 단계별 가이드로 제공합니다.</p>
        </div>
        <button onClick={createGuide} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm shrink-0">
          <Plus size={15} /> 새 가이드
        </button>
      </div>

      {guides.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <BookOpen size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-3">아직 등록된 가이드가 없습니다.</p>
          <button onClick={createGuide} className="inline-flex items-center gap-1.5 text-emerald-600 text-sm hover:underline"><Plus size={14} /> 첫 가이드 만들기</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {guides.map((g) => {
            const firstImg = g.steps.find((s) => s.image_url)?.image_url
            const hasVideo = g.steps.some((s) => s.video_url)
            return (
              <div key={g.id} onClick={() => navigate(`/branchq/guides/${g.id}`)}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden cursor-pointer hover:shadow-md hover:border-emerald-200 transition group">
                <div className="h-32 bg-gradient-to-br from-emerald-50 to-slate-50 grid place-items-center overflow-hidden">
                  {firstImg ? <img src={firstImg} alt="" className="w-full h-full object-cover" /> : <BookOpen size={32} className="text-emerald-200" />}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-gray-800 group-hover:text-emerald-700 line-clamp-1">{g.title}</h3>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button onClick={(e) => moveGuide(e, guides.indexOf(g), -1)} className="p-1 text-gray-300 hover:text-gray-600" title="위로"><ArrowUp size={13} /></button>
                      <button onClick={(e) => moveGuide(e, guides.indexOf(g), 1)} className="p-1 text-gray-300 hover:text-gray-600" title="아래로"><ArrowDown size={13} /></button>
                      <button onClick={(e) => remove(e, g.id, g.title)} className="p-1 text-gray-300 hover:text-red-500" title="삭제"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1 line-clamp-2 min-h-[2rem]">{g.description || '설명 없음'}</p>
                  <div className="flex items-center gap-3 mt-3 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1"><ListChecks size={12} /> {g.steps.length}단계</span>
                    {firstImg && <span className="flex items-center gap-1"><ImageIcon size={12} /> 이미지</span>}
                    {hasVideo && <span className="flex items-center gap-1"><Film size={12} /> 영상</span>}
                    <ChevronRight size={14} className="ml-auto text-gray-300 group-hover:text-emerald-500" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
