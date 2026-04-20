import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import * as XLSX from 'xlsx'

const BACKUP_HOUR = 18 // 오후 6시

export function useAutoBackup() {
  const lastBackupDate = useRef(localStorage.getItem('last_backup_date') || '')

  const runBackup = async () => {
    const today = new Date().toISOString().split('T')[0]

    // 오늘 이미 백업했으면 스킵
    if (lastBackupDate.current === today) return

    const { data } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false })
      .range(0, 9999)

    if (!data || data.length === 0) return

    // 컬럼 한글 매핑
    const columnMap: Record<string, string> = {
      customer_name: '고객명', business_number: '사업자번호', customer_number: '고객번호',
      management_code: '관리코드', build_type: '구축구분', management_type: '관리구분',
      construction_type: '구축형', manager: '담당자', reception_date: '신규접수일',
      customer_contact_person: '고객담당자', customer_department: '담당부서',
      contact_phone: '담당자연락처', contact_email: '담당자이메일',
      opening_status: '개설상태', opening_date: '개설이행일',
      connection_status: '연계상태', connection_date: '연계일자',
      erp_company: 'ERP회사', erp_type: 'ERP종류', erp_db: 'ERP DB',
      connection_method: '연계방식', server_location: '서버위치',
      schedule_use: '스케줄사용', customer_ip: '고객IP',
      sensitive_customer: '민감고객', intimacy: '친밀도', duplicate_check: '중복체크',
    }

    const exportKeys = Object.keys(columnMap)
    const headers = exportKeys.map((k) => columnMap[k])
    const rows = data.map((row) => exportKeys.map((k) => (row as any)[k] || ''))

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = headers.map((h) => ({ wch: Math.max(h.length * 2, 12) }))
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '고객데이터')
    XLSX.writeFile(wb, `고객데이터_백업_${today}.xlsx`)

    lastBackupDate.current = today
    localStorage.setItem('last_backup_date', today)
  }

  useEffect(() => {
    // 매분 체크: 현재 시간이 오후 6시이고 오늘 백업 안 했으면 실행
    const check = () => {
      const now = new Date()
      const today = now.toISOString().split('T')[0]
      if (now.getHours() === BACKUP_HOUR && lastBackupDate.current !== today) {
        runBackup()
      }
    }

    check()
    const interval = setInterval(check, 60000) // 1분마다 체크
    return () => clearInterval(interval)
  }, [])

  return { runBackup }
}
