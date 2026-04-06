export interface Profile {
  id: string
  name: string
  email: string
  phone: string
  created_at: string
  updated_at: string
}

export interface Schedule {
  id: string
  user_id: string
  title: string
  description: string
  start_date: string
  end_date: string | null
  color: string
  created_at: string
}

export interface Customer {
  id: string
  duplicate_check: string
  management_code: string
  customer_number: string
  business_number: string
  customer_name: string
  build_type: string
  management_type: string
  construction_type: string
  manager: string
  reception_date: string | null
  customer_contact_person: string
  customer_department: string
  contact_phone: string
  contact_email: string
  opening_status: string
  opening_date: string | null
  connection_status: string
  connection_date: string | null
  erp_company: string
  erp_type: string
  erp_db: string
  connection_method: string
  server_location: string
  schedule_use: string
  customer_ip: string
  sensitive_customer: string
  intimacy: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ImportLog {
  id: string
  user_id: string
  file_name: string
  total_count: number
  success_count: number
  fail_count: number
  created_at: string
}
