import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import MainLayout from '@/components/layout/MainLayout'
import LoginPage from '@/pages/auth/LoginPage'
import RegisterPage from '@/pages/auth/RegisterPage'
import DashboardPage from '@/pages/dashboard/DashboardPage'
import StatisticsPage from '@/pages/statistics/StatisticsPage'
import CustomersPage from '@/pages/customers/CustomersPage'
import VocPage from '@/pages/voc/VocPage'
import ErpMasterPage from '@/pages/erp-master/ErpMasterPage'
import KeyContactsPage from '@/pages/key-contacts/KeyContactsPage'
import ReportsPage from '@/pages/reports/ReportsPage'
import SystemPage from '@/pages/system/SystemPage'
import UserManagementPage from '@/pages/system/UserManagementPage'
import AccessLogsPage from '@/pages/system/AccessLogsPage'
import TargetManagementPage from '@/pages/system/TargetManagementPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()

  if (user?.role !== 'SUPER_ADMIN') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export default function App() {
  const { initialize } = useAuthStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <BrowserRouter>
      <Routes>
        {/* 공개 페이지 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* 인증 필요 페이지 */}
        <Route
          element={
            <ProtectedRoute>
              <MainLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<DashboardPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/voc" element={<VocPage />} />
          <Route path="/erp-master" element={<ErpMasterPage />} />
          <Route path="/key-contacts" element={<KeyContactsPage />} />
          <Route path="/reports" element={<ReportsPage />} />

          {/* 관리자 전용 */}
          <Route path="/system" element={<AdminRoute><SystemPage /></AdminRoute>} />
          <Route path="/system/users" element={<AdminRoute><UserManagementPage /></AdminRoute>} />
          <Route path="/system/logs" element={<AdminRoute><AccessLogsPage /></AdminRoute>} />
          <Route path="/system/targets" element={<AdminRoute><TargetManagementPage /></AdminRoute>} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
