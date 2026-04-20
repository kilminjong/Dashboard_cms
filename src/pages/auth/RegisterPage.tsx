import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { ALL_BRANCHES, BRANCH_LABELS, POSITION_OPTIONS, type BranchType } from '@/types'
import { Mail, CheckCircle } from 'lucide-react'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    passwordConfirm: '',
    branch: 'IBK' as BranchType,
    position: '',
  })
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // 모달 상태
  const [showModal, setShowModal] = useState(false)
  const [countdown, setCountdown] = useState(4)

  // 4초 카운트다운 후 로그인으로 이동
  const startCountdown = useCallback(() => {
    setShowModal(true)
    setCountdown(4)
  }, [])

  useEffect(() => {
    if (!showModal) return
    if (countdown <= 0) {
      navigate('/login')
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [showModal, countdown, navigate])

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.name.trim()) { setError('이름을 입력해주세요.'); return }
    if (!form.email.trim()) { setError('이메일을 입력해주세요.'); return }
    if (form.password.length < 6) { setError('비밀번호는 6자 이상이어야 합니다.'); return }
    if (form.password !== form.passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return }

    setIsLoading(true)

    try {
      // 1. Supabase Auth 계정 생성 (이메일 인증 메일 자동 발송)
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })

      if (authError) throw authError
      if (!authData.user) throw new Error('계정 생성에 실패했습니다.')

      // 2. users 테이블에 프로필 등록 (status = PENDING)
      const { error: profileError } = await supabase.from('users').insert({
        id: authData.user.id,
        email: form.email,
        name: form.name.trim(),
        role: 'BRANCH_USER',
        branch: form.branch,
        status: 'PENDING',
        position: form.position || null,
      })

      if (profileError) throw profileError

      // 3. 바로 로그아웃
      await supabase.auth.signOut()

      // 4. 모달 표시 + 4초 카운트다운
      startCountdown()
    } catch (err) {
      setError(err instanceof Error ? err.message : '가입 신청에 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-light focus:border-transparent outline-none transition-all text-sm"

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          {/* 로고 */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">DB Branch</h1>
            <p className="text-sm text-gray-500 mt-2">허나사업부 고객현황 관리 시스템</p>
            <p className="text-xs text-gray-400 mt-1">회원가입</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이름 *</label>
              <input type="text" value={form.name} onChange={(e) => handleChange('name', e.target.value)}
                placeholder="홍길동" required className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일 *</label>
              <input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)}
                placeholder="example@company.com" required className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 *</label>
              <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)}
                placeholder="6자 이상" required className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인 *</label>
              <input type="password" value={form.passwordConfirm} onChange={(e) => handleChange('passwordConfirm', e.target.value)}
                placeholder="비밀번호 재입력" required className={inputClass} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">소속 브랜치 *</label>
              <select value={form.branch} onChange={(e) => handleChange('branch', e.target.value)} className={inputClass}>
                {ALL_BRANCHES.map((b) => (
                  <option key={b} value={b}>{BRANCH_LABELS[b]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">직책/직급</label>
              <select value={form.position} onChange={(e) => handleChange('position', e.target.value)} className={inputClass}>
                <option value="">선택</option>
                {POSITION_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 text-red-600 text-sm rounded-lg p-3">{error}</div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              {isLoading ? '신청 중...' : '가입 신청하기'}
            </button>
          </form>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-500">
              이미 계정이 있으신가요?{' '}
              <Link to="/login" className="text-primary font-medium hover:underline">로그인으로 이동</Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          허나사업부 DB Branch 고객현황 관리 시스템 v1.0
        </p>
      </div>

      {/* 가입 완료 모달 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center animate-in">
            {/* 아이콘 */}
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-blue-600" />
            </div>

            {/* 제목 */}
            <h2 className="text-xl font-bold text-gray-800 mb-3">가입 신청 완료</h2>

            {/* 안내 메시지 */}
            <div className="bg-blue-50 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-blue-600 shrink-0" />
                <p className="text-sm font-medium text-blue-800 text-left">이메일 인증을 진행해주세요</p>
              </div>
              <p className="text-xs text-blue-700 text-left leading-relaxed">
                <strong>{form.email}</strong> 으로 인증 메일이 발송되었습니다.<br />
                메일함을 확인하여 인증을 완료해주세요.
              </p>
            </div>

            <div className="bg-orange-50 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={16} className="text-orange-600 shrink-0" />
                <p className="text-sm font-medium text-orange-800 text-left">관리자 승인 필요</p>
              </div>
              <p className="text-xs text-orange-700 text-left leading-relaxed">
                이메일 인증 완료 후에도 <strong>관리자 승인</strong>이 필요합니다.<br />
                승인 완료 후 로그인이 가능합니다.
              </p>
            </div>

            {/* 카운트다운 */}
            <p className="text-xs text-gray-400">
              {countdown}초 후 로그인 화면으로 이동합니다...
            </p>

            {/* 프로그레스 바 */}
            <div className="w-full bg-gray-200 rounded-full h-1 mt-3 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${((4 - countdown) / 4) * 100}%` }}
              />
            </div>

            {/* 즉시 이동 버튼 */}
            <button
              onClick={() => navigate('/login')}
              className="mt-4 text-sm text-primary font-medium hover:underline"
            >
              지금 로그인으로 이동
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
