import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  BarChart3,
  Users,
  MessageSquare,
  Database,
  Contact,
  FileText,
  Settings,
  LogOut,
  UserCog,
  ScrollText,
  Target,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { BRANCH_LABELS } from '@/types'

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: '대시보드' },
  { path: '/statistics', icon: BarChart3, label: '통계 분석' },
  { path: '/customers', icon: Users, label: '고객정보 관리' },
  { path: '/voc', icon: MessageSquare, label: 'VOC 대상 고객' },
  { path: '/erp-master', icon: Database, label: 'ERP 업체/상품 관리' },
  { path: '/key-contacts', icon: Contact, label: '핵심 인력 연락처' },
  { path: '/reports', icon: FileText, label: '보고서' },
]

export default function Sidebar() {
  const { user, logout, pendingCount } = useAuthStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'

  return (
    <aside className="w-64 bg-bg-sidebar min-h-screen flex flex-col text-white">
      {/* 로고 영역 */}
      <div className="p-6 border-b border-gray-700">
        <h1 className="text-lg font-bold">DB Branch</h1>
        <p className="text-sm text-gray-400 mt-1">고객현황 관리</p>
      </div>

      {/* 사용자 정보 */}
      <div className="px-6 py-4 border-b border-gray-700">
        <p className="text-sm font-medium">{user?.name}</p>
        <p className="text-xs text-gray-400">
          {user?.role === 'SUPER_ADMIN' ? '최고관리자' :
           user?.role === 'BRANCH_ADMIN' ? '브랜치관리자' :
           user?.role === 'BRANCH_USER' ? '일반사용자' : '조회전용'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">
          {user?.branch ? BRANCH_LABELS[user.branch] : '전체 브랜치'}
          {user?.position ? ` · ${user.position}` : ''}
        </p>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1 px-3">
          {menuItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-bg-sidebar-active text-white'
                      : 'text-gray-300 hover:bg-bg-sidebar-hover hover:text-white'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* 관리자 메뉴 */}
        {isSuperAdmin && (
          <>
            <div className="mx-6 my-3 border-t border-gray-700" />
            <p className="px-6 text-xs text-gray-500 uppercase tracking-wider mb-2">시스템 관리</p>
            <ul className="space-y-1 px-3">
              <li>
                <NavLink
                  to="/system"
                  end
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sidebar-active text-white'
                        : 'text-gray-300 hover:bg-bg-sidebar-hover hover:text-white'
                    }`
                  }
                >
                  <Settings size={18} />
                  관리 대시보드
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/system/users"
                  className={({ isActive }) =>
                    `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sidebar-active text-white'
                        : 'text-gray-300 hover:bg-bg-sidebar-hover hover:text-white'
                    }`
                  }
                >
                  <span className="flex items-center gap-3">
                    <UserCog size={18} />
                    사용자 관리
                  </span>
                  {pendingCount > 0 && (
                    <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                      {pendingCount}
                    </span>
                  )}
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/system/targets"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sidebar-active text-white'
                        : 'text-gray-300 hover:bg-bg-sidebar-hover hover:text-white'
                    }`
                  }
                >
                  <Target size={18} />
                  목표 관리
                </NavLink>
              </li>
              <li>
                <NavLink
                  to="/system/logs"
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      isActive
                        ? 'bg-bg-sidebar-active text-white'
                        : 'text-gray-300 hover:bg-bg-sidebar-hover hover:text-white'
                    }`
                  }
                >
                  <ScrollText size={18} />
                  접근 로그
                </NavLink>
              </li>
            </ul>
          </>
        )}
      </nav>

      {/* 로그아웃 */}
      <div className="p-3 border-t border-gray-700">
        <button
          onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-gray-300 hover:bg-bg-sidebar-hover hover:text-white transition-colors"
        >
          <LogOut size={18} />
          로그아웃
        </button>
      </div>
    </aside>
  )
}
