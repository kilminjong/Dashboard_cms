import { useEffect, useMemo, useState } from 'react'
import { fetchCustomers, updateCustomerEmailInSheet } from '../lib/googleSheets'
import { loadBranchqRecords, DEV_MOCK_CUSTOMERS, type BranchQRecord } from '../lib/branchq'
import { loadFormResponses, getWeekKey } from '../lib/googleForm'
import {
  loadMailConfig, saveMailConfig, syncRecipients, sendReminder,
  DEFAULT_MAIL_CONFIG, type MailConfig, type Recipient,
} from '../lib/formSend'
import { useAuth } from '../hooks/useAuth'
import {
  Send, RefreshCw, Save, Mail, CheckCircle2, Circle, Info, AlertTriangle, Users, MailWarning, Power, PowerOff,
} from 'lucide-react'

const isDev = (() => { try { return import.meta.env.DEV } catch { return false } })()

interface Row {
  key: string
  name: string
  biz: string
  email: string
  customer: any | null  // 고객원장 객체(_raw 보유) — 이메일 시트 반영용
  participatedThisWeek: boolean
}

export default function GoogleFormSend() {
  const { profile } = useAuth()
  const myEmail = profile?.email || ''
  const [rows, setRows] = useState<Row[]>([])
  const [emailMap, setEmailMap] = useState<Record<string, string>>({})
  const [config, setConfig] = useState<MailConfig>(DEFAULT_MAIL_CONFIG)
  const [configMissing, setConfigMissing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [savingEmails, setSavingEmails] = useState(false)
  const [savingConfig, setSavingConfig] = useState(false)
  const [sending, setSending] = useState(false)
  const [testMode, setTestMode] = useState(true)
  const [showSendModal, setShowSendModal] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const load = async () => {
    let cust: any[] = []
    try { cust = await fetchCustomers() } catch { /* 오프라인 */ }
    if ((!cust || cust.length === 0) && isDev) cust = DEV_MOCK_CUSTOMERS
    let recs = await loadBranchqRecords()
    if ((!recs || recs.length === 0) && isDev) {
      recs = DEV_MOCK_CUSTOMERS.map((c) => ({ customer_number: c.customer_number, customer_name: c.customer_name, business_number: c.business_number, build_status: c.branchq_status }))
    }
    const custByNum = new Map(cust.map((c) => [String(c.customer_number), c]))
    const responses = await loadFormResponses()
    const thisWeek = getWeekKey(new Date().toISOString())
    const respondedBiz = new Set(responses.filter((r) => getWeekKey(r.submitted_at) === thisWeek).map((r) => String(r.customer_number)))

    const built: Row[] = recs.map((r: BranchQRecord) => {
      const c = custByNum.get(String(r.customer_number))
      const biz = String(r.business_number || c?.business_number || '').replace(/[^0-9]/g, '')
      const email = c?.contact_email || ''
      return {
        key: r.customer_number || biz || r.customer_name || '',
        name: r.customer_name || c?.customer_name || '-',
        biz,
        email,
        customer: c || null,
        participatedThisWeek: respondedBiz.has(biz) || respondedBiz.has(String(r.customer_number)),
      }
    }).filter((r) => r.key)

    setRows(built)
    setEmailMap(Object.fromEntries(built.map((r) => [r.key, r.email])))
    // 이번주 미참여 자동 체크
    setSelected(new Set(built.filter((r) => !r.participatedThisWeek).map((r) => r.key)))

    const { config: cfg, missing } = await loadMailConfig()
    setConfig(cfg)
    setConfigMissing(missing)
  }

  useEffect(() => { (async () => { await load(); setLoading(false) })() }, [])

  const flash = (type: 'ok' | 'err', text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 5000) }

  // 이메일 저장: 변경분은 고객원장에 반영 + 전체 명단을 발송대상 탭에 동기화
  const saveEmails = async () => {
    setSavingEmails(true)
    try {
      let ledgerUpdated = 0
      for (const r of rows) {
        const newEmail = (emailMap[r.key] || '').trim()
        if (newEmail !== (r.email || '').trim() && r.customer) {
          try { await updateCustomerEmailInSheet(r.customer, newEmail); ledgerUpdated++ } catch { /* 개별 실패 무시 */ }
        }
      }
      const recipients: Recipient[] = rows
        .map((r) => ({ name: r.name, biz: r.biz, email: (emailMap[r.key] || '').trim() }))
        .filter((r) => r.email)
      const synced = await syncRecipients(recipients)
      // 로컬 반영
      setRows((prev) => prev.map((r) => ({ ...r, email: (emailMap[r.key] || '').trim() })))
      flash('ok', `저장 완료 · 고객원장 ${ledgerUpdated}건 반영, 발송대상 ${synced}건 동기화`)
    } catch (e: any) {
      flash('err', `저장 실패: ${e.message || e}`)
    } finally {
      setSavingEmails(false)
    }
  }

  const saveConfig = async () => {
    setSavingConfig(true)
    try {
      await saveMailConfig(config)
      setConfigMissing(false)
      flash('ok', '메일 양식을 저장했습니다.')
    } catch (e: any) {
      flash('err', `양식 저장 실패: ${e.message || e}`)
    } finally {
      setSavingConfig(false)
    }
  }

  // 자동발송 ON/OFF (즉시 저장)
  const toggleAuto = async () => {
    const next = (config.auto_enabled || 'on') === 'off' ? 'on' : 'off'
    const updated = { ...config, auto_enabled: next }
    setConfig(updated)
    try {
      await saveMailConfig(updated)
      flash('ok', `매주 목요일 자동발송을 ${next === 'on' ? '켰습니다' : '껐습니다'}.`)
    } catch (e: any) {
      setConfig(config) // 롤백
      flash('err', `변경 실패: ${e.message || e}`)
    }
  }
  const autoOn = (config.auto_enabled || 'on') !== 'off'

  // 발송 대상(선택 + 이메일 보유)
  const sendRecipients = useMemo<Recipient[]>(() => rows
    .filter((r) => selected.has(r.key))
    .map((r) => ({ name: r.name, biz: r.biz, email: (emailMap[r.key] || '').trim() }))
    .filter((r) => r.email), [rows, selected, emailMap])

  // [발송] 클릭 → 검증 후 확인 모달 오픈
  const openSend = () => {
    if (sendRecipients.length === 0) { flash('err', '이메일이 입력된 대상이 없습니다. 고객을 체크하고 이메일을 확인해주세요.'); return }
    if (testMode && !myEmail) { flash('err', '테스트 받을 내 로그인 이메일을 확인할 수 없습니다. 로그인 상태를 확인해주세요.'); return }
    setShowSendModal(true)
  }

  // 모달 확인 → 실제 발송
  const confirmSend = async () => {
    setShowSendModal(false)
    setSending(true)
    try {
      const res = await sendReminder({ templateKey: 'remind', recipients: sendRecipients, testEmail: testMode ? myEmail : undefined })
      flash('ok', `발송 완료 · 성공 ${res.sent}건${res.failed ? `, 실패 ${res.failed}건` : ''}`)
    } catch (e: any) {
      flash('err', `발송 실패: ${e.message || e}`)
    } finally {
      setSending(false)
    }
  }

  const noEmailCount = useMemo(() => rows.filter((r) => !(emailMap[r.key] || '').trim()).length, [rows, emailMap])
  const selectedCount = selected.size
  const nonParticipants = rows.filter((r) => !r.participatedThisWeek)

  const toggle = (key: string) => setSelected((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  const selectNonParticipants = () => setSelected(new Set(nonParticipants.map((r) => r.key)))
  const selectAll = () => setSelected(new Set(rows.map((r) => r.key)))
  const clearSel = () => setSelected(new Set())

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="w-8 h-8 rounded-lg bg-emerald-50 grid place-items-center"><Send size={16} className="text-emerald-600" /></span>
        <h2 className="text-2xl font-bold text-gray-800">설문 발송 관리</h2>
      </div>
      <p className="text-sm text-gray-400 mb-5">POC 고객 이메일 관리, 메일 양식 편집, 미참여 업체 리마인드 발송을 한 곳에서 처리합니다.</p>

      {msg && (
        <div className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>{msg.text}</div>
      )}

      {configMissing && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-2.5 text-sm text-amber-800">
          <AlertTriangle size={17} className="shrink-0 mt-0.5 text-amber-500" />
          <div>구글폼 응답 스프레드시트에 <b>‘메일양식’</b>·<b>‘발송대상’</b> 탭이 아직 없습니다. 두 탭을 만든 뒤 저장하면 자동발송이 동작합니다. (하단 안내 참고)</div>
        </div>
      )}

      {/* 자동발송 ON/OFF */}
      <div className={`mb-4 rounded-xl border px-5 py-3.5 flex items-center justify-between gap-3 ${autoOn ? 'bg-emerald-50/60 border-emerald-100' : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-center gap-3 min-w-0">
          <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${autoOn ? 'bg-emerald-600' : 'bg-gray-400'}`}>
            {autoOn ? <Power size={17} className="text-white" /> : <PowerOff size={17} className="text-white" />}
          </span>
          <div className="min-w-0">
            <p className={`text-sm font-bold ${autoOn ? 'text-emerald-800' : 'text-gray-600'}`}>매주 목요일 자동발송 {autoOn ? 'ON' : 'OFF'}</p>
            <p className={`text-xs ${autoOn ? 'text-emerald-700/70' : 'text-gray-400'}`}>
              {autoOn ? '매주 목요일 전체 발송대상에게 [자동발송] 양식이 자동 발송됩니다.' : '자동발송이 꺼져 있습니다. (수동 발송 버튼은 계속 사용 가능)'}
            </p>
          </div>
        </div>
        <button onClick={toggleAuto} role="switch" aria-checked={autoOn}
          className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${autoOn ? 'bg-emerald-600' : 'bg-gray-300'}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform mt-0.5 ${autoOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
        </button>
      </div>

      {/* 메일 양식 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2"><Mail size={15} className="text-gray-400" /> 메일 양식</h3>
          <button onClick={saveConfig} disabled={savingConfig} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50">
            {savingConfig ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} 양식 저장
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">본문에 <code className="bg-gray-100 px-1 rounded">{'{업체명}'}</code> <code className="bg-gray-100 px-1 rounded">{'{폼링크}'}</code> 를 쓰면 발송 시 실제 값으로 치환됩니다.</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {([
            { key: 'auto', title: '자동발송 (매주 목요일)', sub: 'subject: auto_subject / body: auto_body', s: 'auto_subject', b: 'auto_body' },
            { key: 'remind', title: '추가발송 (미참여 리마인드)', sub: '수동 버튼 발송 시 사용', s: 'remind_subject', b: 'remind_body' },
          ] as const).map((t) => (
            <div key={t.key} className="rounded-xl border border-gray-100 p-3.5">
              <p className="text-sm font-semibold text-gray-700 mb-0.5">{t.title}</p>
              <p className="text-[11px] text-gray-400 mb-2.5">{t.sub}</p>
              <input value={config[t.s]} onChange={(e) => setConfig({ ...config, [t.s]: e.target.value })}
                placeholder="메일 제목" className="w-full mb-2 px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
              <textarea value={config[t.b]} onChange={(e) => setConfig({ ...config, [t.b]: e.target.value })}
                rows={7} placeholder="메일 본문" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-y leading-relaxed" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">구글폼 링크 <span className="text-gray-400">{'({폼링크}에 들어감)'}</span></label>
            <input value={config.form_link} onChange={(e) => setConfig({ ...config, form_link: e.target.value })}
              placeholder="https://forms.gle/..." className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Apps Script 웹앱 URL <span className="text-gray-400">(수동 발송용)</span></label>
            <input value={config.apps_script_url} onChange={(e) => setConfig({ ...config, apps_script_url: e.target.value })}
              placeholder="https://script.google.com/macros/s/.../exec" className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30" />
          </div>
        </div>
      </div>

      {/* 발송 대상 명단 + 수동 발송 */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-4">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-2 flex-wrap">
          <Users size={15} className="text-gray-400" />
          <h3 className="font-semibold text-gray-700 text-sm">발송 대상 ({rows.length}개사)</h3>
          {noEmailCount > 0 && <span className="text-xs text-amber-600 inline-flex items-center gap-1"><MailWarning size={13} /> 이메일 미입력 {noEmailCount}건</span>}
          <button onClick={saveEmails} disabled={savingEmails} className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-700 text-white hover:bg-slate-800 transition disabled:opacity-50">
            {savingEmails ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />} 이메일 저장
          </button>
        </div>

        {/* 발송 컨트롤 바 */}
        <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap bg-white">
          <span className="text-xs text-gray-500">선택 <b className="text-emerald-600">{selectedCount}</b>개사</span>
          <button onClick={selectNonParticipants} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">미참여 전체</button>
          <button onClick={selectAll} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">전체</button>
          <button onClick={clearSel} className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">해제</button>
          <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} className="accent-emerald-600" />
            테스트 발송(내 메일로만)
          </label>
          <button onClick={openSend} disabled={sending} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 transition disabled:opacity-50">
            {sending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />} {testMode ? '테스트 발송' : '리마인드 발송'}
          </button>
        </div>

        <div className="max-h-[52vh] overflow-y-auto divide-y divide-gray-50">
          {rows.length === 0 ? (
            <p className="text-center py-12 text-gray-400 text-sm">POC 대상고객이 없습니다.</p>
          ) : rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 px-5 py-2.5 hover:bg-gray-50/60">
              <button onClick={() => toggle(r.key)} className="shrink-0">
                {selected.has(r.key) ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Circle size={18} className="text-gray-300" />}
              </button>
              <div className="w-40 min-w-0 shrink-0">
                <p className="text-sm font-medium text-gray-800 truncate">{r.name}</p>
                <p className="text-[11px] text-gray-400">{r.participatedThisWeek ? <span className="text-emerald-600">이번주 참여</span> : <span className="text-amber-600">미참여</span>}{r.biz && ` · ${r.biz}`}</p>
              </div>
              <input
                value={emailMap[r.key] ?? ''}
                onChange={(e) => setEmailMap({ ...emailMap, [r.key]: e.target.value })}
                placeholder="이메일 입력"
                className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 셋업 안내 */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex gap-3">
        <Info size={18} className="text-blue-500 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-900/80 leading-relaxed">
          <p className="font-semibold text-blue-800 mb-1">발송 설정 방법</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>구글폼 응답 스프레드시트에 <b>‘메일양식’</b>, <b>‘발송대상’</b> 탭을 추가 (하단 + 버튼)</li>
            <li>위에서 메일 양식과 각 고객 이메일 입력 → 저장 (고객원장·발송대상 탭에 자동 반영)</li>
            <li>Apps Script를 붙여넣고 ①매주 목요일 트리거 ②웹앱 배포 → 웹앱 URL을 위 칸에 입력</li>
          </ol>
          <p className="mt-1 text-blue-700/70">Apps Script 코드는 담당 개발자에게 요청하세요. 처음엔 <b>테스트 발송</b>으로 확인 후 실제 발송을 권장합니다.</p>
        </div>
      </div>

      {/* 발송 확인 모달 */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowSendModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2.5 mb-3">
              <span className={`w-10 h-10 rounded-full grid place-items-center ${testMode ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                <Send size={18} className={testMode ? 'text-blue-600' : 'text-emerald-600'} />
              </span>
              <h3 className="text-lg font-bold text-gray-800">{testMode ? '테스트 발송' : '리마인드 발송'}</h3>
            </div>

            {testMode ? (
              <p className="text-sm text-gray-600 leading-relaxed mb-1">
                <b className="text-blue-700">테스트 미리보기</b>를 <b>내 메일({myEmail})</b>로 발송합니다.
                고객에게는 전송되지 않습니다.
              </p>
            ) : (
              <p className="text-sm text-gray-600 leading-relaxed mb-1">
                선택한 <b className="text-emerald-700">{sendRecipients.length}개 업체</b>에게 <b>추가발송(리마인드) 양식</b>으로 메일을 발송합니다.
              </p>
            )}
            <p className="text-xs text-gray-400 leading-relaxed mb-5">
              {testMode
                ? '실제 발송 전 양식·내용 확인용입니다. 대표 1통이 내 메일함으로 옵니다.'
                : '⚠️ 실제 고객에게 즉시 발송됩니다. 대상과 이메일을 다시 확인하세요.'}
            </p>

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowSendModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
                취소
              </button>
              <button onClick={confirmSend}
                className={`px-4 py-2 rounded-lg text-sm font-bold text-white transition inline-flex items-center gap-1.5 ${testMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                <Send size={15} /> {testMode ? '테스트 발송' : '발송하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
