// 설문 발송 관리 데이터 레이어
// - 메일양식(자동/추가발송 제목·본문 + 폼링크 + Apps Script URL): 구글폼 스프레드시트 '메일양식' 탭
// - 발송대상 명단(업체명·사업자번호·이메일): '발송대상' 탭 (Apps Script 자동발송이 읽음)
// - 수동 발송: Edge Function이 Apps Script 웹앱으로 프록시
// 이메일 자체는 고객원장(contact_email)에 저장하고, 이 명단 탭은 발송용 사본(웹이 자동 동기화).

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets`

export interface MailConfig {
  auto_subject: string
  auto_body: string
  remind_subject: string
  remind_body: string
  form_link: string
  apps_script_url: string
  auto_enabled: string // 'on' | 'off' — 매주 목요일 자동발송 on/off
}

export const DEFAULT_MAIL_CONFIG: MailConfig = {
  auto_subject: '[브랜치Q] 이번 주 사용 현황 설문 요청드립니다',
  auto_body: `{업체명} 담당자님, 안녕하세요. 웹캐시 하나CMS팀입니다.

이번 주 브랜치Q 사용 현황 설문에 참여 부탁드립니다.
1~2분이면 완료됩니다.

▶ 설문 참여: {폼링크}

감사합니다.`,
  remind_subject: '[브랜치Q] (리마인드) 이번 주 설문 참여 부탁드립니다',
  remind_body: `{업체명} 담당자님, 안녕하세요. 웹캐시 하나CMS팀입니다.

이번 주 브랜치Q 설문에 아직 참여하지 않으신 것으로 확인됩니다.
바쁘시겠지만 잠시만 시간 내어 참여 부탁드립니다.

▶ 설문 참여: {폼링크}

감사합니다.`,
  form_link: '',
  apps_script_url: '',
  auto_enabled: 'on',
}

export async function loadMailConfig(): Promise<{ config: MailConfig; missing: boolean }> {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'readFormConfig' }),
    })
    const data = await res.json()
    const cfg = { ...DEFAULT_MAIL_CONFIG, ...(data.config || {}) }
    // 저장된 적 없으면(모든 값 비어있으면) 기본 양식 노출
    const hasAny = data.config && Object.values(data.config).some((v) => v && String(v).trim())
    if (!hasAny) return { config: DEFAULT_MAIL_CONFIG, missing: !!data.missing }
    return { config: cfg, missing: !!data.missing }
  } catch {
    return { config: DEFAULT_MAIL_CONFIG, missing: true }
  }
}

export async function saveMailConfig(config: MailConfig): Promise<void> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'writeFormConfig', config }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
}

export interface Recipient { name: string; biz: string; email: string }

// 발송대상 명단(사본)을 시트에 동기화 — Apps Script 자동발송용
export async function syncRecipients(recipients: Recipient[]): Promise<number> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'writeRecipients', recipients }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data.count || 0
}

// 수동 발송 (Apps Script 웹앱 프록시)
// templateKey: 'auto' | 'remind', testEmail 지정 시 그 주소로만 테스트 발송
export async function sendReminder(opts: {
  templateKey: 'auto' | 'remind'
  recipients: Recipient[]
  testEmail?: string
}): Promise<{ sent: number; failed: number; raw?: any }> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sendReminder', sendPayload: opts }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  const r = data.result || {}
  if (r.error) throw new Error(r.error)
  return { sent: r.sent || 0, failed: r.failed || 0, raw: r }
}
