// Google Sheets 연동 레이어
// Edge Function(google-sheets)을 통해 구글시트와 통신

const EDGE_FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-sheets`

// 구글시트 컬럼 순서 (헤더 3행 기준 - 실제 시트 기준)
const SHEET_COLUMNS = [
  'duplicate_check',       // 0: 중복체크
  'management_code',       // 1: 관리코드
  'customer_number',       // 2: 고객번호
  'business_number',       // 3: 사업자번호
  'customer_name',         // 4: 고객명
  'build_type',            // 5: 구축구분
  'management_type',       // 6: 관리구분
  'construction_type',     // 7: 구축형
  'manager',               // 8: 담당자
  'reception_date',        // 9: 신규접수일
  'additional_connection_date', // 10: 추가연계접수일
  'customer_contact_person', // 11: 고객담당자
  'customer_department',   // 12: 담당 부서
  'contact_phone',         // 13: 담당연락처
  'contact_email',         // 14: 이메일
  'cms_ip',                // 15: CMS IP
  'intimacy',              // 16: 친밀도
  'opening_status',        // 17: 개설상태
  'opening_date',          // 18: 개설/이행일
  'connection_status',     // 19: 연계상태
  'connection_date',       // 20: 연계일자
  'termination_date',      // 21: 해지일자
  'additional_service1',   // 22: 부가서비스1
  'additional_service2',   // 23: 부가서비스2
  'access_method',         // 24: 접속방식
  'cms_os',                // 25: CMS서버 OS
  'cms_sql_version',       // 26: CMS서버 SQL
  'server_install_location', // 27: 서버PC 설치장소
  'server_location',       // 28: 서버PC 상세위치
  'schedule_use',          // 29: 스케줄 사용여부
  'erp_company',           // 30: ERP회사
  'erp_type',              // 31: ERP종류
  'erp_db',                // 32: ERP DB
  'connection_method',     // 33: 연계방식
  'business_closure',      // 34: 휴폐업여부
  'hq_contract_report',    // 35: 본사계약보고
  'hq_connection_report',  // 36: 본사연계보고
  'hq_registered',         // 37: 본사등록여부
  'invoice_registered',    // 38: 청구서 등록여부
  'transition_end_date',   // 39: 이행종료일
  '_status1', '_hq_contract', '_hq_build', '_hq_connection', '_build_schedule', // 40-44: 참조컬럼
  '_biz1', '_stat2', '_hqc2', '_hqb2', '_hqconn2', // 45-49: 참조컬럼
  '_biz2', '_stat3', '_hqc3', '_hqb3', '_hqconn3', // 50-54: 참조컬럼
  'customer_contact_person2', // 55: 고객담당자2
  'customer_department2',     // 56: 담당부서2
  'contact_phone2',           // 57: 담당연락처2
  'contact_email2',           // 58: 이메일2
  'customer_contact_person3', // 59: 고객담당자3
  'customer_department3',     // 60: 담당부서3
  'contact_phone3',           // 61: 담당연락처3
  'contact_email3',           // 62: 이메일3
]

// 구글시트 헤더 → DB 키 매핑 (실제 시트 기준)
const HEADER_MAP: Record<string, string> = {
  '중복체크': 'duplicate_check',
  '관리코드': 'management_code',
  '고객번호': 'customer_number',
  '사업자번호': 'business_number',
  '고객명': 'customer_name',
  '구축구분': 'build_type',
  '관리구분': 'management_type',
  '구축형': 'construction_type',
  '담당자': 'manager',
  '신규접수일': 'reception_date',
  '추가연계접수일': 'additional_connection_date',
  '고객담당자': 'customer_contact_person',
  '담당 부서': 'customer_department',
  '담당부서': 'customer_department',
  '담당연락처': 'contact_phone',
  '이메일': 'contact_email',
  'CMS IP': 'cms_ip',
  '친밀도': 'intimacy',
  '개설상태': 'opening_status',
  '개설/이행일': 'opening_date',
  '연계상태': 'connection_status',
  '연계일자': 'connection_date',
  '해지일자': 'termination_date',
  '부가서비스1': 'additional_service1',
  '부가서비스2': 'additional_service2',
  '접속방식': 'access_method',
  '서버PC 상세위치': 'server_location',
  '서버PC\n상세위치': 'server_location',
  '스케줄 사용여부': 'schedule_use',
  '스케줄\n사용여부': 'schedule_use',
  'ERP회사': 'erp_company',
  'ERP종류': 'erp_type',
  'ERP DB': 'erp_db',
  '연계방식': 'connection_method',
  '휴폐업여부': 'business_closure',
  '본사계약보고': 'hq_contract_report',
  '본사연계보고': 'hq_connection_report',
  '본사등록여부': 'hq_registered',
  '청구서 등록여부': 'invoice_registered',
  '청구서\n 등록여부': 'invoice_registered',
  '이행종료일': 'transition_end_date',
  '고객담당자2': 'customer_contact_person2',
  '담당 부서2': 'customer_department2',
  '담당부서2': 'customer_department2',
  '담당연락처2': 'contact_phone2',
  '이메일2': 'contact_email2',
  '고객담당자3': 'customer_contact_person3',
  '담당 부서3': 'customer_department3',
  '담당부서3': 'customer_department3',
  '담당연락처3': 'contact_phone3',
  '이메일3': 'contact_email3',
}

// 구글시트 행 → 객체 변환
function rowToCustomer(row: Record<string, string>, _headers: string[]): any {
  const customer: any = { _rowIndex: row._rowIndex }
  // 헤더 기반 매핑
  for (const [sheetHeader, value] of Object.entries(row)) {
    if (sheetHeader === '_rowIndex') continue
    // 정확한 매핑 찾기
    const dbKey = HEADER_MAP[sheetHeader]
    if (dbKey) {
      customer[dbKey] = value
    } else {
      // 부분 매칭 시도
      for (const [hKey, dKey] of Object.entries(HEADER_MAP)) {
        if (sheetHeader.includes(hKey) || hKey.includes(sheetHeader)) {
          customer[dKey] = value
          break
        }
      }
    }
  }
  // ID는 rowIndex 기반으로 생성
  customer.id = `gs_${customer._rowIndex}`
  return customer
}

// 객체 → 구글시트 행 배열 변환
function customerToRow(customer: any): string[] {
  const cnum = customer.customer_number || ''
  const bnum = customer.business_number || ''
  return SHEET_COLUMNS.map((key) => {
    if (key === 'duplicate_check') return String(cnum) + String(bnum)
    return customer[key] || ''
  })
}

// ── API 함수들 ──

export async function fetchCustomers(): Promise<any[]> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'read' }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)

  const headers = data.headers || []
  const customers = (data.data || []).map((row: any) => rowToCustomer(row, headers))
  // 관리코드 내림차순 정렬 (최근 등록이 먼저)
  customers.sort((a: any, b: any) => {
    const codeA = parseInt(a.management_code) || 0
    const codeB = parseInt(b.management_code) || 0
    return codeB - codeA
  })
  return customers
}

export async function appendCustomer(customer: any): Promise<boolean> {
  // 관리코드 자동 생성
  const mcRes = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getMaxCode' }),
  })
  const mcData = await mcRes.json()
  const maxCode = mcData.maxCode || 0

  const year = new Date().getFullYear().toString().slice(-2)
  let nextCode: number
  if (maxCode >= parseInt(year + '000')) {
    nextCode = maxCode + 1
  } else {
    nextCode = parseInt(year + '001')
  }
  customer.management_code = String(nextCode)

  const row = customerToRow(customer)
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'append', rowData: row }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(JSON.stringify(data))
  return true
}

export async function updateCustomer(rowIndex: number, customer: any): Promise<boolean> {
  const row = customerToRow(customer)
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update', rowIndex, rowData: row }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(JSON.stringify(data))
  return true
}

export async function deleteCustomer(rowIndex: number): Promise<boolean> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', rowIndex }),
  })
  const data = await res.json()
  if (!data.success) throw new Error(JSON.stringify(data))
  return true
}

export async function getMaxCode(): Promise<number> {
  const res = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getMaxCode' }),
  })
  const data = await res.json()
  return data.maxCode || 0
}

export { SHEET_COLUMNS, HEADER_MAP }
