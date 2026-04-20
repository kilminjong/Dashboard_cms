import { supabase } from '@/lib/supabase'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CustomerRow = Record<string, any>

/**
 * Supabase 기본 한도(1000건)를 넘어 전체 데이터를 가져오는 함수
 * 1000건씩 페이지네이션하여 모든 레코드를 조회합니다.
 */
export async function fetchAllCustomers(): Promise<CustomerRow[]> {
  const PAGE_SIZE = 1000
  const allData: CustomerRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    if (!data || data.length === 0) break

    allData.push(...data)

    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return allData
}
