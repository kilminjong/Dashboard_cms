import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User, UserRole, UserStatus, BranchType } from '@/types'

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  pendingCount: number
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  initialize: () => Promise<void>
  fetchPendingCount: () => Promise<void>
}

function mapProfile(profile: Record<string, unknown>): User {
  return {
    id: profile.id as string,
    email: profile.email as string,
    name: profile.name as string,
    role: profile.role as UserRole,
    branch: (profile.branch as BranchType) ?? null,
    status: (profile.status as UserStatus) ?? 'PENDING',
    position: (profile.position as string) ?? null,
    approved_by: (profile.approved_by as string) ?? null,
    approved_at: (profile.approved_at as string) ?? null,
    rejected_reason: (profile.rejected_reason as string) ?? null,
    created_at: profile.created_at as string,
    updated_at: profile.updated_at as string,
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  pendingCount: 0,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        const { data: profile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          const user = mapProfile(profile)

          // ACTIVE 상태만 로그인 허용
          if (user.status !== 'ACTIVE') {
            await supabase.auth.signOut()
            set({ user: null, isAuthenticated: false, isLoading: false })
            return
          }

          set({ user, isAuthenticated: true, isLoading: false })

          // SUPER_ADMIN이면 대기 건수 조회
          if (user.role === 'SUPER_ADMIN') {
            get().fetchPendingCount()
          }
          return
        }
      }
      set({ user: null, isAuthenticated: false, isLoading: false })
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false })
    }
  },

  login: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('id', data.user.id)
      .single()

    if (!profile) {
      await supabase.auth.signOut()
      throw new Error('사용자 프로필을 찾을 수 없습니다.')
    }

    const user = mapProfile(profile)

    // status 체크
    if (user.status === 'PENDING') {
      await supabase.auth.signOut()
      throw new Error('관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.')
    }
    if (user.status === 'REJECTED') {
      await supabase.auth.signOut()
      throw new Error('가입이 거절되었습니다. 관리자에게 문의하세요.')
    }
    if (user.status === 'SUSPENDED') {
      await supabase.auth.signOut()
      throw new Error('계정이 정지되었습니다. 관리자에게 문의하세요.')
    }

    set({ user, isAuthenticated: true })

    // 로그인 로그 기록
    await supabase.from('access_logs').insert({
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      branch: user.branch,
      action_type: 'LOGIN',
      target_description: '로그인',
    })

    if (user.role === 'SUPER_ADMIN') {
      get().fetchPendingCount()
    }
  },

  logout: async () => {
    await supabase.auth.signOut()
    set({ user: null, isAuthenticated: false, pendingCount: 0 })
  },

  fetchPendingCount: async () => {
    const { count } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING')
    set({ pendingCount: count ?? 0 })
  },
}))
