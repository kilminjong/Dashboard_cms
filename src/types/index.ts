// 역할 타입
export type UserRole = 'SUPER_ADMIN' | 'BRANCH_ADMIN' | 'BRANCH_USER' | 'VIEWER';

// 브랜치 타입
export type BranchType = 'IBK' | 'HANA' | 'KB' | 'iBranch' | 'eCashBranch' | 'NH' | 'IMBANK';

// 브랜치 표시명 매핑
export const BRANCH_LABELS: Record<BranchType, string> = {
  NH: '농협',
  IBK: 'IBK기업은행',
  HANA: '하나은행',
  KB: 'KB국민은행',
  IMBANK: 'IM뱅크',
  iBranch: 'iBranch',
  eCashBranch: 'eCashBranch',
};

// 전체 브랜치 목록
export const ALL_BRANCHES: BranchType[] = ['NH', 'IBK', 'HANA', 'KB', 'IMBANK', 'iBranch', 'eCashBranch'];

// 고객 상태 타입
export type CustomerStatus = '완료' | '진행' | '대기' | '해지';

// 사용자 상태 타입
export type UserStatus = 'PENDING' | 'ACTIVE' | 'REJECTED' | 'SUSPENDED';

// 직책/직급 목록
export const POSITION_OPTIONS = ['부대표', '이사', '부장', '차장', '과장', '대리', '주임', '사원'] as const;

// 사용자 인터페이스
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  branch: BranchType | null;
  status: UserStatus;
  position: string | null;
  approved_by: string | null;
  approved_at: string | null;
  rejected_reason: string | null;
  created_at: string;
  updated_at: string;
}

// 접근 로그 인터페이스
export interface AccessLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  branch: string | null;
  action_type: string;
  target_description: string | null;
  ip_address: string | null;
  created_at: string;
}

// 고객 정보 인터페이스 (27개 컬럼)
export interface Customer {
  id: string;
  branch: BranchType;
  type: string | null;              // 유형
  product: string | null;           // 상품
  company_name: string;             // 업체명
  business_number: string | null;   // 사업자번호
  contract_date: string | null;     // 계약일자
  business_type: string | null;     // 업태
  industry: string | null;          // 업종/주품목
  erp_type: string | null;          // ERP종류(상품명)
  erp_company: string | null;       // ERP업체
  erp_manufacturer: string | null;  // ERP제조사(쇼룸)
  db_type: string | null;           // DB종류
  erp_link_date: string | null;     // ERP연계일자
  link_method: string | null;       // 연계방식
  cancel_date: string | null;       // 해지일자
  cancel_reason: string | null;     // 해지사유
  work_industry: string | null;     // 업종(작업)
  status: CustomerStatus;           // 상태
  open_date: string | null;         // 개설완료일자
  consultant_main: string | null;   // 컨설턴트(주)
  consultant_sub: string | null;    // 컨설턴트(부)
  revenue: number | null;           // 매출액(백만)
  affiliate_count: number | null;   // 계열사수
  account_count: number | null;     // 계좌수
  card_count: number | null;        // 카드수
  notes: string | null;             // 비고
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

// ERP 마스터 인터페이스
export interface ErpMaster {
  id: string;
  product_name: string;    // 상품명
  company_name: string;    // 업체명
  manufacturer: string;    // 제조사
  branches: BranchType[];  // 사용 브랜치
  sort_order: number;      // 정렬 순서
  is_active: boolean;      // 활성 여부
  created_at: string;
  updated_at: string;
}

// 핵심 인력 인터페이스
export interface KeyContact {
  id: string;
  year: number;
  branch: BranchType;
  name: string;
  position: string | null;   // 직책
  department: string | null;  // 부서
  phone: string | null;       // 연락처
  email: string | null;       // 이메일
  duty: string | null;        // 담당업무
  notes: string | null;       // 비고
  created_at: string;
  updated_at: string;
}

// VOC 이력 인터페이스
export interface VocHistory {
  id: string;
  customer_id: string;
  voc_date: string;
  content: string;
  employee_count: number | null;  // 직원수
  company_size: string | null;    // 기업규모
  ceo_name: string | null;        // 대표자명
  founded_date: string | null;    // 설립일
  created_at: string;
  created_by: string | null;
}

// 보고서 이력 인터페이스
export interface ReportHistory {
  id: string;
  report_type: '일간' | '주간' | '월간' | '연간';
  report_date: string;
  branch: BranchType | '전체';
  file_url: string;
  file_format: 'PDF' | 'Excel';
  created_at: string;
  created_by: string | null;
}

// 연간 목표 인터페이스
export interface BranchTarget {
  id: string;
  year: number;
  branch: string;
  target_new: number;
  target_open: number;
  target_linkage: number;
  created_at: string;
  updated_at: string;
}

// 대시보드 KPI 카드 타입
export interface KpiData {
  totalCompleted: number;      // 누적 완료건
  yearlyNewInflow: number;     // 해당연도 신규 인입
  yearlyCancelled: number;     // 해당연도 해지건
  pendingInProgress: number;   // 대기/진행건
  totalCancelled: number;      // 누적 해지건
  grandTotal: number;          // 전체 합계
  yearlyLinked: number;        // 해당연도 ERP 연계건
  yearlyOpened: number;        // 해당연도 개설완료건
  // 전월 대비
  prevMonthNew: number;
  prevMonthCancelled: number;
  prevMonthLinked: number;
  currentMonthNew: number;
  currentMonthCancelled: number;
  currentMonthLinked: number;
}

// 브랜치별 현황 요약
export interface BranchSummary {
  branch: BranchType;
  // 상태별 현황 (합산 = total)
  statusCompleted: number;   // 상태: 완료
  statusInProgress: number;  // 상태: 진행
  statusPending: number;     // 상태: 대기
  statusCancelled: number;   // 상태: 해지
  // 연도별 현황
  yearlyNew: number;         // 해당연도 신규 인입
  yearlyOpened: number;      // 해당연도 개설 완료
  yearlyCancelled: number;   // 해당연도 해지
  yearlyLinked: number;      // 해당연도 ERP 연계
  // 목표
  targetNew: number;
  targetOpen: number;
  targetLinkage: number;
  // 전체
  total: number;
}
