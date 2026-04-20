import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

export async function logAction(actionType: string, targetDescription?: string) {
  const user = useAuthStore.getState().user
  if (!user) return

  try {
    await supabase.from('access_logs').insert({
      user_id: user.id,
      user_name: user.name,
      user_email: user.email,
      branch: user.branch,
      action_type: actionType,
      target_description: targetDescription ?? null,
    })
  } catch {
    // 로그 실패는 무시
  }
}
