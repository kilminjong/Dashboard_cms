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
  ClipboardList,
  PanelLeft,
  Rocket,
} from 'lucide-react'
import { useState } from 'react'
import { useNotification } from '../../hooks/useNotification'
import { useAutoBackup } from '../../hooks/useAutoBackup'
import { useAuth } from '../../hooks/useAuth'
import QuickMemo from '../QuickMemo'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '대시보드' },
  {
    label: '고객정보관리', icon: Users, children: [
      { to: '/customers', label: '고객 원장 정보' },
      { to: '/customers/detail-search', label: '고객 상세 정보' },
    ],
  },
  {
    label: '업무 관리', icon: ClipboardList, children: [
      { to: '/todo', label: '할 일 · 후속조치' },
      { to: '/renewals', label: '갱신 · 만료 관리' },
      { to: '/connections', label: '연계 현황 보드' },
    ],
  },
  {
    label: '브랜치Q 고객관리', icon: Rocket, children: [
      { to: '/branchq', label: 'POC 대상고객' },
      { to: '/branchq/status', label: 'POC 진행 현황' },
      { to: '/branchq/test', label: '브랜치Q 테스트 관리' },
      {
        label: '구글폼 관리', children: [
          { to: '/branchq/form', label: '구글폼 대시보드' },
          { to: '/branchq/form/detail', label: '상세관리' },
          { to: '/branchq/form/send', label: '설문 발송 관리' },
          { to: '/branchq/form/log', label: '발송 이력' },
        ],
      },
      { to: '/branchq/notes', label: '안내·문의 현황' },
      { to: '/branchq/voc', label: 'VOC 확인' },
      { to: '/branchq/guides', label: '고객 안내 메뉴얼' },
    ],
  },
  {
    label: '보고서', icon: FileBarChart, children: [
      { to: '/reports/builder', label: '커스텀 보고서' },
      { section: 'KPI' },
      { to: '/kpi', label: 'KPI 현황' },
      { to: '/kpi-settings', label: 'KPI 목표 설정' },
    ],
  },
  { to: '/marketing', icon: TrendingUp, label: '마케팅' },
  { to: '/ai-assistant', icon: Bot, label: 'AI 어시스턴트', disabled: true },
  { to: '/documents', icon: FolderOpen, label: '공유 문서함' },
  { to: '/calendar', icon: Calendar, label: '캘린더' },
  { to: '/profile', icon: UserCog, label: '정보수정' },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('sidebarCollapsed') === '1')
  const toggleCollapsed = () => setCollapsed((v) => { const n = !v; localStorage.setItem('sidebarCollapsed', n ? '1' : '0'); return n })
  const [expandedMenu, setExpandedMenu] = useState<string | null>(
    location.pathname.startsWith('/customers') ? '고객정보관리' : (location.pathname.startsWith('/todo') || location.pathname.startsWith('/renewals') || location.pathname.startsWith('/connections')) ? '업무 관리' : location.pathname.startsWith('/branchq') ? '브랜치Q 고객관리' : (location.pathname.startsWith('/reports') || location.pathname.startsWith('/kpi')) ? '보고서' : null
  )
  // 2뎁스 하위그룹(3뎁스 보유) 펼침 상태 — 예: '구글폼 관리'
  const [expandedSub, setExpandedSub] = useState<string | null>(
    location.pathname.startsWith('/branchq/form') ? '구글폼 관리' : null
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
  const toggleSub = (label: string) => {
    setExpandedSub(expandedSub === label ? null : label)
  }

  // 재귀적으로 하위 경로가 현재 활성인지 판단 (2·3뎁스 모두)
  const isMenuActive = (item: any): boolean => {
    if (item.to) return location.pathname === item.to || location.pathname.startsWith(item.to + '/')
    if (item.children) return item.children.some((c: any) => isMenuActive(c))
    return false
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 사이드바 */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-800 to-slate-900 transform transition-transform duration-200 ease-in-out flex flex-col h-full ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${collapsed ? 'lg:hidden' : ''}`}
      >
        {/* 로고 */}
        <div className="flex items-center justify-between h-16 px-5 shrink-0">
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">webcash</h1>
            <p className="text-[10px] text-slate-400 -mt-0.5">하나CMS팀</p>
          </div>
          <button className="lg:hidden p-1 text-emerald-300 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {/* 메뉴 */}
        <nav className="px-3 py-4 space-y-0.5 flex-1 overflow-y-auto nav-scroll">
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
                      {item.children.map((child: any, idx: number) => {
                        if (child.section) {
                          return (
                            <div key={`sec-${child.section}`} className={`px-3 text-[10px] font-semibold text-slate-500 uppercase tracking-wider ${idx === 0 ? 'pt-1' : 'pt-2.5'} pb-0.5`}>
                              {child.section}
                            </div>
                          )
                        }

                        // 3뎁스 보유 하위그룹 (2뎁스 클릭 시 3뎁스 펼침)
                        if (child.children) {
                          const subOpen = expandedSub === child.label
                          const subActive = isMenuActive(child)
                          return (
                            <div key={child.label}>
                              <button
                                onClick={() => toggleSub(child.label)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                  subActive ? 'bg-slate-700/40 text-white' : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <div className="w-1.5 h-1.5 rounded-full bg-current opacity-50"></div>
                                  {child.label}
                                </div>
                                <ChevronDown size={13} className={`transition-transform ${subOpen ? 'rotate-180' : ''}`} />
                              </button>
                              {subOpen && (
                                <div className="ml-3 mt-0.5 space-y-0.5 border-l border-slate-700/50 pl-2">
                                  {child.children.map((sub: any) => (
                                    <NavLink
                                      key={sub.to}
                                      to={sub.to!}
                                      end
                                      onClick={() => setSidebarOpen(false)}
                                      className={({ isActive }) =>
                                        `flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                          isActive ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-700/40 hover:text-white'
                                        }`
                                      }
                                    >
                                      <div className="w-1 h-1 rounded-full bg-current opacity-40"></div>
                                      {sub.label}
                                    </NavLink>
                                  ))}
                                </div>
                              )}
                            </div>
                          )
                        }

                        return (
                          <NavLink
                            key={child.to}
                            to={child.to!}
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
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            }

            if (item.disabled) {
              return (
                <div
                  key={item.to}
                  title="현재 사용 불가 (API 크레딧 소진)"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 cursor-not-allowed select-none"
                >
                  <item.icon size={18} />
                  {item.label}
                  <span className="ml-auto text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">일시중지</span>
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
        <div className="shrink-0 border-t border-slate-700/50">
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
          <button
            className="hidden lg:inline-flex p-2 text-gray-500 hover:bg-gray-100 rounded-lg mr-3"
            onClick={toggleCollapsed}
            title={collapsed ? '메뉴 열기' : '메뉴 닫기'}
          >
            <PanelLeft size={20} />
          </button>
          <div className="text-sm text-gray-500">webcash 하나CMS팀 관리 시스템</div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* 빠른 메모 플로팅 버튼 */}
      <QuickMemo />
    </div>
  )
}
