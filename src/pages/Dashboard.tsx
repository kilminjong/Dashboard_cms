import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Users, UserCheck, UserX, Calendar } from 'lucide-react'

interface Stats {
  totalCustomers: number
  openedCustomers: number
  pendingCustomers: number
  todaySchedules: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    totalCustomers: 0,
    openedCustomers: 0,
    pendingCustomers: 0,
    todaySchedules: 0,
  })
  const [recentCustomers, setRecentCustomers] = useState<any[]>([])

  useEffect(() => {
    loadStats()
    loadRecentCustomers()
  }, [])

  const loadStats = async () => {
    const today = new Date().toISOString().split('T')[0]

    const [customers, schedules] = await Promise.all([
      supabase.from('customers').select('opening_status'),
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

  const cards = [
    { label: '전체 고객', value: stats.totalCustomers, icon: Users, color: 'bg-blue-500' },
    { label: '개설 완료', value: stats.openedCustomers, icon: UserCheck, color: 'bg-emerald-500' },
    { label: '미개설', value: stats.pendingCustomers, icon: UserX, color: 'bg-orange-500' },
    { label: '오늘 일정', value: stats.todaySchedules, icon: Calendar, color: 'bg-purple-500' },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

      {/* 통계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
