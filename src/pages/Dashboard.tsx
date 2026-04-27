import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCustomers } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { useNavigate } from 'react-router-dom'
import { Users, UserCheck, Calendar, Sparkles, RefreshCw, Clock, XCircle, UserCircle, X, Bell, ChevronDown } from 'lucide-react'
import {
  ResponsiveContainer, Tooltip,
  XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
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
  const [myRecentCustomers, setMyRecentCustomers] = useState<any[]>([])
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
      setMyRecentCustomers(
        myList
          .sort((a, b) => (b.reception_date || '').localeCompare(a.reception_date || ''))
          .slice(0, 5)
      )
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

      // 오늘 캘린더 일정 (시간 + 완료 상태 포함)
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

  const cards = [
    { label: '전체 고객', value: stats.totalCustomers, icon: Users, color: 'bg-blue-500' },
    { label: '개설 완료', value: stats.openedCustomers, icon: UserCheck, color: 'bg-emerald-500' },
    { label: '개설 대기', value: stats.waitingCustomers, icon: Clock, color: 'bg-amber-500' },
    { label: '개설 진행', value: stats.progressCustomers, icon: RefreshCw, color: 'bg-blue-400' },
    { label: '개설 취소', value: stats.canceledCustomers, icon: XCircle, color: 'bg-red-500' },
    { label: '오늘 일정', value: stats.todaySchedules, icon: Calendar, color: 'bg-purple-500' },
  ]


  const statusBadgeColor = (status: string) => {
    const cat = categorizeStatus(status)
    if (cat === '개설완료') return 'bg-emerald-100 text-emerald-800'
    if (cat === '개설대기') return 'bg-amber-100 text-amber-800'
    if (cat === '개설진행') return 'bg-blue-100 text-blue-800'
    if (cat === '개설취소') return 'bg-red-100 text-red-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

      {/* 만료 예정 알림 */}
      {expiringCustomers.length > 0 && (
        <div className={`rounded-xl mb-6 overflow-hidden border ${expiringCustomers.some(c => c._daysLeft <= 7) ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
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

      {/* AI 업무 요약 */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className="bg-emerald-100 p-2 rounded-lg mt-0.5">
              <Sparkles size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-emerald-700 mb-1">AI 오늘의 업무 요약</p>
              {aiLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <RefreshCw size={14} className="animate-spin" />
                  AI가 오늘 일정을 분석하고 있습니다...
                </div>
              ) : (
                <p className="text-sm text-gray-700 leading-relaxed">{aiSummary}</p>
              )}
            </div>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem(cacheKey); sessionStorage.removeItem(cacheDateKey); loadAiSummary() }}
            disabled={aiLoading}
            className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
            title="다시 분석"
          >
            <RefreshCw size={16} className={aiLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label}
            onClick={() => handleCardClick(card.label)}
            className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-gray-200 transition">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {card.value.toLocaleString()}
                </p>
              </div>
              <div className={`${card.color} p-3 rounded-lg`}>
                <card.icon size={22} className="text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 내 담당 고객 현황 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <UserCircle size={20} className="text-emerald-600" />
          <h3 className="font-semibold text-gray-800">{profile?.name || '나'}의 담당 고객 현황</h3>
          <span className="text-xs text-gray-400 ml-1">총 {myStats.total.toLocaleString()}건</span>
        </div>

        {myStats.total > 0 ? (
          <>
            {/* 상태 바 */}
            <div className="flex h-3 rounded-full overflow-hidden mb-3 bg-gray-100">
              {myStats.opened > 0 && <div className="bg-emerald-500" style={{ width: `${(myStats.opened / myStats.total) * 100}%` }} />}
              {myStats.waiting > 0 && <div className="bg-amber-400" style={{ width: `${(myStats.waiting / myStats.total) * 100}%` }} />}
              {myStats.progress > 0 && <div className="bg-blue-400" style={{ width: `${(myStats.progress / myStats.total) * 100}%` }} />}
              {myStats.canceled > 0 && <div className="bg-red-400" style={{ width: `${(myStats.canceled / myStats.total) * 100}%` }} />}
            </div>

            {/* 상태별 수치 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="text-sm text-gray-600">개설완료 <strong className="text-gray-800">{myStats.opened}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                <span className="text-sm text-gray-600">개설대기 <strong className="text-gray-800">{myStats.waiting}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-400"></div>
                <span className="text-sm text-gray-600">개설진행 <strong className="text-gray-800">{myStats.progress}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                <span className="text-sm text-gray-600">개설취소 <strong className="text-gray-800">{myStats.canceled}</strong></span>
              </div>
            </div>

            {/* 내 최근 고객 */}
            {myRecentCustomers.length > 0 && (
              <div className="border-t border-gray-100 pt-3">
                <p className="text-xs text-gray-400 mb-2">최근 등록된 내 담당 고객</p>
                <div className="space-y-1.5">
                  {myRecentCustomers.map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <button
                        onClick={() => navigate(`/customers/${c.id}`)}
                        className="text-sm text-emerald-600 font-medium hover:underline truncate"
                      >
                        {c.customer_name}
                      </button>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2 ${statusBadgeColor(c.opening_status)}`}>
                        {c.opening_status || '미정'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm text-gray-400">담당 고객이 없습니다.</p>
            <p className="text-xs text-gray-300 mt-1">고객정보관리에서 담당자로 지정되면 여기에 표시됩니다.</p>
          </div>
        )}
      </div>

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 당월 담당자 배정 현황 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-800">당월 담당자 배정 현황</h3>
            <span className="text-xs text-gray-400">{new Date().getMonth() + 1}월 기준</span>
          </div>
          {monthlyAssignment.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-sm">이번 달 배정된 고객이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {monthlyAssignment.map((item) => (
                <div key={item.name} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {item.name[0]}
                    </div>
                    <span className="text-sm font-medium text-gray-800">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-800">{item.total}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span></p>
                    </div>
                    {item.linked > 0 && (
                      <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">연계형 {item.linked}건</span>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-2">
                <span className="text-sm font-semibold text-gray-600">합계</span>
                <span className="text-sm font-bold text-gray-800">{monthlyAssignment.reduce((s, i) => s + i.total, 0)}건</span>
              </div>
            </div>
          )}
        </div>

        {/* 월별 신규 인입 추이 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-1">월별 신규 인입 추이</h3>
          <p className="text-xs text-gray-400 mb-4">신규접수일(reception_date) 기준 · 최근 12개월</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
              <Tooltip formatter={(value) => `${Number(value).toLocaleString()}건`} />
              <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 최근 등록 고객 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">최근 등록 고객</h3>
        </div>

        {/* 데스크탑 */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">고객명</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">사업자번호</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">개설상태</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">담당자</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-500 uppercase">등록일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentCustomers.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">등록된 고객이 없습니다</td></tr>
              ) : (
                recentCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/customers/${c.id}`)}>
                    <td className="px-6 py-4 font-medium text-emerald-600 hover:underline">{c.customer_name}</td>
                    <td className="px-6 py-4 text-gray-600">{c.business_number || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeColor(c.opening_status)}`}>
                        {c.opening_status || '미정'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{c.manager || '-'}</td>
                    <td className="px-6 py-4 text-gray-500 text-sm">
                      {new Date(c.created_at).toLocaleDateString('ko-KR')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 모바일 */}
        <div className="md:hidden divide-y divide-gray-100">
          {recentCustomers.length === 0 ? (
            <p className="text-center py-8 text-gray-400">등록된 고객이 없습니다</p>
          ) : (
            recentCustomers.map((c) => (
              <div key={c.id} className="p-4 cursor-pointer hover:bg-gray-50 transition" onClick={() => navigate(`/customers/${c.id}`)}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-emerald-600">{c.customer_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeColor(c.opening_status)}`}>
                    {c.opening_status || '미정'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{c.manager || '-'} · {new Date(c.created_at).toLocaleDateString('ko-KR')}</p>
              </div>
            ))
          )}
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
