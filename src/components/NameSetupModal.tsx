import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { UserCircle } from 'lucide-react'

interface Props {
  userId: string
  email: string
  onComplete: () => void
}

export default function NameSetupModal({ userId, email, onComplete }: Props) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      alert('이름을 입력해주세요.')
      return
    }

    setLoading(true)

    // profiles 테이블에 이름 업데이트 (없으면 생성)
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (existing) {
      await supabase.from('profiles').update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', userId)
    } else {
      await supabase.from('profiles').insert([{
        id: userId,
        name: name.trim(),
        email: email,
        phone: '',
      }])
    }

    // auth user metadata에도 저장
    await supabase.auth.updateUser({
      data: { name: name.trim() },
    })

    setLoading(false)
    onComplete()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <UserCircle size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">환영합니다!</h2>
          <p className="text-sm text-gray-500 mt-2">
            업무에 사용할 이름을 입력해주세요.<br />
            고객 담당자 매칭 및 AI 요약에 활용됩니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름 (실명)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition text-center text-lg"
              placeholder="홍길동"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="w-full py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 transition"
          >
            {loading ? '저장 중...' : '시작하기'}
          </button>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          나중에 정보수정 메뉴에서 변경할 수 있습니다.
        </p>
      </div>
    </div>
  )
}
