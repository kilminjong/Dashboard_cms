import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  LayoutDashboard,
  Users,
  Calendar,
  UserCog,
  LogOut,
  Menu,
  X,
  Bot,
  FolderOpen,
  FileBarChart,
  ChevronDown,
  TrendingUp,
} from 'lucide-react'
import { useState } from 'react'
import { useNotification } from '../../hooks/useNotification'
import { useAutoBackup } from '../../hooks/useAutoBackup'
import { useAuth } from '../../hooks/useAuth'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '대시보드' },
  {
    label: '고객정보관리', icon: Users, children: [
      { to: '/customers', label: '고객 원장 정보' },
      { to: '/customers/detail-search', label: '고객 상세 정보' },
    ],
  },
  {
    label: '보고서', icon: FileBarChart, children: [
      { to: '/reports/periodic', label: '업무 보고서' },
      { to: '/reports/manager', label: '담당자 실적' },
      { to: '/reports/unopened', label: '미개설 관리' },
      { to: '/reports/marketing', label: '마케팅 보고서' },
    ],
  },
  { to: '/marketing', icon: TrendingUp, label: '마케팅' },
  { to: '/ai-assistant', icon: Bot, label: 'AI 어시스턴트' },
  { to: '/documents', icon: FolderOpen, label: '공유 문서함' },
  { to: '/calendar', icon: Calendar, label: '캘린더' },
  { to: '/profile', icon: UserCog, label: '정보수정' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedMenu, setExpandedMenu] = useState<string | null>(
    location.pathname.startsWith('/customers') ? '고객정보관리' : location.pathname.startsWith('/reports') ? '보고서' : null
  )
  useNotification()
  useAutoBackup()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const toggleSubmenu = (label: string) => {
    setExpandedMenu(expandedMenu === label ? null : label)
  }

  const isMenuActive = (item: any) => {
    if (item.to) return location.pathname === item.to
    if (item.children) return item.children.some((c: any) => location.pathname === c.to || location.pathname.startsWith(c.to + '/'))
    return false
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-800 to-slate-900 transform transition-transform duration-200 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        {/* 로고 */}
        <div className="flex items-center justify-between h-16 px-5">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">webcash</h1>
            <p className="text-[10px] text-slate-400 -mt-0.5">하나CMS팀</p>
          </div>
          <button className="lg:hidden p-1 text-emerald-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="px-3 py-4 space-y-0.5 flex-1">
          {navItems.map((item) => {
            if (item.children) {
              const isExpanded = expandedMenu === item.label
              const isActive = isMenuActive(item)
              return (
                <div key={item.label}>
                  <button
                    onClick={() => toggleSubmenu(item.label)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive ? 'bg-slate-700/50 text-white' : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} />
                      {item.label}
                    </div>
                    <ChevronDown size={14} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>
                  {isExpanded && (
                    <div className="ml-4 mt-0.5 space-y-0.5">
                      {item.children.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          end
                          onClick={() => setSidebarOpen(false)}
                          className={({ isActive }) =>
                            `flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                              isActive
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
                            }`
                          }
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></div>
                          {child.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              )
            }

            return (
              <NavLink
                key={item.to}
                to={item.to!}
                end={item.to === '/'}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-sm shadow-sm'
                      : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* 로그아웃 */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-slate-700/50">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {(profile?.name || '?')[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{profile?.name || '사용자'}</p>
              <p className="text-xs text-slate-400 truncate">{profile?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-sm font-medium text-slate-400 hover:bg-red-500/20 hover:text-red-300 transition-colors"
          >
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8 shrink-0">
          <button
            className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg mr-3"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <div className="text-sm text-gray-500">webcash 하나CMS팀 관리 시스템</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
