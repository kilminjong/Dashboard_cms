// 구글폼 대시보드 데이터 레이어
// - 고객이 매주 구글폼에 응답하면 → 구글시트 'form_responses' 탭에 자동 누적됨
// - 이 레이어는 Edge Function(google-sheets)의 readFormResponses 액션으로 응답을 읽고,
//   {headers, rows} 원시값을 유연하게 파싱한다. (폼 문항이 바뀌어도 헤더 기준으로 자동 대응)
// - 실패 시(오프라인/로컬/폼 미연결) DEV 환경에서는 샘플 데이터로 폴백.
//
// ▸ 응답↔고객 매칭 키: 폼에 필수 문항 "사업자번호"(또는 응답자 이메일 수집)를 넣어야 함.

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets`

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

// 한 문항의 답변 (문항명 → 답변 텍스트)
export interface FormAnswer {
  question: string
  answer: string
}

// 구글폼 응답 1건 = 시트 1행
export interface FormResponse {
  id: string
  customer_number: string      // 매칭 키 (사업자번호 우선, 없으면 이메일/업체명)
  customer_name: string
  respondent_email: string
  submitted_at: string         // ISO datetime (제출 일시)
  answers: FormAnswer[]        // 문항별 답변 (신원 컬럼 제외)
  _rowIndex?: number
}

// 어떤 헤더를 "신원 컬럼"으로 볼지 (나머지는 전부 답변 문항으로 취급)
const IDENTITY_HINTS = {
  timestamp: ['타임스탬프', 'timestamp', '제출', '응답시간'],
  email: ['이메일', 'email', '메일주소', '전자우편'],
  name: ['업체', '고객명', '회사', '기업', '상호', '거래처'],
  bizNumber: ['사업자', '사업자번호', '사업자등록'],
}

const norm = (s: string) => (s || '').replace(/[\s\u200B\u00A0\n\r\t]/g, '').toLowerCase()
const headerMatches = (header: string, hints: string[]) => {
  const h = norm(header)
  return hints.some((k) => h.includes(norm(k)))
}

// 구글시트 타임스탬프 문자열 → ISO. ("2026. 7. 6 오후 3:24:10", "2026-07-06 15:24" 등 관대하게 처리)
export function parseTimestamp(raw: string): string {
  if (!raw) return ''
  const s = String(raw).trim()
  // 이미 ISO면 그대로
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s
  // 한국어 오전/오후 처리
  const krMatch = s.match(/(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\s*(오전|오후)?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/)
  if (krMatch) {
    const [, y, mo, d, ampm, hh, mi, ss] = krMatch
    let hour = parseInt(hh)
    if (ampm === '오후' && hour < 12) hour += 12
    if (ampm === '오전' && hour === 12) hour = 0
    const p = (n: string | number, l = 2) => String(n).padStart(l, '0')
    return `${y}-${p(mo)}-${p(d)}T${p(hour)}:${p(mi)}:${p(ss || '0')}`
  }
  // 그 외는 Date 파서에 위임
  const dt = new Date(s)
  return isNaN(dt.getTime()) ? s : dt.toISOString()
}

// {headers, rows} 원시 시트값 → FormResponse[]
export function parseFormRows(headers: string[], rows: string[][]): FormResponse[] {
  if (!headers || headers.length === 0) return []
  let tsIdx = -1, emailIdx = -1, nameIdx = -1, bizIdx = -1
  headers.forEach((h, i) => {
    if (tsIdx < 0 && headerMatches(h, IDENTITY_HINTS.timestamp)) tsIdx = i
    else if (bizIdx < 0 && headerMatches(h, IDENTITY_HINTS.bizNumber)) bizIdx = i
    else if (emailIdx < 0 && headerMatches(h, IDENTITY_HINTS.email)) emailIdx = i
    else if (nameIdx < 0 && headerMatches(h, IDENTITY_HINTS.name)) nameIdx = i
  })
  const identityCols = new Set([tsIdx, emailIdx, nameIdx, bizIdx].filter((i) => i >= 0))

  return rows.map((row, idx) => {
    const email = emailIdx >= 0 ? String(row[emailIdx] || '').trim() : ''
    const name = nameIdx >= 0 ? String(row[nameIdx] || '').trim() : ''
    const biz = bizIdx >= 0 ? String(row[bizIdx] || '').trim().replace(/[^0-9]/g, '') : ''
    const answers: FormAnswer[] = []
    headers.forEach((h, i) => {
      if (identityCols.has(i)) return
      const a = String(row[i] ?? '').trim()
      if (a !== '') answers.push({ question: h, answer: a })
    })
    return {
      id: `fr_${idx + 2}`,
      _rowIndex: idx + 2,
      customer_number: biz || email || name,
      customer_name: name,
      respondent_email: email,
      submitted_at: tsIdx >= 0 ? parseTimestamp(String(row[tsIdx] || '')) : '',
      answers,
    }
  }).filter((r) => r.submitted_at || r.answers.length > 0)
}

// ── 주차 계산 (ISO 8601 주) ──
export function getWeekKey(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // 월=0
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const week = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7)
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

export function weekLabel(weekKey: string): string {
  const m = weekKey.match(/W(\d+)/)
  return m ? `${m[1]}주차` : weekKey
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
export function formatKST(iso: string): { date: string; time: string; weekday: string } {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return { date: iso || '-', time: '', weekday: '' }
  const p = (n: number) => String(n).padStart(2, '0')
  return {
    date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
    weekday: WEEKDAYS[d.getDay()],
  }
}

// ── 분석 헬퍼 ──

// 최근 N개 주차 키 목록 (최신 → 과거)
export function recentWeekKeys(n: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() - i * 7)
    keys.push(getWeekKey(d.toISOString()))
  }
  return keys
}

export interface FormStats {
  totalTargets: number       // 발송 대상 업체 수
  totalResponses: number     // 누적 응답 수
  respondedCompanies: number // 응답한 고유 업체 수 (전체 기간)
  thisWeekResponses: number
  thisWeekCompanies: number
  thisWeekRate: number       // 이번주 참여율 %
  overallRate: number        // 전체기간 참여율 %
}

export function computeStats(responses: FormResponse[], totalTargets: number): FormStats {
  const thisWeek = getWeekKey(new Date().toISOString())
  const companies = new Set(responses.map((r) => r.customer_number).filter(Boolean))
  const weekResp = responses.filter((r) => getWeekKey(r.submitted_at) === thisWeek)
  const weekCompanies = new Set(weekResp.map((r) => r.customer_number).filter(Boolean))
  return {
    totalTargets,
    totalResponses: responses.length,
    respondedCompanies: companies.size,
    thisWeekResponses: weekResp.length,
    thisWeekCompanies: weekCompanies.size,
    thisWeekRate: totalTargets > 0 ? Math.round((weekCompanies.size / totalTargets) * 100) : 0,
    overallRate: totalTargets > 0 ? Math.round((companies.size / totalTargets) * 100) : 0,
  }
}

// 주차별 참여 추이 (오래된 → 최신, 차트용)
export function participationByWeek(responses: FormResponse[], totalTargets: number, weeks = 8) {
  const keys = recentWeekKeys(weeks).reverse()
  return keys.map((wk) => {
    const inWeek = responses.filter((r) => getWeekKey(r.submitted_at) === wk)
    const companies = new Set(inWeek.map((r) => r.customer_number).filter(Boolean))
    return {
      week: wk,
      label: weekLabel(wk),
      responses: inWeek.length,
      companies: companies.size,
      rate: totalTargets > 0 ? Math.round((companies.size / totalTargets) * 100) : 0,
    }
  })
}

// 요일별 응답 분포 (월~일)
export function byWeekday(responses: FormResponse[]) {
  const order = ['월', '화', '수', '목', '금', '토', '일']
  const count: Record<string, number> = Object.fromEntries(order.map((d) => [d, 0]))
  responses.forEach((r) => {
    const { weekday } = formatKST(r.submitted_at)
    if (weekday && count[weekday] !== undefined) count[weekday]++
  })
  return order.map((d) => ({ weekday: d, count: count[d] }))
}

// 고객별 응답 그룹 (최신순)
export function groupByCustomer(responses: FormResponse[]) {
  const map = new Map<string, FormResponse[]>()
  responses.forEach((r) => {
    const key = r.customer_number || r.respondent_email || r.customer_name
    if (!key) return
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  })
  for (const list of map.values()) list.sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1))
  return map
}

// 특정 고객의 최근 N주 참여 여부 (상세관리 히트맵/스트릭용)
export function weeklyParticipation(responses: FormResponse[], weeks = 8) {
  const keys = recentWeekKeys(weeks) // 최신 → 과거
  return keys.map((wk) => {
    const resp = responses.find((r) => getWeekKey(r.submitted_at) === wk)
    return {
      week: wk,
      label: weekLabel(wk),
      participated: !!resp,
      response: resp || null,
    }
  })
}

// ── POC 시작일 기준 상대 주차 ──
// 해당 주의 월요일 0시
function mondayOf(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const day = (x.getDay() + 6) % 7 // 월=0
  x.setDate(x.getDate() - day)
  x.setHours(0, 0, 0, 0)
  return x
}

export interface WeekSlot { weekKey: string; index: number; label: string }

// 표시할 주차 슬롯 목록 (오래된 → 최신)
// - POC 시작(startISO) 있으면: 1주차 ~ 현재 주차 (라벨 "N주차"), 최근 maxWeeks개만
// - 시작 전(null): 최근 maxWeeks주 (라벨 "M/D" = 주 시작일)
export function pocWeekSlots(startISO: string | null, maxWeeks = 12): WeekSlot[] {
  const now = new Date()
  if (startISO) {
    const start = mondayOf(new Date(startISO))
    const cur = mondayOf(now)
    const total = Math.max(1, Math.floor((cur.getTime() - start.getTime()) / (7 * 86400000)) + 1)
    const slots: WeekSlot[] = []
    for (let i = 0; i < total; i++) {
      const wk = new Date(start); wk.setDate(start.getDate() + i * 7)
      slots.push({ weekKey: getWeekKey(wk.toISOString()), index: i + 1, label: `${i + 1}주차` })
    }
    return slots.slice(-maxWeeks)
  }
  const slots: WeekSlot[] = []
  for (let i = maxWeeks - 1; i >= 0; i--) {
    const d = new Date(now); d.setDate(now.getDate() - i * 7)
    const mon = mondayOf(d)
    slots.push({ weekKey: getWeekKey(mon.toISOString()), index: maxWeeks - i, label: `${mon.getMonth() + 1}/${mon.getDate()}` })
  }
  return slots
}

// 현재가 POC 몇 주차인지 (시작 전이면 0)
export function currentPocWeek(startISO: string | null): number {
  if (!startISO) return 0
  const start = mondayOf(new Date(startISO))
  const cur = mondayOf(new Date())
  return Math.max(1, Math.floor((cur.getTime() - start.getTime()) / (7 * 86400000)) + 1)
}

// 특정 고객의 주차별 참여 (POC 시작일 기준)
export function weeklyParticipationPoc(responses: FormResponse[], startISO: string | null, maxWeeks = 12) {
  return pocWeekSlots(startISO, maxWeeks).map((s) => {
    const resp = responses.find((r) => getWeekKey(r.submitted_at) === s.weekKey) || null
    return { ...s, participated: !!resp, response: resp }
  })
}

// 주차별 참여 추이 (POC 시작일 기준, 차트용)
export function participationTrendPoc(responses: FormResponse[], totalTargets: number, startISO: string | null, maxWeeks = 12) {
  return pocWeekSlots(startISO, maxWeeks).map((s) => {
    const inWeek = responses.filter((r) => getWeekKey(r.submitted_at) === s.weekKey)
    const companies = new Set(inWeek.map((r) => r.customer_number).filter(Boolean))
    return {
      week: s.weekKey,
      label: s.label,
      index: s.index,
      responses: inWeek.length,
      companies: companies.size,
      rate: totalTargets > 0 ? Math.round((companies.size / totalTargets) * 100) : 0,
    }
  })
}

// ── 문항별 응답 분포 (선택지 집계) ──
export interface AnswerOption { answer: string; count: number; pct: number }
export interface QuestionDist {
  question: string
  total: number           // 이 문항에 답한 응답 수
  isChoice: boolean       // true=선택형(막대 집계), false=주관식(자유 텍스트)
  options: AnswerOption[] // 선택형일 때 답변별 집계 (많은 순)
  samples: string[]       // 주관식일 때 최근 샘플 답변
}

export function answerDistributions(responses: FormResponse[]): QuestionDist[] {
  const order: string[] = []           // 문항 첫 등장 순서 보존
  const qMap = new Map<string, string[]>()
  const sorted = [...responses].sort((a, b) => (a.submitted_at < b.submitted_at ? -1 : 1)) // 오래된→최신
  sorted.forEach((r) => r.answers.forEach((a) => {
    if (!qMap.has(a.question)) { qMap.set(a.question, []); order.push(a.question) }
    qMap.get(a.question)!.push(a.answer)
  }))

  return order.map((question) => {
    const answers = qMap.get(question)!.filter((a) => a && a.trim())
    const total = answers.length
    const uniq = new Set(answers)
    const looksLongText = answers.some((a) => a.length > 60)
    const isChoice = !looksLongText && uniq.size <= 15 && (total < 5 || uniq.size <= Math.ceil(total * 0.85))

    let options: AnswerOption[] = []
    if (isChoice) {
      const counter = new Map<string, number>()
      answers.forEach((a) => {
        // 체크박스(복수선택)는 콤마로 분해
        const parts = a.split(/\s*,\s*/).map((s) => s.trim()).filter(Boolean)
        const buckets = parts.length ? parts : [a]
        buckets.forEach((b) => counter.set(b, (counter.get(b) || 0) + 1))
      })
      options = [...counter.entries()]
        .map(([answer, count]) => ({ answer, count, pct: total > 0 ? Math.round((count / total) * 100) : 0 }))
        .sort((a, b) => b.count - a.count)
    }
    const samples = isChoice ? [] : [...answers].reverse().slice(0, 3)
    return { question, total, isChoice, options, samples }
  })
}

// ── 로드 ──
const LS_KEY = 'branchq:formResponses'
function lsLoad(): FormResponse[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]') } catch { return [] }
}

/** 구글폼 응답 전체 조회 (Edge Function → localStorage → DEV 샘플) */
export async function loadFormResponses(): Promise<FormResponse[]> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readFormResponses' }),
    })
    const data = await res.json()
    if (data.error) throw new Error(data.error)
    if (Array.isArray(data.rows)) {
      const parsed = parseFormRows(data.headers || [], data.rows)
      if (parsed.length > 0) return parsed
    }
  } catch { /* 폴백 진행 */ }

  const local = lsLoad()
  if (local.length > 0) return local
  if (isDev) return DEV_MOCK_RESPONSES
  return []
}

// ── DEV 샘플 데이터 (폼 미연결 상태에서 UI 확인용) ──
// DEV_MOCK_CUSTOMERS(branchq.ts)의 업체와 사업자번호를 맞춰 조인 데모가 되도록 구성.
const MOCK_QUESTIONS = {
  usage: '이번 주 브랜치Q를 얼마나 사용하셨나요?',
  satisfaction: '전반적인 만족도를 평가해주세요',
  feature: '가장 많이 사용한 기능은 무엇인가요?',
  improve: '개선이 필요하거나 불편했던 점을 자유롭게 적어주세요',
}

function mockResp(id: string, biz: string, name: string, email: string, daysAgo: number, hour: number, min: number, ans: Partial<Record<keyof typeof MOCK_QUESTIONS, string>>): FormResponse {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  d.setHours(hour, min, 0, 0)
  const answers: FormAnswer[] = []
  ;(Object.keys(MOCK_QUESTIONS) as (keyof typeof MOCK_QUESTIONS)[]).forEach((k) => {
    if (ans[k]) answers.push({ question: MOCK_QUESTIONS[k], answer: ans[k]! })
  })
  return { id, customer_number: biz, customer_name: name, respondent_email: email, submitted_at: d.toISOString(), answers }
}

export const DEV_MOCK_RESPONSES: FormResponse[] = [
  // (주)가나상사 — 매주 성실 참여
  mockResp('m1', '1018212345', '(주)가나상사', 'lee@gana.co.kr', 1, 10, 12, { usage: '매일 사용', satisfaction: '매우 만족', feature: 'AI 보고서 생성', improve: '보고서 양식을 더 다양하게 추가해주면 좋겠습니다.' }),
  mockResp('m2', '1018212345', '(주)가나상사', 'lee@gana.co.kr', 8, 9, 41, { usage: '매일 사용', satisfaction: '만족', feature: '현황 조회', improve: '없음' }),
  mockResp('m3', '1018212345', '(주)가나상사', 'lee@gana.co.kr', 15, 11, 3, { usage: '주 3~4회', satisfaction: '만족', feature: 'AI 보고서 생성', improve: '엑셀 다운로드 속도 개선 희망' }),
  mockResp('m4', '1018212345', '(주)가나상사', 'lee@gana.co.kr', 22, 14, 27, { usage: '매일 사용', satisfaction: '매우 만족', feature: 'PDF 내보내기', improve: '' }),
  // 대한물산(주) — 이번주 참여, 간헐적
  mockResp('m5', '2208298765', '대한물산(주)', 'kim@daehan.com', 2, 16, 55, { usage: '주 1~2회', satisfaction: '보통', feature: '현황 조회', improve: '로그인 유지 시간이 짧습니다.' }),
  mockResp('m6', '2208298765', '대한물산(주)', 'kim@daehan.com', 16, 13, 8, { usage: '주 1~2회', satisfaction: '보통', feature: '현황 조회', improve: '모바일에서도 보고 싶어요' }),
  // 서울테크 — 이번주 참여
  mockResp('m7', '3056733210', '서울테크', 'park@seoultech.kr', 3, 15, 30, { usage: '주 3~4회', satisfaction: '만족', feature: '엑셀 편집기', improve: '단축키 지원 부탁드립니다.' }),
  mockResp('m8', '3056733210', '서울테크', 'park@seoultech.kr', 24, 10, 45, { usage: '거의 안함', satisfaction: '보통', feature: '없음', improve: '사용법이 아직 익숙하지 않습니다.' }),
  // 한빛유통 — 오래전 1회 후 미참여 (이탈 위험)
  mockResp('m9', '4129955667', '한빛유통', 'choi@hanbit.co.kr', 30, 9, 20, { usage: '주 1~2회', satisfaction: '불만족', feature: '현황 조회', improve: 'ERP 연동 후 데이터가 늦게 반영됩니다.' }),
  // 미래에프앤비 — 이번주 신규 첫 참여
  mockResp('m10', '5078811223', '미래에프앤비', 'yoon@miraefnb.com', 0, 17, 2, { usage: '주 1~2회', satisfaction: '만족', feature: 'AI 보고서 생성', improve: '첫 사용인데 직관적이라 좋았습니다.' }),
]
