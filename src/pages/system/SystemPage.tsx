import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { Users, Clock, UserCheck, Activity } from 'lucide-react'

export default function SystemPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    pendingCount: 0,
    todayLogins: 0,
    monthChanges: 0,
  })
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true)

      const [
        { count: totalUsers },
        { count: activeUsers },
        { count: pendingCount },
        { count: todayLogins },
        { count: monthChanges },
      ] = await Promise.all([
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('access_logs').select('*', { count: 'exact', head: true })
          .eq('action_type', 'LOGIN')
          .gte('created_at', new Date().toISOString().slice(0, 10)),
        supabase.from('access_logs').select('*', { count: 'exact', head: true })
          .in('action_type', ['CUSTOMER_CREATE', 'CUSTOMER_UPDATE', 'CUSTOMER_DELETE'])
          .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
      ])

      setStats({
        totalUsers: totalUsers ?? 0,
        activeUsers: activeUsers ?? 0,
        pendingCount: pendingCount ?? 0,
        todayLogins: todayLogins ?? 0,
        monthChanges: monthChanges ?? 0,
      })
      setIsLoading(false)
    }
    fetchStats()
  }, [])

  const cards = [
    {
      title: '전체 / 활성 사용자',
      value: `${stats.totalUsers} / ${stats.activeUsers}`,
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      onClick: () => navigate('/system/users'),
    },
    {
      title: '승인 대기',
      value: stats.pendingCount,
      icon: UserCheck,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      onClick: () => navigate('/system/users?tab=pending'),
      badge: stats.pendingCount > 0,
    },
    {
      title: '오늘 로그인 수',
      value: stats.todayLogins,
      icon: Activity,
      color: 'text-green-600',
      bg: 'bg-green-50',
      onClick: () => navigate('/system/logs'),
    },
    {
      title: '이번 달 데이터 변경',
      value: stats.monthChanges,
      icon: Clock,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      onClick: () => navigate('/system/logs'),
    },
  ]

  return (
    <div>
      <Header title="시스템 관리" />
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
              {cards.map((card) => (
                <button
                  key={card.title}
                  onClick={card.onClick}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-shadow text-left relative"
                >
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${card.bg}`}>
                    <card.icon size={24} className={card.color} />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">{card.title}</p>
                    <p className="text-2xl font-bold text-gray-800">{card.value}</p>
                  </div>
                  {card.badge && (
                    <span className="absolute top-3 right-3 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => navigate('/system/users')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow text-left"
              >
                <h3 className="font-semibold text-gray-800 mb-2">사용자 관리</h3>
                <p className="text-sm text-gray-500">사용자 계정 승인, 역할 배정, 브랜치 관리</p>
              </button>
              <button
                onClick={() => navigate('/system/logs')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow text-left"
              >
                <h3 className="font-semibold text-gray-800 mb-2">접근 로그</h3>
                <p className="text-sm text-gray-500">시스템 접근 및 데이터 변경 이력 조회</p>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
