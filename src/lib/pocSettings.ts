// POC 시범사업 설정 (팀 공유 값)
// - poc_start_date: '시작' 버튼을 누른 날짜(YYYY-MM-DD). 이 날짜 기준으로 상세관리/대시보드 주차가 1주차부터 계산됨.
// - 저장: Supabase 테이블 branchq_settings(key,value) → 실패 시 localStorage 폴백
// - 복구: 잘못 눌렀을 때 resetPocStart() 또는 Supabase SQL Editor에서
//         delete from public.branchq_settings where key='poc_start_date';
import { supabase } from './supabase'

const KEY = 'poc_start_date'
const LS = 'branchq:pocStart'

/** POC 시작일 조회 (미시작이면 null) */
export async function getPocStart(): Promise<string | null> {
  try {
    const { data, error } = await supabase.from('branchq_settings').select('value').eq('key', KEY).maybeSingle()
    if (error) throw error
    const val = (data?.value as string) || null
    try { if (val) localStorage.setItem(LS, val); else localStorage.removeItem(LS) } catch { /* ignore */ }
    return val
  } catch {
    try { return localStorage.getItem(LS) } catch { return null }
  }
}

/** POC 시작 (오늘 날짜로 기록) */
export async function setPocStart(dateISO: string): Promise<void> {
  try {
    const { error } = await supabase.from('branchq_settings').upsert({ key: KEY, value: dateISO }, { onConflict: 'key' })
    if (error) throw error
  } catch { /* 폴백 진행 */ }
  try { localStorage.setItem(LS, dateISO) } catch { /* ignore */ }
}

/** POC 시작 취소/복구 (잘못 눌렀을 때) */
export async function resetPocStart(): Promise<void> {
  try { await supabase.from('branchq_settings').delete().eq('key', KEY) } catch { /* ignore */ }
  try { localStorage.removeItem(LS) } catch { /* ignore */ }
}
