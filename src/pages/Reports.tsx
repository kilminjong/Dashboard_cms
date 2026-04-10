import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { FileBarChart, TrendingUp, Users, Calendar } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

const PIE_COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444']

export default function Reports() {
  const [period, setPeriod] = useState<Period>('weekly')
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const { data } = await supabase
      .from('customers')
      .select('opening_status, manager, reception_date, opening_date, connection_status, erp_company')
      .range(0, 9999)
    setCustomers(data || [])
    setLoading(false)
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]

  // 기간별 신규 접수 데이터 생성
  const getPeriodData = () => {
    if (period === 'daily') {
      // 최근 14일
      const days: { label: string; count: number }[] = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
        const key = d.toISOString().split('T')[0]
        const label = `${d.getMonth() + 1}/${d.getDate()}`
        days.push({ label, count: customers.filter((c) => c.reception_date === key).length })
      }
      return days
    } else if (period === 'weekly') {
      // 최근 8주
      const weeks: { label: string; count: number }[] = []
      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (i * 7) - now.getDay() + 1)
        const weekEnd = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 6)
        const startStr = weekStart.toISOString().split('T')[0]
        const endStr = weekEnd.toISOString().split('T')[0]
        const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()}~${weekEnd.getMonth() + 1}/${weekEnd.getDate()}`
        weeks.push({
          label,
          count: customers.filter((c) => c.reception_date >= startStr && c.reception_date <= endStr).length,
        })
      }
      return weeks
    } else if (period === 'monthly') {
      // 최근 12개월
      const months: { label: string; count: number }[] = []
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        months.push({ label: `${d.getMonth() + 1}월`, count: customers.filter((c) => c.reception_date?.startsWith(key)).length })
      }
      return months
    } else {
      // 최근 5년
      const years: { label: string; count: number }[] = []
      for (let i = 4; i >= 0; i--) {
        const y = now.getFullYear() - i
        years.push({ label: `${y}년`, count: customers.filter((c) => c.reception_date?.startsWith(String(y))).length })
      }
      return years
    }
  }

  // 이번 주 신규
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const thisWeekNew = customers.filter((c) => c.reception_date >= weekStartStr && c.reception_date <= today).length

  // 이번 달 신규
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const thisMonthNew = customers.filter((c) => c.reception_date?.startsWith(thisMonthKey)).length

  // 지난달 신규
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
  const lastMonthNew = customers.filter((c) => c.reception_date?.startsWith(lastMonthKey)).length

  // 올해 신규
  const thisYearNew = customers.filter((c) => c.reception_date?.startsWith(String(now.getFullYear()))).length

  // 개설 상태 분포
  const statusCounts = [
    { name: '개설완료', value: customers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length },
    { name: '개설대기', value: customers.filter((c) => c.opening_status === '개설대기').length },
    { name: '개설진행', value: customers.filter((c) => c.opening_status === '개설진행').length },
    { name: '개설취소', value: customers.filter((c) => c.opening_status === '개설취소').length },
  ]

  // 담당자별 TOP 10
  const managerMap: Record<string, number> = {}
  customers.forEach((c) => { if (c.manager) managerMap[c.manager] = (managerMap[c.manager] || 0) + 1 })
  const managerTop = Object.entries(managerMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  // ERP 회사별 분포
  const erpMap: Record<string, number> = {}
  customers.forEach((c) => { if (c.erp_company) erpMap[c.erp_company] = (erpMap[c.erp_company] || 0) + 1 })
  const erpTop = Object.entries(erpMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

  // 연계 상태 분포
  const connMap: Record<string, number> = {}
  customers.forEach((c) => { if (c.connection_status) connMap[c.connection_status] = (connMap[c.connection_status] || 0) + 1 })
  const connData = Object.entries(connMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))

  const periodData = getPeriodData()

  if (loading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">보고서</h2>
          <p className="text-sm text-gray-400 mt-0.5">CMS 고객 데이터 기반 현황 분석</p>
        </div>
        <p className="text-xs text-gray-400">기준일: {today}</p>
      </div>

      {/* 핵심 지표 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2.5 rounded-lg"><TrendingUp size={18} className="text-blue-600" /></div>
            <div>
              <p className="text-xs text-gray-500">이번 주 신규</p>
              <p className="text-xl font-bold text-gray-800">{thisWeekNew.toLocaleString()}<span className="text-sm font-normal text-gray-400">건</span></p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-50 p-2.5 rounded-lg"><Calendar size={18} className="text-emerald-600" /></div>
            <div>
              <p className="text-xs text-gray-500">이번 달 신규</p>
              <p className="text-xl font-bold text-gray-800">{thisMonthNew.toLocaleString()}<span className="text-sm font-normal text-gray-400">건</span></p>
              {lastMonthNew > 0 && (
                <p className={`text-xs ${thisMonthNew >= lastMonthNew ? 'text-emerald-500' : 'text-red-500'}`}>
                  전월 대비 {thisMonthNew >= lastMonthNew ? '+' : ''}{thisMonthNew - lastMonthNew}건
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-purple-50 p-2.5 rounded-lg"><FileBarChart size={18} className="text-purple-600" /></div>
            <div>
              <p className="text-xs text-gray-500">올해 누적</p>
              <p className="text-xl font-bold text-gray-800">{thisYearNew.toLocaleString()}<span className="text-sm font-normal text-gray-400">건</span></p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="bg-amber-50 p-2.5 rounded-lg"><Users size={18} className="text-amber-600" /></div>
            <div>
              <p className="text-xs text-gray-500">전체 고객</p>
              <p className="text-xl font-bold text-gray-800">{customers.length.toLocaleString()}<span className="text-sm font-normal text-gray-400">건</span></p>
            </div>
          </div>
        </div>
      </div>

      {/* 신규 접수 추이 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">신규 접수 추이 (reception_date 기준)</h3>
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간'], ['yearly', '연간']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${period === key ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={periodData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <YAxis tick={{ fontSize: 11 }} stroke="#9ca3af" />
            <Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} />
            <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 하단 차트 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* 개설 상태 분포 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">개설 상태 분포</h3>
          <div className="flex items-center">
            <ResponsiveContainer width="50%" height={180}>
              <PieChart>
                <Pie data={statusCounts} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                  {statusCounts.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-1/2 space-y-2">
              {statusCounts.map((s, i) => (
                <div key={s.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }}></div>
                    <span className="text-sm text-gray-600">{s.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-800">{s.value.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 담당자별 고객 수 TOP 10 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">담당자별 고객 수 TOP 10</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={managerTop} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={60} />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} />
              <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* ERP 회사별 분포 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">ERP 회사별 분포</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={erpTop}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
              <Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} />
              <Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 연계 상태 분포 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h3 className="font-semibold text-gray-800 mb-4">연계 상태 분포</h3>
          <div className="space-y-2">
            {connData.map((item) => {
              const pct = customers.length > 0 ? (item.count / customers.length) * 100 : 0
              return (
                <div key={item.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-600">{item.name}</span>
                    <span className="text-xs font-semibold text-gray-800">{item.count.toLocaleString()}건 ({pct.toFixed(1)}%)</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }}></div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
