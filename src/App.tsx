import { useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import NameSetupModal from './components/NameSetupModal'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import CustomerDetail from './pages/CustomerDetail'
import AiAssistant from './pages/AiAssistant'
import CalendarPage from './pages/Calendar'
import ProfilePage from './pages/Profile'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, refreshProfile } = useAuth()
  const [nameSetupDone, setNameSetupDone] = useState(false)

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">로딩 중...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  // 이름이 없으면 이름 입력 모달 표시
  const hasName = profile?.name || session.user.user_metadata?.name || nameSetupDone
  if (!hasName) {
    return (
      <NameSetupModal
        userId={session.user.id}
        email={session.user.email || ''}
        onComplete={() => {
          setNameSetupDone(true)
          refreshProfile()
        }}
      />
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/customers/:id" element={<CustomerDetail />} />
          <Route path="/ai-assistant" element={<AiAssistant />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
