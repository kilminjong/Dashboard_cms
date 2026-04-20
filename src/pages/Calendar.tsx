import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Schedule } from '../types'
import { ChevronLeft, ChevronRight, X, Edit2, Trash2, Check, Clock } from 'lucide-react'

interface ScheduleWithTime extends Schedule {
  start_time: string
  end_time: string
  is_done: boolean
}

const COLOR_OPTIONS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [schedules, setSchedules] = useState<ScheduleWithTime[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduleWithTime | null>(null)
  const [form, setForm] = useState({
    title: '', description: '', color: '#059669',
    start_time: '09:00', end_time: '10:00',
  })
  const [showDayDetail, setShowDayDetail] = useState(false)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  useEffect(() => {
    loadSchedules()
  }, [month, year])

  // 자동 완료 체크 (현재 시간이 end_time 지난 일정)
  useEffect(() => {
    const checkDone = async () => {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      const expiredSchedules = schedules.filter(
        (s) => s.start_date === today && !s.is_done && s.end_time <= currentTime
      )

      if (expiredSchedules.length > 0) {
        for (const s of expiredSchedules) {
          await supabase.from('schedules').update({ is_done: true }).eq('id', s.id)
        }
        loadSchedules()
        // AI 요약 캐시 무효화
        Object.keys(sessionStorage).forEach((key) => {
          if (key.startsWith('ai_summary')) sessionStorage.removeItem(key)
        })
      }
    }

    checkDone()
    const interval = setInterval(checkDone, 60000) // 1분마다 체크
    return () => clearInterval(interval)
  }, [schedules])

  const loadSchedules = async () => {
    const startOfMonth = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const endOfMonth = new Date(year, month + 1, 0)
    const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endOfMonth.getDate()).padStart(2, '0')}`

    const { data } = await supabase
      .from('schedules')
      .select('*')
      .gte('start_date', startOfMonth)
      .lte('start_date', endStr)
      .order('start_time')

    setSchedules((data as ScheduleWithTime[]) || [])
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const days: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
  for (let i = 1; i <= daysInMonth; i++) days.push(i)

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  const getSchedulesForDay = (day: number) =>
    schedules.filter((s) => s.start_date === getDateStr(day))

  const openAddModal = (dateStr: string) => {
    setSelectedDate(dateStr)
    setEditingSchedule(null)
    setForm({ title: '', description: '', color: '#059669', start_time: '09:00', end_time: '10:00' })
    setShowModal(true)
  }

  const openEditModal = (schedule: ScheduleWithTime) => {
    setSelectedDate(schedule.start_date)
    setEditingSchedule(schedule)
    setForm({
      title: schedule.title,
      description: schedule.description || '',
      color: schedule.color,
      start_time: schedule.start_time || '09:00',
      end_time: schedule.end_time || '10:00',
    })
    setShowModal(true)
  }

  const openDayDetail = (dateStr: string) => {
    setSelectedDate(dateStr)
    setShowDayDetail(true)
  }

  const handleSave = async () => {
    if (!selectedDate || !form.title.trim()) return

    if (editingSchedule) {
      await supabase.from('schedules').update({
        title: form.title,
        description: form.description,
        color: form.color,
        start_time: form.start_time,
        end_time: form.end_time,
      }).eq('id', editingSchedule.id)
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      await supabase.from('schedules').insert([{
        user_id: user.id,
        title: form.title,
        description: form.description,
        start_date: selectedDate,
        color: form.color,
        start_time: form.start_time,
        end_time: form.end_time,
      }])
    }

    setShowModal(false)
    loadSchedules()
    // AI 요약 캐시 무효화
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('ai_summary')) sessionStorage.removeItem(key)
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('일정을 삭제하시겠습니까?')) return
    await supabase.from('schedules').delete().eq('id', id)
    loadSchedules()
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('ai_summary')) sessionStorage.removeItem(key)
    })
  }

  const toggleDone = async (schedule: ScheduleWithTime) => {
    await supabase.from('schedules').update({ is_done: !schedule.is_done }).eq('id', schedule.id)
    loadSchedules()
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith('ai_summary')) sessionStorage.removeItem(key)
    })
  }

  const today = new Date().toISOString().split('T')[0]
  const weekDays = ['일', '월', '화', '수', '목', '금', '토']

  const dayDetailSchedules = selectedDate
    ? schedules.filter((s) => s.start_date === selectedDate)
    : []

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
            const doneCount = daySchedules.filter((s) => s.is_done).length
            const totalCount = daySchedules.length

            return (
              <div
                key={day}
                className="min-h-[80px] lg:min-h-[100px] border-b border-r border-gray-50 p-1 cursor-pointer hover:bg-gray-50 transition"
                onClick={() => openDayDetail(dateStr)}
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
                  {totalCount > 0 && (
                    <span className="text-[10px] text-gray-400">{doneCount}/{totalCount}</span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {daySchedules.slice(0, 3).map((s) => (
                    <div
                      key={s.id}
                      className={`text-xs px-1.5 py-0.5 rounded truncate text-white ${s.is_done ? 'opacity-40 line-through' : ''}`}
                      style={{ backgroundColor: s.color }}
                    >
                      {s.start_time?.slice(0, 5)} {s.title}
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

      {/* 날짜 상세 모달 */}
      {showDayDetail && selectedDate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowDayDetail(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800">{selectedDate}</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowDayDetail(false); openAddModal(selectedDate) }}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs hover:bg-emerald-700 transition"
                >
                  + 일정 추가
                </button>
                <button onClick={() => setShowDayDetail(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto max-h-[60vh] p-4 space-y-2">
              {dayDetailSchedules.length === 0 ? (
                <p className="text-center py-8 text-gray-300 text-sm">등록된 일정이 없습니다.</p>
              ) : (
                dayDetailSchedules.map((s) => (
                  <div key={s.id} className={`border rounded-xl p-3 transition ${s.is_done ? 'bg-gray-50 opacity-60' : 'bg-white'}`}
                    style={{ borderLeftWidth: '4px', borderLeftColor: s.color }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm text-gray-800 ${s.is_done ? 'line-through text-gray-400' : ''}`}>
                          {s.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock size={12} className="text-gray-400" />
                          <span className="text-xs text-gray-500">{s.start_time?.slice(0, 5)} ~ {s.end_time?.slice(0, 5)}</span>
                          {s.is_done && <span className="text-xs text-emerald-600 font-medium ml-1">완료</span>}
                        </div>
                        {s.description && (
                          <p className="text-xs text-gray-400 mt-1">{s.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleDone(s)}
                          className={`p-1.5 rounded-lg transition ${s.is_done ? 'bg-emerald-100 text-emerald-600' : 'hover:bg-gray-100 text-gray-300'}`}
                          title={s.is_done ? '미완료로 변경' : '완료 처리'}
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => { setShowDayDetail(false); openEditModal(s) }}
                          className="p-1.5 text-gray-300 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                          title="수정"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                          title="삭제"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 일정 추가/수정 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">
                {editingSchedule ? '일정 수정' : '일정 추가'} ({selectedDate})
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
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">시작 시간</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">종료 시간</label>
                  <input
                    type="time"
                    value={form.end_time}
                    onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm"
                  />
                </div>
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
                  {COLOR_OPTIONS.map((c) => (
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
                {editingSchedule ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
