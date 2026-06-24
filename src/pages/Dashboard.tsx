import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCustomers } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import {
  Users, UserCheck, Calendar, Sparkles, RefreshCw, Clock, XCircle, UserCircle, X, Bell, ChevronDown,
  ChevronRight, UserPlus, CalendarPlus, FileBarChart, Megaphone, Bot, FolderOpen,
} from 'lucide-react'
import {
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid,
  ComposedChart, Bar, Line,
} from 'recharts'

interface Stats {
  totalCustomers: number
  openedCustomers: number
  waitingCustomers: number
  progressCustomers: number
  canceledCustomers: number
  todaySchedules: number
}

interface MonthlyData {
  month: string
  count: number
}


interface MyStats {
  total: number
  opened: number
  waiting: number
  progress: number
  canceled: number
}

interface ExpiringCustomer {
  id: string
  customer_name: string
  manager: string
  _expiryField: string
  _expiryDate: string
  _daysLeft: number
}

// KPI / 빠른작업 색상 토큰
const TINT: Record<string, { bg: string; fg: string }> = {
  green: { bg: 'bg-emerald-50', fg: 'text-emerald-600' },
  blue: { bg: 'bg-blue-50', fg: 'text-blue-600' },
  amber: { bg: 'bg-amber-50', fg: 'text-amber-600' },
  sky: { bg: 'bg-sky-50', fg: 'text-sky-600' },
  red: { bg: 'bg-red-50', fg: 'text-red-500' },
  violet: { bg: 'bg-violet-50', fg: 'text-violet-600' },
  indigo: { bg: 'bg-indigo-50', fg: 'text-indigo-600' },
}
const AVATAR = ['bg-emerald-500', 'bg-blue-500', 'bg-violet-500', 'bg-amber-500', 'bg-sky-500']

// 상대 시간 표시
const relTime = (iso: string) => {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function Dashboard() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    openedCustomers: 0,
    waitingCustomers: 0,
    progressCustomers: 0,
    canceledCustomers: 0,
    todaySchedules: 0,
  })
  const [recentCustomers, setRecentCustomers] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [myStats, setMyStats] = useState<MyStats>({ total: 0, opened: 0, waiting: 0, progress: 0, canceled: 0 })
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [todayScheduleList, setTodayScheduleList] = useState<any[]>([])
  const [cardModal, setCardModal] = useState<{ type: string; title: string; data: any[] } | null>(null)
  const [monthlyAssignment, setMonthlyAssignment] = useState<{ name: string; total: number; linked: number }[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [expiringCustomers, setExpiringCustomers] = useState<ExpiringCustomer[]>([])
  const [showExpiryAlert, setShowExpiryAlert] = useState(true)

  // 유저별 캐시 키
  const cacheKey = profile?.id ? `ai_summary_${profile.id}` : 'ai_summary'
  const cacheDateKey = profile?.id ? `ai_summary_date_${profile.id}` : 'ai_summary_date'

  useEffect(() => {
    loadStats()
    loadRecentCustomers()
    loadMonthlyTrend()

    // 유저별 + 날짜별 캐시 확인
    const cached = sessionStorage.getItem(cacheKey)
    const cachedDate = sessionStorage.getItem(cacheDateKey)
    const today = new Date().toISOString().split('T')[0]

    if (cached && cachedDate === today) {
      setAiSummary(cached)
    } else {
      loadAiSummary()
    }
  }, [profile?.id])

  const categorizeStatus = (status: string) => {
    if (!status) return '개설대기'
    if (status === '개설완료' || status === '이행완료') return '개설완료'
    if (status === '개설대기') return '개설대기'
    if (status === '개설진행') return '개설진행'
    if (status === '개설취소') return '개설취소'
    return '개설대기'
  }

  const loadStats = async () => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]

    const [gsCustomers, schedules, todaySchedules] = await Promise.all([
      fetchCustomers(),
      supabase.from('schedules').select('id', { count: 'exact', head: true })
        .eq('start_date', today),
      supabase.from('schedules').select('id, title, description, start_time, end_time, is_done')
        .eq('start_date', today).order('start_time'),
    ])

    const list = gsCustomers || []
    setAllCustomers(list)
    setTodayScheduleList(todaySchedules.data || [])

    // 만료 예정 고객 계산 (오늘 ~ 30일 이내)
    const todayMs = new Date(new Date().toDateString()).getTime()
    const parseLocalDate = (s: string) => {
      if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
      const [y, m, d] = s.split('-').map(Number)
      return new Date(y, m - 1, d)
    }
    const expiring: ExpiringCustomer[] = []
    list.forEach((c: any) => {
      ;[
        { field: '해지일', date: c.termination_date },
        { field: '이행종료일', date: c.transition_end_date },
      ].forEach(({ field, date }) => {
        const d = parseLocalDate(date)
        if (!d) return
        const diff = Math.ceil((d.getTime() - todayMs) / 86400000)
        if (diff >= 0 && diff <= 30) {
          expiring.push({ id: c.id, customer_name: c.customer_name, manager: c.manager || '', _expiryField: field, _expiryDate: date, _daysLeft: diff })
        }
      })
    })
    setExpiringCustomers(expiring.sort((a, b) => a._daysLeft - b._daysLeft))
    const categorized = list.map((c) => categorizeStatus(c.opening_status))

    const opened = categorized.filter((s) => s === '개설완료').length
    const waiting = categorized.filter((s) => s === '개설대기').length
    const progress = categorized.filter((s) => s === '개설진행').length
    const canceled = categorized.filter((s) => s === '개설취소').length

    setStats({
      totalCustomers: list.length,
      openedCustomers: opened,
      waitingCustomers: waiting,
      progressCustomers: progress,
      canceledCustomers: canceled,
      todaySchedules: schedules.count || 0,
    })


    // 내 담당 고객 현황 (profile 또는 auth metadata에서 이름 가져옴)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const managerName = profile?.name || authUser?.user_metadata?.name || ''
    if (managerName) {
      const myList = list.filter((c) => c.manager === managerName)
      const myCat = myList.map((c) => categorizeStatus(c.opening_status))
      setMyStats({
        total: myList.length,
        opened: myCat.filter((s) => s === '개설완료').length,
        waiting: myCat.filter((s) => s === '개설대기').length,
        progress: myCat.filter((s) => s === '개설진행').length,
        canceled: myCat.filter((s) => s === '개설취소').length,
      })
    }

    // 당월 담당자 배정 현황
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const thisMonthCustomers = list.filter((c) => c.reception_date?.startsWith(currentMonth))
    const assignMap: Record<string, { total: number; linked: number }> = {}
    thisMonthCustomers.forEach((c) => {
      const mgr = c.manager || '미배정'
      if (!assignMap[mgr]) assignMap[mgr] = { total: 0, linked: 0 }
      assignMap[mgr].total++
      if (c.construction_type === '연계형') assignMap[mgr].linked++
    })
    setMonthlyAssignment(
      Object.entries(assignMap)
        .map(([name, d]) => ({ name, total: d.total, linked: d.linked }))
        .sort((a, b) => b.total - a.total)
    )
  }

  const loadRecentCustomers = async () => {
    const { data } = await supabase
      .from('customers')
      .select('id, customer_name, business_number, opening_status, manager, created_at')
      .order('created_at', { ascending: false })
      .limit(5)
    setRecentCustomers(data || [])
  }

  const loadMonthlyTrend = async () => {
    const { data } = await supabase
      .from('customers')
      .select('reception_date')
      .not('reception_date', 'is', null)
      .order('reception_date', { ascending: true })
      .range(0, 9999)

    if (!data) return

    // 최근 12개월 기준 월별 집계 (reception_date 기준)
    const now = new Date()
    const months: MonthlyData[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${d.getMonth() + 1}월`
      const count = data.filter((c) => c.reception_date?.startsWith(key)).length
      months.push({ month: label, count })
    }
    setMonthlyData(months)
  }

  const loadAiSummary = async () => {
    setAiLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      // profile에서 이름 가져오되, 없으면 auth metadata에서 가져옴
      const { data: { user } } = await supabase.auth.getUser()
      const userName = profile?.name || user?.user_metadata?.name || ''

      // 오늘 캘린더 일정 (시간 + 완료 상태 포함) — AI 요약의 분석 근거
      const { data: schedules } = await supabase
        .from('schedules')
        .select('title, description, start_time, end_time, is_done')
        .eq('start_date', today)
        .order('start_time')

      // 로그인한 담당자의 고객 현황 (manager가 본인 이름인 것)
      let myCustomersQuery = supabase
        .from('customers')
        .select('customer_name, opening_status')
        .order('created_at', { ascending: false })
        .limit(10)

      if (userName) {
        myCustomersQuery = myCustomersQuery.eq('manager', userName)
      }
      const { data: myCustomers } = await myCustomersQuery

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          todaySchedules: schedules || [],
          recentCustomers: myCustomers || [],
          managerName: userName,
          date: today,
        }),
      })

      const text = await res.text()
      if (!res.ok) {
        console.error(`[AI 요약 에러 ${res.status}]`, text)
        setAiSummary('오류가 발생했습니다. 관리자에게 문의해주세요.')
        setAiLoading(false)
        return
      }

      const data = JSON.parse(text)
      const summary = data?.summary || '오늘의 업무 요약을 불러올 수 없습니다.'
      setAiSummary(summary)
      sessionStorage.setItem(cacheKey, summary)
      sessionStorage.setItem(cacheDateKey, new Date().toISOString().split('T')[0])
    } catch (err: any) {
      console.error('[AI 요약 에러]', err)
      setAiSummary('오류가 발생했습니다. 관리자에게 문의해주세요.')
    }
    setAiLoading(false)
  }

  const getManagerName = () => profile?.name || ''

  const handleCardClick = (label: string) => {
    const mgr = getManagerName()
    if (label === '전체 고객') {
      navigate('/customers')
    } else if (label === '개설 완료') {
      navigate('/customers?status=개설완료')
    } else if (label === '개설 대기') {
      const data = allCustomers.filter((c) => categorizeStatus(c.opening_status) === '개설대기' && (!mgr || c.manager === mgr))
      setCardModal({ type: 'customers', title: `${mgr || ''} 개설대기 고객`, data })
    } else if (label === '개설 진행') {
      const data = allCustomers.filter((c) => categorizeStatus(c.opening_status) === '개설진행' && (!mgr || c.manager === mgr))
      setCardModal({ type: 'customers', title: `${mgr || ''} 개설진행 고객`, data })
    } else if (label === '개설 취소') {
      const data = allCustomers.filter((c) => categorizeStatus(c.opening_status) === '개설취소' && (!mgr || c.manager === mgr))
      setCardModal({ type: 'customers', title: `${mgr || ''} 개설취소 고객`, data })
    } else if (label === '오늘 일정') {
      setCardModal({ type: 'schedules', title: '오늘 일정', data: todayScheduleList })
    }
  }

  const statusBadgeColor = (status: string) => {
    const cat = categorizeStatus(status)
    if (cat === '개설완료') return 'bg-emerald-100 text-emerald-800'
    if (cat === '개설대기') return 'bg-amber-100 text-amber-800'
    if (cat === '개설진행') return 'bg-blue-100 text-blue-800'
    if (cat === '개설취소') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  // 이번 달 신규 인입 (정직한 보조지표)
  const now = new Date()
  const curMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const newThisMonth = allCustomers.filter((c) => c.reception_date?.startsWith(curMonthKey)).length
  const sharePct = (n: number) => (stats.totalCustomers ? Math.round((n / stats.totalCustomers) * 100) : 0)

  const cards: { label: string; value: number; Icon: any; tint: string; sub: string }[] = [
    { label: '전체 고객', value: stats.totalCustomers, Icon: Users, tint: 'green', sub: `이번 달 신규 +${newThisMonth}건` },
    { label: '개설 완료', value: stats.openedCustomers, Icon: UserCheck, tint: 'blue', sub: `전체의 ${sharePct(stats.openedCustomers)}%` },
    { label: '개설 대기', value: stats.waitingCustomers, Icon: Clock, tint: 'amber', sub: `전체의 ${sharePct(stats.waitingCustomers)}%` },
    { label: '개설 진행', value: stats.progressCustomers, Icon: RefreshCw, tint: 'sky', sub: `전체의 ${sharePct(stats.progressCustomers)}%` },
    { label: '개설 취소', value: stats.canceledCustomers, Icon: XCircle, tint: 'red', sub: `전체의 ${sharePct(stats.canceledCustomers)}%` },
    { label: '오늘 일정', value: stats.todaySchedules, Icon: Calendar, tint: 'violet', sub: '오늘 예정' },
  ]

  const quickActions: { label: string; desc: string; Icon: any; to: string; tint: string }[] = [
    { label: '고객 등록', desc: '새로운 고객 등록', Icon: UserPlus, to: '/customers', tint: 'blue' },
    { label: '일정 등록', desc: '새로운 일정 등록', Icon: CalendarPlus, to: '/calendar', tint: 'green' },
    { label: '보고서 조회', desc: '보고서 확인', Icon: FileBarChart, to: '/reports/periodic', tint: 'sky' },
    { label: '마케팅 캠페인', desc: '마케팅 캠페인 관리', Icon: Megaphone, to: '/marketing', tint: 'violet' },
    { label: 'AI 어시스턴트', desc: 'AI 도움 받기', Icon: Bot, to: '/ai-assistant', tint: 'indigo' },
    { label: '공유 문서함', desc: '문서 공유 관리', Icon: FolderOpen, to: '/documents', tint: 'green' },
  ]

  const assignTotal = monthlyAssignment.reduce((s, i) => s + i.total, 0)
  const assignMax = Math.max(1, ...monthlyAssignment.map((i) => i.total))

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{profile?.name || ''} 담당자님, 안녕하세요! 👋</h2>
          <p className="text-sm text-gray-500 mt-1.5">오늘도 고객과의 소중한 인연을 만들어가세요.</p>
        </div>
        <button onClick={() => navigate('/calendar')} className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition shrink-0">
          <Calendar size={16} className="text-gray-400" />
          {now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
        </button>
      </div>

      {/* 만료 예정 알림 */}
      {expiringCustomers.length > 0 && (
        <div className={`rounded-xl mb-5 overflow-hidden border ${expiringCustomers.some(c => c._daysLeft <= 7) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
          <button
            onClick={() => setShowExpiryAlert(!showExpiryAlert)}
            className="w-full flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <Bell size={16} className={expiringCustomers.some(c => c._daysLeft <= 7) ? 'text-red-500' : 'text-amber-500'} />
              <span className={`text-sm font-semibold ${expiringCustomers.some(c => c._daysLeft <= 7) ? 'text-red-700' : 'text-amber-700'}`}>
                만료 예정 고객 알림
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${expiringCustomers.some(c => c._daysLeft <= 7) ? 'bg-red-200 text-red-700' : 'bg-amber-200 text-amber-700'}`}>
                {expiringCustomers.length}건
              </span>
            </div>
            <ChevronDown size={16} className={`transition-transform text-gray-400 ${showExpiryAlert ? 'rotate-180' : ''}`} />
          </button>
          {showExpiryAlert && (
            <div className={`border-t divide-y ${expiringCustomers.some(c => c._daysLeft <= 7) ? 'border-red-200 divide-red-100' : 'border-amber-200 divide-amber-100'}`}>
              {expiringCustomers.map((c, i) => (
                <div
                  key={`${c.id}-${c._expiryField}-${i}`}
                  className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-white/60 transition"
                  onClick={() => navigate(`/customers/${c.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      c._daysLeft === 0 ? 'bg-red-600 text-white' :
                      c._daysLeft <= 7 ? 'bg-red-200 text-red-700' :
                      c._daysLeft <= 14 ? 'bg-orange-200 text-orange-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>
                      {c._daysLeft === 0 ? 'D-Day' : `D-${c._daysLeft}`}
                    </span>
                    <span className="text-sm font-medium text-gray-800">{c.customer_name}</span>
                    <span className="text-xs text-gray-500 bg-white/70 px-1.5 py-0.5 rounded">{c._expiryField}</span>
                  </div>
                  <span className="text-xs text-gray-400 shrink-0 ml-2">{c.manager || '-'}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AI 업무 요약 — 연한 초록 강조 / 오늘 캘린더 일정 기반 */}
      <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 mb-5">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-100 grid place-items-center shrink-0">
            <Sparkles size={20} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-2 mb-1.5">
              <span className="text-xs font-bold text-emerald-700">AI · 오늘의 업무 요약</span>
              <span className="text-[11px] text-emerald-600/70">· 오늘 캘린더 일정 기반 분석</span>
            </div>
            {aiLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <RefreshCw size={14} className="animate-spin" />
                AI가 오늘 일정을 분석하고 있습니다...
              </div>
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
            )}
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); sessionStorage.removeItem(cacheDateKey); loadAiSummary() }}
            disabled={aiLoading}
            className="w-9 h-9 rounded-lg bg-white border border-emerald-200 text-emerald-600 grid place-items-center hover:bg-emerald-100 transition shrink-0 disabled:opacity-50"
            title="다시 분석"
          >
            <RefreshCw size={16} className={aiLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-5">
        {cards.map((card) => {
          const t = TINT[card.tint]
          return (
            <div key={card.label}
              onClick={() => handleCardClick(card.label)}
              className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1.5 tabular-nums">{card.value.toLocaleString()}</p>
                </div>
                <div className={`w-11 h-11 rounded-full grid place-items-center shrink-0 ${t.bg}`}>
                  <card.Icon size={20} className={t.fg} />
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">{card.sub}</p>
            </div>
          )
        })}
      </div>

      {/* 행 1: 월별 추이 / 담당자 배정 / 내 담당 현황 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr] gap-5 mb-5">
        {/* 월별 신규 인입 추이 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800">월별 신규 인입 추이</h3>
          <div className="flex items-center gap-1.5 text-xs text-gray-500 mt-1 mb-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500"></span>신규 인입 수(건)
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 6, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef1f3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={34} allowDecimals={false} />
              <Tooltip formatter={(value: any) => [`${Number(value).toLocaleString()}건`, '신규 인입']} contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }} />
              <Bar dataKey="count" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={26} fillOpacity={0.9} />
              <Line type="monotone" dataKey="count" stroke="#047857" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* 당월 담당자 배정 현황 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800">담당자 배정 현황</h3>
            <span className="text-xs text-gray-400">{now.getMonth() + 1}월 기준</span>
          </div>
          {monthlyAssignment.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-sm">이번 달 배정된 고객이 없습니다.</p>
          ) : (
            <div className="space-y-3.5">
              {monthlyAssignment.slice(0, 5).map((it, idx) => {
                const share = assignTotal ? Math.round((it.total / assignTotal) * 100) : 0
                return (
                  <div key={it.name} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full grid place-items-center text-white text-xs font-bold shrink-0 ${AVATAR[idx % AVATAR.length]}`}>{it.name[0]}</span>
                    <span className="text-sm font-medium text-gray-700 w-14 shrink-0 truncate">{it.name}</span>
                    <span className="text-xs text-gray-500 w-9 shrink-0 text-right tabular-nums">{it.total}건</span>
                    <span className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <span className="block h-full bg-emerald-500 rounded-full" style={{ width: `${(it.total / assignMax) * 100}%` }} />
                    </span>
                    <span className="text-[11px] text-gray-400 w-8 text-right tabular-nums shrink-0">{share}%</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 내 담당 고객 현황 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-3">
            <UserCircle size={18} className="text-emerald-600" />
            <h3 className="font-bold text-gray-800">내 담당 고객 현황</h3>
          </div>
          {myStats.total > 0 ? (
            <>
              <p className="text-sm text-gray-500 mb-2.5">총 <b className="text-gray-800 text-lg tabular-nums">{myStats.total}</b>건</p>
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-3">
                {myStats.opened > 0 && <div className="bg-emerald-500" style={{ width: `${(myStats.opened / myStats.total) * 100}%` }} />}
                {myStats.waiting > 0 && <div className="bg-amber-400" style={{ width: `${(myStats.waiting / myStats.total) * 100}%` }} />}
                {myStats.progress > 0 && <div className="bg-blue-400" style={{ width: `${(myStats.progress / myStats.total) * 100}%` }} />}
                {myStats.canceled > 0 && <div className="bg-red-400" style={{ width: `${(myStats.canceled / myStats.total) * 100}%` }} />}
              </div>
              {([['개설완료', myStats.opened, 'bg-emerald-500'], ['개설대기', myStats.waiting, 'bg-amber-400'], ['개설진행', myStats.progress, 'bg-blue-400'], ['개설취소', myStats.canceled, 'bg-red-400']] as [string, number, string][]).map(([l, v, c]) => (
                <div key={l} className="flex items-center gap-2 py-1.5 border-t border-gray-50 first:border-t-0 text-sm text-gray-600">
                  <span className={`w-2 h-2 rounded-full ${c}`} />{l}<b className="ml-auto text-gray-800 tabular-nums">{v}</b>
                </div>
              ))}
            </>
          ) : (
            <p className="text-center py-8 text-gray-300 text-sm">담당 고객이 없습니다.</p>
          )}
        </div>
      </div>

      {/* 행 2: 오늘의 일정 / 최근 고객 / 빠른 작업 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 오늘의 일정 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-3">오늘의 일정</h3>
          {todayScheduleList.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-20 h-20 rounded-full bg-emerald-50 grid place-items-center mx-auto mb-4">
                <Calendar size={30} className="text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-gray-700">오늘 예정된 일정이 없습니다.</p>
              <p className="text-xs text-gray-400 mt-1">새로운 일정을 등록해보세요.</p>
              <button onClick={() => navigate('/calendar')} className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition">
                <CalendarPlus size={15} /> 일정 등록
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {todayScheduleList.map((s: any) => (
                <div key={s.id} className={`flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 ${s.is_done ? 'opacity-50' : ''}`}>
                  <span className="w-1.5 h-9 rounded-full bg-emerald-400 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-medium text-gray-800 truncate ${s.is_done ? 'line-through' : ''}`}>{s.title}</p>
                    <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Clock size={11} />{s.start_time?.slice(0, 5)} ~ {s.end_time?.slice(0, 5)}</p>
                  </div>
                  {s.is_done && <span className="text-xs text-emerald-600 font-medium shrink-0">완료</span>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 최근 고객 목록 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-800">최근 고객 목록</h3>
            <button onClick={() => navigate('/customers')} className="text-xs text-gray-400 hover:text-emerald-600 flex items-center gap-0.5">전체 보기 <ChevronRight size={12} /></button>
          </div>
          {recentCustomers.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-sm">등록된 고객이 없습니다.</p>
          ) : (
            <div className="space-y-1">
              {recentCustomers.map((c) => (
                <div key={c.id} onClick={() => navigate(`/customers/${c.id}`)} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer transition">
                  <span className="w-8 h-8 rounded-full bg-gray-100 grid place-items-center text-gray-400 shrink-0"><UserCircle size={18} /></span>
                  <span className="text-sm font-semibold text-gray-800 shrink-0">{c.customer_name}</span>
                  <span className="text-xs text-gray-400 flex-1 truncate tabular-nums">{c.business_number || '-'}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold shrink-0 ${statusBadgeColor(c.opening_status)}`}>{c.opening_status || '미정'}</span>
                  <span className="text-[11px] text-gray-400 shrink-0 w-12 text-right">{relTime(c.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 빠른 작업 */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-bold text-gray-800 mb-3">빠른 작업</h3>
          <div className="grid grid-cols-2 gap-2.5">
            {quickActions.map((a) => {
              const t = TINT[a.tint]
              return (
                <button key={a.label} onClick={() => navigate(a.to)} className="flex items-center gap-2.5 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 hover:-translate-y-0.5 transition text-left">
                  <span className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${t.bg}`}><a.Icon size={17} className={t.fg} /></span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-gray-800 truncate">{a.label}</span>
                    <span className="block text-[11px] text-gray-400 truncate">{a.desc}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 카드 클릭 모달 */}
      {cardModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCardModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">{cardModal.title}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{cardModal.data.length}건</p>
              </div>
              <button onClick={() => setCardModal(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              {cardModal.type === 'schedules' ? (
                // 오늘 일정
                <div className="divide-y divide-gray-50">
                  {cardModal.data.length === 0 ? (
                    <p className="text-center py-10 text-gray-300 text-sm">오늘 등록된 일정이 없습니다.</p>
                  ) : (
                    cardModal.data.map((s: any) => (
                      <div key={s.id} className={`px-5 py-3 ${s.is_done ? 'opacity-50' : ''}`}>
                        <div className="flex items-center justify-between">
                          <span className={`font-medium text-sm text-gray-800 ${s.is_done ? 'line-through' : ''}`}>{s.title}</span>
                          {s.is_done && <span className="text-xs text-emerald-600 font-medium">완료</span>}
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-500">{s.start_time?.slice(0, 5)} ~ {s.end_time?.slice(0, 5)}</span>
                        </div>
                        {s.description && <p className="text-xs text-gray-400 mt-1">{s.description}</p>}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                // 고객 목록
                <div className="divide-y divide-gray-50">
                  {cardModal.data.length === 0 ? (
                    <p className="text-center py-10 text-gray-300 text-sm">해당 고객이 없습니다.</p>
                  ) : (
                    cardModal.data.map((c: any) => (
                      <div key={c.id} className="px-5 py-3 hover:bg-gray-50 transition cursor-pointer" onClick={() => { setCardModal(null); navigate(`/customers/${c.id}`) }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-emerald-600">{c.customer_name}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor(c.opening_status)}`}>
                            {c.opening_status || '미정'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.customer_number || '-'} · {c.business_number || '-'} · {c.manager || '-'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
