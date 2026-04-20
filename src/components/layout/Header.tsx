import { useAuthStore } from '@/store/authStore'

interface HeaderProps {
  title: string
}

export default function Header({ title }: HeaderProps) {
  const { user } = useAuthStore()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-500">
          {user?.branch ?? '전체 브랜치'} · {user?.role}
        </span>
      </div>
    </header>
  )
}
