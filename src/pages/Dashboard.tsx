import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, UserCheck, UserX, Calendar, Sparkles, RefreshCw } from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
} from 'recharts'

interface Stats {
  totalCustomers: number
  openedCustomers: number
  pendingCustomers: number
  todaySchedules: number
}

interface MonthlyData {
  month: string
  count: number
}

const PIE_COLORS = ['#059669', '#f59e0b']

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    openedCustomers: 0,
    pendingCustomers: 0,
    todaySchedules: 0,
  })
  const [recentCustomers, setRecentCustomers] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([])
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => {
    loadStats()
    loadRecentCustomers()
    loadMonthlyTrend()
    loadAiSummary()
  }, [])

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [customers, schedules] = await Promise.all([
      supabase.from('customers').select('opening_status').range(0, 9999),
      supabase.from('schedules').select('id', { count: 'exact', head: true })
        .eq('start_date', today),
    ])

    const list = customers.data || []
    setStats({
      totalCustomers: list.length,
      openedCustomers: list.filter((c) => c.opening_status === '개설완료').length,
      pendingCustomers: list.filter((c) => c.opening_status !== '개설완료').length,
      todaySchedules: schedules.count || 0,
    })
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
      .select('created_at')
      .order('created_at', { ascending: true })
      .range(0, 9999)

    if (!data) return

    // 최근 6개월 기준 월별 집계
    const now = new Date()
    const months: MonthlyData[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = `${d.getMonth() + 1}월`
      const count = data.filter((c) => c.created_at?.startsWith(key)).length
      months.push({ month: label, count })
    }
    setMonthlyData(months)
  }

  const loadAiSummary = async () => {
    setAiLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: schedules } = await supabase
        .from('schedules')
        .select('title, description')
        .eq('start_date', today)

      const { data: recentCustomers } = await supabase
        .from('customers')
        .select('customer_name, opening_status')
        .order('created_at', { ascending: false })
        .limit(5)

      // Edge Function 호출
      const { data, error } = await supabase.functions.invoke('ai-summary', {
        body: {
          todaySchedules: schedules || [],
          recentCustomers: recentCustomers || [],
          date: today,
        },
      })

      if (error) throw error
      setAiSummary(data?.summary || '오늘의 업무 요약을 불러올 수 없습니다.')
    } catch {
      setAiSummary('AI 요약을 불러올 수 없습니다. Edge Function 설정을 확인해주세요.')
    }
    setAiLoading(false)
  }

  const pieData = [
    { name: '개설완료', value: stats.openedCustomers },
    { name: '미개설', value: stats.pendingCustomers },
  ]

  const cards = [
    { label: '전체 고객', value: stats.totalCustomers, icon: Users, color: 'bg-blue-500', textColor: 'text-blue-600' },
    { label: '개설 완료', value: stats.openedCustomers, icon: UserCheck, color: 'bg-emerald-500', textColor: 'text-emerald-600' },
    { label: '미개설', value: stats.pendingCustomers, icon: UserX, color: 'bg-orange-500', textColor: 'text-orange-600' },
    { label: '오늘 일정', value: stats.todaySchedules, icon: Calendar, color: 'bg-purple-500', textColor: 'text-purple-600' },
  ]

  const openedRate = stats.totalCustomers > 0
    ? Math.round((stats.openedCustomers / stats.totalCustomers) * 100)
    : 0

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

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
            onClick={loadAiSummary}
            disabled={aiLoading}
            className="p-1.5 text-emerald-500 hover:text-emerald-700 hover:bg-emerald-100 rounded-lg transition"
            title="다시 분석"
          >
            <RefreshCw size={16} className={aiLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
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

      {/* 차트 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 도넛 차트 - 개설 비율 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">개설 현황</h3>
          <div className="flex items-center">
            <div className="w-1/2">
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value).toLocaleString()}건`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-emerald-600">{openedRate}%</p>
                <p className="text-sm text-gray-500">개설 완료율</p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                  <span className="text-sm text-gray-600">개설완료 {stats.openedCustomers.toLocaleString()}건</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                  <span className="text-sm text-gray-600">미개설 {stats.pendingCustomers.toLocaleString()}건</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 라인 차트 - 월별 신규 등록 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">월별 신규 등록 추이</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 12 }} stroke="#9ca3af" />
              <Tooltip formatter={(value) => `${Number(value).toLocaleString()}건`} />
              <Line
                type="monotone"
                dataKey="count"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ fill: '#059669', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
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
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-800">{c.customer_name}</td>
                    <td className="px-6 py-4 text-gray-600">{c.business_number || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        c.opening_status === '개설완료'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}>
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
              <div key={c.id} className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-gray-800">{c.customer_name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    c.opening_status === '개설완료'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-orange-100 text-orange-800'
                  }`}>
                    {c.opening_status || '미정'}
                  </span>
                </div>
                <p className="text-sm text-gray-500">{c.manager || '-'} · {new Date(c.created_at).toLocaleDateString('ko-KR')}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
