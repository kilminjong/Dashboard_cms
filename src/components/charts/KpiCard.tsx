import type { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  title: string
  value: number
  icon: LucideIcon
  color: string
  bgColor: string
}

export default function KpiCard({ title, value, icon: Icon, color, bgColor }: KpiCardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bgColor}`}>
        <Icon size={24} className={color} />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</p>
      </div>
    </div>
  )
}
