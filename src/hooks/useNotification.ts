import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

export function useNotification() {
  const notifiedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    // 알림 권한 요청
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const checkSchedules = async () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return

      const now = new Date()
      const today = now.toISOString().split('T')[0]
      const currentMinutes = now.getHours() * 60 + now.getMinutes()

      const { data: schedules } = await supabase
        .from('schedules')
        .select('id, title, start_time, is_done')
        .eq('start_date', today)
        .eq('is_done', false)

      if (!schedules) return

      for (const s of schedules) {
        if (!s.start_time || notifiedRef.current.has(s.id)) continue

        const [h, m] = s.start_time.split(':').map(Number)
        const scheduleMinutes = h * 60 + m
        const diff = scheduleMinutes - currentMinutes

        // 10분 전 알림
        if (diff > 0 && diff <= 10) {
          notifiedRef.current.add(s.id)
          new Notification('하나CMS 일정 알림', {
            body: `${diff}분 후: ${s.title}`,
            icon: '/icon-192.png',
            tag: s.id,
          })
        }

        // 정시 알림
        if (diff === 0) {
          notifiedRef.current.add(s.id)
          new Notification('하나CMS 일정 시작', {
            body: `지금: ${s.title}`,
            icon: '/icon-192.png',
            tag: `start-${s.id}`,
          })
        }
      }
    }

    checkSchedules()
    const interval = setInterval(checkSchedules, 60000) // 1분마다
    return () => clearInterval(interval)
  }, [])
}
