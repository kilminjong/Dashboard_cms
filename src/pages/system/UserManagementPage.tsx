import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import Header from '@/components/layout/Header'
import Modal from '@/components/ui/Modal'
import ConfirmDialog from '@/components/ui/ConfirmDialog'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { logAction } from '@/utils/logAction'
import type { User, UserRole, UserStatus, BranchType } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'
import { Search, UserCheck, UserX, Shield, Ban, Trash2 } from 'lucide-react'

type TabType = '전체' | '승인대기' | '활성' | '거절/정지'

const ROLES: UserRole[] = ['BRANCH_ADMIN', 'BRANCH_USER', 'VIEWER']

const STATUS_BADGE: Record<UserStatus, { label: string; class: string }> = {
  PENDING: { label: '승인대기', class: 'bg-yellow-100 text-yellow-800' },
  ACTIVE: { label: '활성', class: 'bg-green-100 text-green-800' },
  REJECTED: { label: '거절', class: 'bg-red-100 text-red-800' },
  SUSPENDED: { label: '정지', class: 'bg-gray-100 text-gray-500' },
}

const ROLE_LABELS: Record<UserRole, string> = {
  SUPER_ADMIN: '최고관리자',
  BRANCH_ADMIN: '브랜치관리자',
  BRANCH_USER: '일반사용자',
  VIEWER: '조회전용',
}

export default function UserManagementPage() {
  const [searchParams] = useSearchParams()
  const { fetchPendingCount } = useAuthStore()

  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [tab, setTab] = useState<TabType>(() => {
    const param = searchParams.get('tab')
    if (param === 'pending') return '승인대기'
    return '전체'
  })

  // 필터
  const [keyword, setKeyword] = useState('')
  const [filterBranch, setFilterBranch] = useState<BranchType | '전체'>('전체')
  const [filterRole, setFilterRole] = useState<UserRole | '전체'>('전체')

  // 승인 모달
  const [approveTarget, setApproveTarget] = useState<User | null>(null)
  const [approveRole, setApproveRole] = useState<UserRole>('BRANCH_USER')
  const [approveBranch, setApproveBranch] = useState<BranchType>('IBK')

  // 거절 모달
  const [rejectTarget, setRejectTarget] = useState<User | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  // 정지/삭제 확인
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null)

  // 카운트
  const [pendingCount, setPendingCount] = useState(0)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    let query = supabase.from('users').select('*').order('created_at', { ascending: false })

    // 탭 필터
    if (tab === '승인대기') query = query.eq('status', 'PENDING')
    else if (tab === '활성') query = query.eq('status', 'ACTIVE')
    else if (tab === '거절/정지') query = query.in('status', ['REJECTED', 'SUSPENDED'])

    if (filterBranch !== '전체') query = query.eq('branch', filterBranch)
    if (filterRole !== '전체') query = query.eq('role', filterRole)
    if (keyword) {
      query = query.or(`name.ilike.%${keyword}%,email.ilike.%${keyword}%`)
    }

    const { data } = await query
    if (data) setUsers(data as User[])

    // 대기 건수
    const { count } = await supabase.from('users').select('*', { count: 'exact', head: true }).eq('status', 'PENDING')
    setPendingCount(count ?? 0)

    setIsLoading(false)
  }, [tab, filterBranch, filterRole, keyword])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  // 승인 처리
  const handleApprove = async () => {
    if (!approveTarget) return

    await supabase.from('users').update({
      status: 'ACTIVE',
      role: approveRole,
      branch: approveBranch,
      approved_by: useAuthStore.getState().user?.id,
      approved_at: new Date().toISOString(),
    }).eq('id', approveTarget.id)

    await logAction('USER_APPROVE', `${approveTarget.name} (${approveTarget.email}) 승인`)
    setApproveTarget(null)
    fetchUsers()
    fetchPendingCount()
  }

  // 거절 처리
  const handleReject = async () => {
    if (!rejectTarget) return

    await supabase.from('users').update({
      status: 'REJECTED',
      rejected_reason: rejectReason || null,
    }).eq('id', rejectTarget.id)

    await logAction('USER_REJECT', `${rejectTarget.name} (${rejectTarget.email}) 거절`)
    setRejectTarget(null)
    setRejectReason('')
    fetchUsers()
    fetchPendingCount()
  }

  // 정지 처리
  const handleSuspend = async () => {
    if (!suspendTarget) return

    await supabase.from('users').update({ status: 'SUSPENDED' }).eq('id', suspendTarget.id)
    await logAction('USER_SUSPEND', `${suspendTarget.name} 정지`)
    setSuspendTarget(null)
    fetchUsers()
  }

  // 삭제 처리
  const handleDelete = async () => {
    if (!deleteTarget) return

    await supabase.from('users').delete().eq('id', deleteTarget.id)
    await logAction('USER_DELETE', `${deleteTarget.name} 삭제`)
    setDeleteTarget(null)
    fetchUsers()
  }

  // 인라인 역할 변경
  const handleRoleChange = async (user: User, newRole: UserRole) => {
    await supabase.from('users').update({ role: newRole }).eq('id', user.id)
    await logAction('USER_ROLE_CHANGE', `${user.name} 역할 변경: ${newRole}`)
    fetchUsers()
  }

  // 인라인 브랜치 변경
  const handleBranchChange = async (user: User, newBranch: BranchType) => {
    await supabase.from('users').update({ branch: newBranch }).eq('id', user.id)
    await logAction('USER_BRANCH_CHANGE', `${user.name} 브랜치 변경: ${newBranch}`)
    fetchUsers()
  }

  // 승인 모달 열기
  const openApproveModal = (user: User) => {
    setApproveTarget(user)
    setApproveRole('BRANCH_USER')
    setApproveBranch(user.branch ?? 'IBK')
  }

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: '전체', label: '전체' },
    { key: '승인대기', label: '승인대기', count: pendingCount },
    { key: '활성', label: '활성' },
    { key: '거절/정지', label: '거절/정지' },
  ]

  return (
    <div>
      <Header title="사용자 관리" />
      <div className="p-6">
        {/* 탭 */}
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 mb-4 w-fit">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm rounded-md transition-colors relative ${
                tab === t.key
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-500 rounded-full">
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 필터 */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="이름 / 이메일 검색"
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value as BranchType | '전체')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="전체">브랜치 전체</option>
            {ALL_BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
          </select>
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value as UserRole | '전체')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="전체">역할 전체</option>
            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜치</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">직책</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">역할</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase w-40">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
                ) : users.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">사용자가 없습니다</td></tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        {u.status === 'ACTIVE' && u.role !== 'SUPER_ADMIN' ? (
                          <select
                            value={u.branch ?? ''}
                            onChange={(e) => handleBranchChange(u, e.target.value as BranchType)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded bg-white"
                          >
                            {ALL_BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs">{u.branch ? BRANCH_LABELS[u.branch] : '-'}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{u.position || '-'}</td>
                      <td className="px-4 py-3">
                        {u.status === 'ACTIVE' && u.role !== 'SUPER_ADMIN' ? (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value as UserRole)}
                            className="px-2 py-1 text-xs border border-gray-200 rounded bg-white"
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                          </select>
                        ) : (
                          <span className="text-xs">{ROLE_LABELS[u.role]}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${STATUS_BADGE[u.status].class}`}>
                          {STATUS_BADGE[u.status].label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(u.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {u.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => openApproveModal(u)}
                                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                title="승인"
                              >
                                <UserCheck size={15} />
                              </button>
                              <button
                                onClick={() => setRejectTarget(u)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="거절"
                              >
                                <UserX size={15} />
                              </button>
                            </>
                          )}
                          {u.status === 'ACTIVE' && u.role !== 'SUPER_ADMIN' && (
                            <>
                              <button
                                onClick={() => setSuspendTarget(u)}
                                className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="정지"
                              >
                                <Ban size={15} />
                              </button>
                            </>
                          )}
                          {u.role !== 'SUPER_ADMIN' && (
                            <button
                              onClick={() => setDeleteTarget(u)}
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="삭제"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                          {u.status === 'SUSPENDED' && (
                            <button
                              onClick={async () => {
                                await supabase.from('users').update({ status: 'ACTIVE' }).eq('id', u.id)
                                await logAction('USER_REACTIVATE', `${u.name} 재활성화`)
                                fetchUsers()
                              }}
                              className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="재활성화"
                            >
                              <Shield size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 승인 모달 */}
      <Modal isOpen={!!approveTarget} onClose={() => setApproveTarget(null)} title="사용자 승인" size="sm">
        {approveTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">이름</span>
                <span className="font-medium">{approveTarget.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">이메일</span>
                <span className="font-medium">{approveTarget.email}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">직책</span>
                <span className="font-medium">{approveTarget.position || '-'}</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">역할 배정 *</label>
              <select
                value={approveRole}
                onChange={(e) => setApproveRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">브랜치 확인 *</label>
              <select
                value={approveBranch}
                onChange={(e) => setApproveBranch(e.target.value as BranchType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              >
                {ALL_BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={() => setApproveTarget(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                취소
              </button>
              <button onClick={handleApprove} className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors">
                승인 완료
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 거절 모달 */}
      <Modal isOpen={!!rejectTarget} onClose={() => setRejectTarget(null)} title="가입 거절" size="sm">
        {rejectTarget && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              <strong>{rejectTarget.name}</strong> ({rejectTarget.email})의 가입을 거절하시겠습니까?
            </p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">거절 사유</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                rows={3}
                placeholder="거절 사유를 입력하세요 (선택)"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
              <button onClick={() => setRejectTarget(null)} className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
                취소
              </button>
              <button onClick={handleReject} className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors">
                거절 처리
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* 정지 확인 */}
      <ConfirmDialog
        isOpen={!!suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={handleSuspend}
        title="계정 정지"
        message={`"${suspendTarget?.name}" 계정을 정지하시겠습니까? 해당 사용자는 로그인이 차단됩니다.`}
        confirmText="정지"
        variant="danger"
      />

      {/* 삭제 확인 */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="계정 삭제"
        message={`"${deleteTarget?.name}" 계정을 완전히 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`}
        confirmText="삭제"
        variant="danger"
      />
    </div>
  )
}
