// 브랜치Q 안내 메뉴얼(가이드) 데이터 레이어
// - 가이드는 Supabase 테이블 `branchq_guides`(steps는 JSONB)에 저장, 실패 시 localStorage 폴백
// - 이미지/영상은 Supabase Storage 버킷 `branchq-media`에 업로드, 실패 시 dataURL 폴백(데모용)
import { supabase } from './supabase'

export interface GuideStep {
  title?: string
  body?: string
  image_url?: string
  video_url?: string
}
export interface BranchQGuide {
  id: string
  title: string
  description?: string
  sort_order?: number
  steps: GuideStep[]
  updated_at?: string
}

const LS_KEY = 'branchq:guides'
const BUCKET = 'branchq-media'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()
const genId = () => { try { return crypto.randomUUID() } catch { return 'g_' + Math.random().toString(36).slice(2) + Date.now() } }

function lsLoad(): BranchQGuide[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function lsSaveAll(list: BranchQGuide[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch { /* 용량 초과 시 무시 */ }
}

const DEV_MOCK_GUIDES: BranchQGuide[] = [
  {
    id: 'guide-1', title: '브랜치Q 초기 안내 (담당자용)', description: 'POC 대상 고객에게 처음 연락할 때 전달·확인해야 할 사항', sort_order: 1,
    steps: [
      { title: '1. 인사 및 POC 목적 안내', body: '브랜치Q POC 대상으로 선정되었음을 안내하고, POC의 목적(실제 환경 검증)과 예상 일정(약 4주)을 설명합니다.' },
      { title: '2. 사전 환경 체크', body: '· ERP 종류/버전 확인\n· 서버 OS·DB 확인\n· 네트워크/방화벽 정책 확인\n위 3가지를 반드시 사전 확인하세요.' },
      { title: '3. 구축 일정 협의', body: '고객 가능 일정을 받아 구축예정일을 확정하고, POC 시스템 ‘구축여부’를 구축예정으로 변경합니다.' },
    ],
  },
  {
    id: 'guide-2', title: '구축 당일 점검 체크리스트', description: '구축 진행 당일 현장/원격에서 점검할 항목', sort_order: 2,
    steps: [
      { title: '1. 접속 및 권한 확인', body: '관리자 권한, 원격 접속 가능 여부를 먼저 확인합니다.' },
      { title: '2. 연계 테스트', body: 'ERP ↔ 브랜치Q 연계가 정상 동작하는지 샘플 데이터로 검증합니다.' },
      { title: '3. 완료 처리', body: '정상 확인 후 ‘구축여부’를 구축완료로 변경하고 구축일자를 기재합니다. 고객에게 완료 안내 메일을 발송합니다.' },
    ],
  },
]

// ── 가이드 CRUD ──
export async function loadGuides(): Promise<BranchQGuide[]> {
  try {
    const { data, error } = await supabase.from('branchq_guides').select('*').order('sort_order', { ascending: true })
    if (error) throw error
    if (data) return data.map((g: any) => ({ ...g, steps: Array.isArray(g.steps) ? g.steps : [] })) as BranchQGuide[]
  } catch { /* 폴백 */ }
  const local = lsLoad()
  if (local.length > 0) return local
  if (isDev) return DEV_MOCK_GUIDES
  return []
}

export async function getGuide(id: string): Promise<BranchQGuide | null> {
  return (await loadGuides()).find((g) => g.id === id) || null
}

export async function saveGuide(guide: BranchQGuide): Promise<BranchQGuide> {
  const payload = { ...guide, id: guide.id || genId(), updated_at: new Date().toISOString() }
  try {
    const { error } = await supabase.from('branchq_guides').upsert(payload, { onConflict: 'id' })
    if (error) throw error
    return payload
  } catch { /* 폴백 */ }
  const local = lsLoad()
  const idx = local.findIndex((g) => g.id === payload.id)
  if (idx >= 0) local[idx] = payload
  else local.push(payload)
  lsSaveAll(local)
  return payload
}

export async function deleteGuide(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('branchq_guides').delete().eq('id', id)
    if (!error) return
    throw error
  } catch { /* 폴백 */ }
  lsSaveAll(lsLoad().filter((g) => g.id !== id))
}

// ── 미디어 업로드 ──
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** 이미지/영상 업로드 → 공개 URL 반환. Storage 실패 시 dataURL(데모용) 폴백 */
export async function uploadMedia(file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]/g, '_')
  const path = `${new Date().getFullYear()}/${genId()}_${safe}`
  try {
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { cacheControl: '3600', upsert: false })
    if (error) throw error
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
    if (data?.publicUrl) return data.publicUrl
    throw new Error('publicUrl 없음')
  } catch {
    // 데모/오프라인: dataURL로 폴백 (영상은 용량이 크면 저장 실패할 수 있음)
    return fileToDataUrl(file)
  }
}
