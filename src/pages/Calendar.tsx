import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../types'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', color: '#059669' })

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    loadSchedules()
  }, [month, year])

  const loadSchedules = async () => {
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endOfMonth = new Date(year, month + 1, 0)
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`

    const { data } = await supabase
      .from('schedules')
      .select('*')
      .gte('start_date', startOfMonth)
      .lte('start_date', endStr)
      .order('start_date')

    setSchedules(data || [])
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const days = []
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const getSchedulesForDay = (day: number) =>
    schedules.filter((s) => s.start_date === getDateStr(day))

  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr)
    setForm({ title: '', description: '', color: '#059669' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!selectedDate || !form.title.trim()) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('schedules').insert([{
      user_id: user.id,
      title: form.title,
      description: form.description,
      start_date: selectedDate,
      color: form.color,
    }])

    setShowModal(false)
    loadSchedules()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    await supabase.from('schedules').delete().eq('id', id)
    loadSchedules()
  }

  const today = new Date().toISOString().split('T')[0]
  const weekDays = ['일', '월', '화', '수', '목', '금', '토']
  const colorOptions = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">캘린더</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronLeft size={20} />
          </button>
          <h3 className="text-lg font-semibold text-gray-800">
            {year}년 {month + 1}월
          </h3>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-lg">
            <ChevronRight size={20} />
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {weekDays.map((d, i) => (
            <div
              key={d}
              className={`text-center py-2 text-xs font-medium ${
                i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="min-h-[80px] lg:min-h-[100px] border-b border-r border-gray-50" />
            }

            const dateStr = getDateStr(day)
            const daySchedules = getSchedulesForDay(day)
            const isToday = dateStr === today
            const dayOfWeek = new Date(year, month, day).getDay()

            return (
              <div
                key={day}
                className="min-h-[80px] lg:min-h-[100px] border-b border-r border-gray-50 p-1 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => openAddModal(dateStr)}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm w-7 h-7 flex items-center justify-center rounded-full ${
                      isToday
                        ? 'bg-emerald-600 text-white font-bold'
                        : dayOfWeek === 0
                        ? 'text-red-500'
                        : dayOfWeek === 6
                        ? 'text-blue-500'
                        : 'text-gray-700'
                    }`}
                  >
                    {day}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5">
                  {daySchedules.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className="text-xs px-1.5 py-0.5 rounded truncate text-white"
                      style={{ backgroundColor: s.color }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(s.id)
                      }}
                    >
                      {s.title}
                    </div>
                  ))}
                  {daySchedules.length > 3 && (
                    <div className="text-xs text-gray-400 pl-1">+{daySchedules.length - 3}개</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 일정 추가 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                일정 추가 ({selectedDate})
              </h3>
              <button onClick={() => setShowModal(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">제목 *</label>
                <input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  placeholder="일정 제목"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none"
                  placeholder="상세 내용"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">색상</label>
                <div className="flex gap-2">
                  {colorOptions.map((c) => (
                    <button
                      key={c}
                      onClick={() => setForm({ ...form, color: c })}
                      className={`w-8 h-8 rounded-full transition ${
                        form.color === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium"
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
