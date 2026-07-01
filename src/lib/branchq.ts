// 브랜치Q POC 고객관리 데이터 레이어
// - 구축여부/구축일자는 구글시트(BM/BN)에서 "읽기"로 가져옴 (googleSheets.ts)
// - 앱에서 입력/관리하는 값(POC 선정 여부, 상태 override, 컨택일, VOC, 메모)은
//   Supabase 테이블 `branchq_poc`에 저장. 실패 시(오프라인/로컬) localStorage로 자동 폴백.
import { supabase } from './supabase'

export const BUILD_STATUSES = ['구축완료', '구축예정', '구축보류', '구축대기'] as const
export type BuildStatus = (typeof BUILD_STATUSES)[number]

export const VOC_TYPES = ['문의', '불만', '요청', '칭찬', '기타'] as const
export type VocType = (typeof VOC_TYPES)[number]

export interface BranchQVoc {
  id: string
  customer_number: string
  customer_name?: string
  voc_date: string      // YYYY-MM-DD
  voc_type: string      // 문의/불만/요청/칭찬/기타
  content: string
  author?: string       // 작성자 (이름)
  created_at?: string
}

export interface BranchQRecord {
  customer_number: string   // 키 (고객번호)
  management_code?: string
  customer_name?: string
  business_number?: string
  build_status?: string     // 구축여부 (앱 관리값; 없으면 시트값 사용)
  build_date?: string       // 구축일자 (앱 관리값; 없으면 시트값 사용)
  contact_date?: string     // 최근 컨택일
  inquiry?: string          // 고객별 문의사항
  special_notes?: string    // 특이사항
  guidance?: string         // 안내사항
  memo?: string             // 메모
  updated_at?: string
}

const LS_KEY = 'branchq:records'

// ── localStorage 폴백 ──
function lsLoad(): BranchQRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}
function lsSaveAll(records: BranchQRecord[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(records)) } catch { /* ignore */ }
}

// ── 데모용 샘플 (DEV 환경에서 백엔드가 비어있을 때만 사용) ──
export const DEV_MOCK_CUSTOMERS: any[] = [
  { id: 'gs_d1', _rowIndex: 9001, management_code: '25001', customer_name: '(주)가나상사', customer_number: '0012345', business_number: '1018212345', manager: '김담당', branchq_status: '구축완료', branchq_date: '2026-05-12' },
  { id: 'gs_d2', _rowIndex: 9002, management_code: '25002', customer_name: '대한물산(주)', customer_number: '0023456', business_number: '2208298765', manager: '이담당', branchq_status: '구축예정', branchq_date: '2026-07-10' },
  { id: 'gs_d3', _rowIndex: 9003, management_code: '25003', customer_name: '서울테크', customer_number: '0034567', business_number: '3056733210', manager: '박담당', branchq_status: '구축대기' },
  { id: 'gs_d4', _rowIndex: 9004, management_code: '25004', customer_name: '한빛유통', customer_number: '0045678', business_number: '4129955667', manager: '김담당', branchq_status: '구축보류' },
  { id: 'gs_d5', _rowIndex: 9005, management_code: '25005', customer_name: '미래에프앤비', customer_number: '0056789', business_number: '5078811223', manager: '최담당' },
  { id: 'gs_d6', _rowIndex: 9006, management_code: '25006', customer_name: '코스모스산업', customer_number: '0067890', business_number: '6201744556', manager: '이담당' },
]

const DEV_MOCK_RECORDS: BranchQRecord[] = [
  { customer_number: '0012345', management_code: '25001', customer_name: '(주)가나상사', business_number: '1018212345', build_status: '구축완료', build_date: '2026-05-12', contact_date: '2026-06-20', inquiry: '대시보드 메뉴 구성 문의', special_notes: '기존 ERP 연동 이슈 있었으나 해결됨', guidance: '구축 완료 안내 메일 발송 완료', memo: '추가 교육 일정 협의 예정' },
  { customer_number: '0023456', management_code: '25002', customer_name: '대한물산(주)', business_number: '2208298765', build_status: '구축예정', build_date: '2026-07-10', contact_date: '2026-06-25', inquiry: '구축 일정 단축 가능 여부', special_notes: '담당자 변경됨(7월 신규)', guidance: '사전 환경 점검 안내 필요' },
  { customer_number: '0034567', management_code: '25003', customer_name: '서울테크', business_number: '3056733210', build_status: '구축대기', contact_date: '2026-06-18', inquiry: '', special_notes: 'POC 참여 확정, 자료 검토 중', guidance: '' },
  { customer_number: '0045678', management_code: '25004', customer_name: '한빛유통', business_number: '4129955667', build_status: '구축보류', contact_date: '2026-06-10', special_notes: '내부 예산 검토로 일시 보류', guidance: '재개 시 재안내 예정' },
]

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

// ── 공개 API ──

/** POC 레코드 전체 조회 (Supabase → 실패 시 localStorage → DEV는 샘플) */
export async function loadBranchqRecords(): Promise<BranchQRecord[]> {
  try {
    const { data, error } = await supabase.from('branchq_poc').select('*').order('updated_at', { ascending: false })
    if (error) throw error
    if (data) return data as BranchQRecord[]
  } catch { /* 폴백 진행 */ }

  const local = lsLoad()
  if (local.length > 0) return local
  if (isDev) return DEV_MOCK_RECORDS
  return []
}

/** POC 레코드 추가/수정 (upsert) */
export async function upsertBranchqRecord(rec: BranchQRecord): Promise<void> {
  const payload = { ...rec, updated_at: new Date().toISOString() }
  try {
    const { error } = await supabase.from('branchq_poc').upsert(payload, { onConflict: 'customer_number' })
    if (error) throw error
    return
  } catch { /* 폴백 진행 */ }

  const local = lsLoad()
  const idx = local.findIndex((r) => r.customer_number === rec.customer_number)
  if (idx >= 0) local[idx] = { ...local[idx], ...payload }
  else local.push(payload)
  lsSaveAll(local)
}

/** POC 대상에서 제거 */
export async function removeBranchqRecord(customerNumber: string): Promise<void> {
  try {
    const { error } = await supabase.from('branchq_poc').delete().eq('customer_number', customerNumber)
    if (error) throw error
    return
  } catch { /* 폴백 진행 */ }

  lsSaveAll(lsLoad().filter((r) => r.customer_number !== customerNumber))
}

// ── VOC 로그 ──
const VOC_LS_KEY = 'branchq:voc'
function vocLsLoad(): BranchQVoc[] {
  try { return JSON.parse(localStorage.getItem(VOC_LS_KEY) || '[]') } catch { return [] }
}
function vocLsSaveAll(list: BranchQVoc[]) {
  try { localStorage.setItem(VOC_LS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}
const genId = () => { try { return crypto.randomUUID() } catch { return 'voc_' + Math.random().toString(36).slice(2) + Date.now() } }

const DEV_MOCK_VOC: BranchQVoc[] = [
  { id: 'v1', customer_number: '0012345', customer_name: '(주)가나상사', voc_date: '2026-06-20', voc_type: '칭찬', content: '구축 진행이 빠르고 담당자 응대가 친절하다는 피드백.', author: '김담당' },
  { id: 'v2', customer_number: '0012345', customer_name: '(주)가나상사', voc_date: '2026-06-12', voc_type: '문의', content: '대시보드 사용자 추가 방법 문의 → 매뉴얼 안내 완료.', author: '김담당' },
  { id: 'v3', customer_number: '0023456', customer_name: '대한물산(주)', voc_date: '2026-06-25', voc_type: '요청', content: '구축 일정을 7월 초로 앞당겨 달라는 요청.', author: '이담당' },
  { id: 'v4', customer_number: '0045678', customer_name: '한빛유통', voc_date: '2026-06-10', voc_type: '불만', content: '예산 검토 지연으로 진행이 멈춰 답답하다는 의견.', author: '박담당' },
]

/** 전체 VOC 조회 (최신순) */
export async function loadAllVoc(): Promise<BranchQVoc[]> {
  try {
    const { data, error } = await supabase.from('branchq_voc').select('*').order('voc_date', { ascending: false })
    if (error) throw error
    if (data) return data as BranchQVoc[]
  } catch { /* 폴백 */ }
  const local = vocLsLoad()
  if (local.length > 0) return local.sort((a, b) => (a.voc_date < b.voc_date ? 1 : -1))
  if (isDev) return DEV_MOCK_VOC
  return []
}

/** 특정 고객 VOC 조회 */
export async function loadVocByCustomer(customerNumber: string): Promise<BranchQVoc[]> {
  return (await loadAllVoc()).filter((v) => String(v.customer_number) === String(customerNumber))
}

/** VOC 추가 */
export async function addVoc(voc: Omit<BranchQVoc, 'id'>): Promise<void> {
  const payload: BranchQVoc = { ...voc, id: genId(), created_at: new Date().toISOString() }
  try {
    const { error } = await supabase.from('branchq_voc').insert({ customer_number: voc.customer_number, customer_name: voc.customer_name, voc_date: voc.voc_date, voc_type: voc.voc_type, content: voc.content, author: voc.author })
    if (!error) return
    throw error
  } catch { /* 폴백 */ }
  const local = vocLsLoad()
  local.push(payload)
  vocLsSaveAll(local)
}

/** VOC 삭제 */
export async function deleteVoc(id: string): Promise<void> {
  try {
    const { error } = await supabase.from('branchq_voc').delete().eq('id', id)
    if (!error) return
    throw error
  } catch { /* 폴백 */ }
  vocLsSaveAll(vocLsLoad().filter((v) => v.id !== id))
}

/** 특정 고객의 VOC 전체 삭제 (POC 제외 시 사용) */
export async function deleteVocByCustomer(customerNumber: string): Promise<void> {
  try {
    const { error } = await supabase.from('branchq_voc').delete().eq('customer_number', customerNumber)
    if (!error) return
    throw error
  } catch { /* 폴백 */ }
  vocLsSaveAll(vocLsLoad().filter((v) => String(v.customer_number) !== String(customerNumber)))
}

/** VOC 유형 뱃지 색상 */
export function vocTone(type?: string): string {
  switch (type) {
    case '문의': return 'bg-blue-100 text-blue-700'
    case '불만': return 'bg-red-100 text-red-700'
    case '요청': return 'bg-amber-100 text-amber-700'
    case '칭찬': return 'bg-emerald-100 text-emerald-700'
    default: return 'bg-gray-100 text-gray-600'
  }
}

/** 구축여부 뱃지 색상 */
export function statusTone(status?: string): string {
  switch (status) {
    case '구축완료': return 'bg-emerald-100 text-emerald-700'
    case '구축예정': return 'bg-blue-100 text-blue-700'
    case '구축보류': return 'bg-amber-100 text-amber-700'
    case '구축대기': return 'bg-gray-100 text-gray-600'
    default: return 'bg-gray-50 text-gray-400'
  }
}
