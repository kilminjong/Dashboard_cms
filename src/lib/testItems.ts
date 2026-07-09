// 브랜치Q 테스트 진행 관리 데이터 레이어
// - 테스트 항목(순번·테스트항목)은 구글시트 '테스트항목' 탭에서 읽음 (Edge Function)
// - 담당자·진행여부·결과·신고 상태는 Supabase branchq_test_items에 저장 (seq 기준 병합)
import { supabase } from './supabase'

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets`
const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

export const TEST_STATUSES = ['대기', '진행중', '완료', '보류'] as const

export interface TestQuestion {
  seq: string        // 순번
  question: string   // 테스트 항목(점검 내용)
}

// 앱 관리 상태 (담당자·진행여부·결과·신고)
export interface TestItemState {
  seq: string
  poc_manager?: string
  status?: string
  result?: string
  report?: string
}

const norm = (s: string) => (s || '').replace(/\s/g, '')

// ── 테스트 항목 목록 (구글시트) ──
const DEV_MOCK_QUESTIONS: TestQuestion[] = [
  { seq: '1', question: '출금 리스트 AI 생성 결과가 원장 데이터와 일치하는지 확인' },
  { seq: '2', question: '보고서 PDF 다운로드 시 합계 금액 정합성 확인' },
  { seq: '3', question: '현황 조회 기준일자별 잔액이 CMS와 일치하는지 확인' },
  { seq: '4', question: 'ERP 연계 데이터 반영 지연 여부 점검' },
  { seq: '5', question: '엑셀 편집기 저장 후 재조회 시 값 유지 확인' },
]

export async function loadTestQuestions(): Promise<TestQuestion[]> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readTestQuestions' }),
    })
    const data = await res.json()
    if (Array.isArray(data.rows) && data.rows.length > 0) {
      const headers: string[] = data.headers || []
      const seqIdx = headers.findIndex((h) => /순번|번호|no\.?/i.test(norm(h)))
      const qIdx = headers.findIndex((h) => /테스트|항목|점검|질문|문항|내용/.test(norm(h)))
      const s = seqIdx >= 0 ? seqIdx : 0
      const q = qIdx >= 0 ? qIdx : 1
      return (data.rows as string[][])
        .map((r, i) => ({ seq: String(r[s] ?? (i + 1)).trim() || String(i + 1), question: String(r[q] ?? '').trim() }))
        .filter((x) => x.question)
    }
  } catch { /* 폴백 */ }
  if (isDev) return DEV_MOCK_QUESTIONS
  return []
}

// ── 앱 관리 상태 (Supabase) ──
const LS_KEY = 'branchq:testItems'
function lsLoad(): TestItemState[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function lsSaveAll(list: TestItemState[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

/** seq → 상태 맵 */
export async function loadTestItems(): Promise<Map<string, TestItemState>> {
  let list: TestItemState[] = []
  try {
    const { data, error } = await supabase.from('branchq_test_items').select('*')
    if (error) throw error
    if (data) list = data as TestItemState[]
    else list = lsLoad()
  } catch {
    list = lsLoad()
  }
  const m = new Map<string, TestItemState>()
  list.forEach((it) => m.set(String(it.seq), it))
  return m
}

/** 단건 상태 저장 (upsert) */
export async function upsertTestItem(item: TestItemState): Promise<void> {
  const payload = { ...item, seq: String(item.seq), updated_at: new Date().toISOString() }
  try {
    const { error } = await supabase.from('branchq_test_items').upsert(payload, { onConflict: 'seq' })
    if (error) throw error
    return
  } catch { /* 폴백 */ }
  const local = lsLoad()
  const idx = local.findIndex((r) => String(r.seq) === String(item.seq))
  if (idx >= 0) local[idx] = { ...local[idx], ...payload }
  else local.push(payload)
  lsSaveAll(local)
}

/** 여러 순번에 담당자 일괄 지정 */
export async function bulkAssignManager(seqs: string[], manager: string, current: Map<string, TestItemState>): Promise<void> {
  const rows = seqs.map((seq) => ({ ...(current.get(seq) || {}), seq: String(seq), poc_manager: manager, updated_at: new Date().toISOString() }))
  try {
    const { error } = await supabase.from('branchq_test_items').upsert(rows, { onConflict: 'seq' })
    if (error) throw error
    return
  } catch { /* 폴백 */ }
  const local = lsLoad()
  rows.forEach((row) => {
    const idx = local.findIndex((r) => String(r.seq) === String(row.seq))
    if (idx >= 0) local[idx] = { ...local[idx], ...row }
    else local.push(row)
  })
  lsSaveAll(local)
}

/** 진행여부 뱃지 색상 */
export function testStatusTone(status?: string): string {
  switch (status) {
    case '완료': return 'bg-emerald-100 text-emerald-700'
    case '진행중': return 'bg-blue-100 text-blue-700'
    case '보류': return 'bg-amber-100 text-amber-700'
    default: return 'bg-gray-100 text-gray-500' // 대기/미지정
  }
}
