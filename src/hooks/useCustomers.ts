import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { Customer, BranchType, CustomerStatus } from '@/types'

interface CustomerFilters {
  branch: BranchType | '전체'
  status: CustomerStatus | '전체'
  year: string
  erpType: string
  consultant: string
  keyword: string
}

interface UseCustomersReturn {
  customers: Customer[]
  totalCount: number
  isLoading: boolean
  error: string | null
  filters: CustomerFilters
  setFilters: React.Dispatch<React.SetStateAction<CustomerFilters>>
  page: number
  setPage: (page: number) => void
  pageSize: number
  setPageSize: (size: number) => void
  refetch: () => void
  deleteCustomers: (ids: string[]) => Promise<void>
}

export function useCustomers(): UseCustomersReturn {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [filters, setFilters] = useState<CustomerFilters>({
    branch: '전체',
    status: '전체',
    year: '',
    erpType: '',
    consultant: '',
    keyword: '',
  })

  const fetchCustomers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      let query = supabase
        .from('customers')
        .select('*', { count: 'exact' })

      // 필터 적용
      if (filters.branch !== '전체') {
        query = query.eq('branch', filters.branch)
      }
      if (filters.status !== '전체') {
        query = query.eq('status', filters.status)
      }
      if (filters.year) {
        query = query.gte('contract_date', `${filters.year}-01-01`)
          .lte('contract_date', `${filters.year}-12-31`)
      }
      if (filters.erpType) {
        query = query.eq('erp_type', filters.erpType)
      }
      if (filters.consultant) {
        query = query.or(`consultant_main.ilike.%${filters.consultant}%,consultant_sub.ilike.%${filters.consultant}%`)
      }
      if (filters.keyword) {
        query = query.or(`company_name.ilike.%${filters.keyword}%,business_number.ilike.%${filters.keyword}%`)
      }

      // 페이지네이션
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1

      const { data, error: fetchError, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (fetchError) throw fetchError

      setCustomers(data as Customer[])
      setTotalCount(count ?? 0)
    } catch (err) {
      setError(err instanceof Error ? err.message : '데이터를 불러오는데 실패했습니다.')
    } finally {
      setIsLoading(false)
    }
  }, [filters, page, pageSize])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  // 필터 변경 시 페이지 리셋
  useEffect(() => {
    setPage(1)
  }, [filters])

  const deleteCustomers = async (ids: string[]) => {
    // 삭제 전 customers_deleted에 보관
    const { data: toDelete } = await supabase
      .from('customers')
      .select('*')
      .in('id', ids)

    if (toDelete && toDelete.length > 0) {
      const deletedRecords = toDelete.map((row) => ({
        original_id: row.id,
        data: row,
      }))
      await supabase.from('customers_deleted').insert(deletedRecords)
    }

    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .in('id', ids)

    if (deleteError) throw deleteError
    await fetchCustomers()
  }

  return {
    customers,
    totalCount,
    isLoading,
    error,
    filters,
    setFilters,
    page,
    setPage,
    pageSize,
    setPageSize,
    refetch: fetchCustomers,
    deleteCustomers,
  }
}
