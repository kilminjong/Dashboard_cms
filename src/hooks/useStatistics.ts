import { useState, useEffect, useCallback } from 'react'
import { fetchAllCustomers } from '@/lib/fetchAll'
import { ALL_BRANCHES } from '@/types'

const BRANCHES = ALL_BRANCHES

// ERP 연계 현황
export interface ErpLinkageRow {
  branch: BranchType
  inflowCount: number
  linkedCount: number
  linkageRate: number
}

// ERP 종류별 통계
export interface ErpTypeRow {
  erpType: string
  [branch: string]: string | number  // 브랜치별 카운트 + 합계
}

// 제조사별 현황
export interface ManufacturerRow {
  manufacturer: string
  [branch: string]: string | number
}

// 연도별 추이
export interface YearlyTrendRow {
  year: number
  [key: string]: number | string
}

export function useStatistics(year: number) {
  const [erpLinkage, setErpLinkage] = useState<ErpLinkageRow[]>([])
  const [erpTypeStats, setErpTypeStats] = useState<ErpTypeRow[]>([])
  const [manufacturerStats, setManufacturerStats] = useState<ManufacturerRow[]>([])
  const [yearlyTrends, setYearlyTrends] = useState<YearlyTrendRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchStatistics = useCallback(async () => {
    setIsLoading(true)
    try {
      const allCustomers = await fetchAllCustomers()
      if (!allCustomers || allCustomers.length === 0) return

      // 1. ERP 연계 현황
      const linkageData: ErpLinkageRow[] = BRANCHES.map((b) => {
        const branchData = allCustomers.filter((c) =>
          c.branch === b && c.contract_date && new Date(c.contract_date).getFullYear() === year
        )
        const linked = branchData.filter((c) => c.erp_link_date !== null)
        return {
          branch: b,
          inflowCount: branchData.length,
          linkedCount: linked.length,
          linkageRate: branchData.length > 0 ? Math.round((linked.length / branchData.length) * 100 * 10) / 10 : 0,
        }
      })
      setErpLinkage(linkageData)

      // 2. ERP 종류별 통계 (완료 고객 기준)
      const completedCustomers = allCustomers.filter((c) => c.status === '완료' && c.erp_type)
      const erpTypes = [...new Set(completedCustomers.map((c) => c.erp_type!))].sort()
      const typeStats: ErpTypeRow[] = erpTypes.map((type) => {
        const row: ErpTypeRow = { erpType: type }
        let total = 0
        BRANCHES.forEach((b) => {
          const count = completedCustomers.filter((c) => c.erp_type === type && c.branch === b).length
          row[b] = count
          total += count
        })
        row['합계'] = total
        return row
      })
      // 합계 행
      const typeTotal: ErpTypeRow = { erpType: '합계' }
      let grandTotal = 0
      BRANCHES.forEach((b) => {
        const sum = typeStats.reduce((s, r) => s + (r[b] as number), 0)
        typeTotal[b] = sum
        grandTotal += sum
      })
      typeTotal['합계'] = grandTotal
      setErpTypeStats([...typeStats, typeTotal])

      // 3. 제조사별 현황
      const customersWithMfr = allCustomers.filter((c) => c.erp_manufacturer)
      const manufacturers = [...new Set(customersWithMfr.map((c) => c.erp_manufacturer!))].sort()
      const mfrStats: ManufacturerRow[] = manufacturers.map((mfr) => {
        const row: ManufacturerRow = { manufacturer: mfr }
        let total = 0
        BRANCHES.forEach((b) => {
          const count = customersWithMfr.filter((c) => c.erp_manufacturer === mfr && c.branch === b).length
          row[b] = count
          total += count
        })
        row['합계'] = total
        return row
      })
      setManufacturerStats(mfrStats)

      // 4. 연도별 추이
      const years = [...new Set(allCustomers
        .filter((c) => c.contract_date)
        .map((c) => new Date(c.contract_date!).getFullYear())
      )].sort()

      let cumulative: Record<string, number> = {}
      BRANCHES.forEach((b) => { cumulative[b] = 0 })

      const trends: YearlyTrendRow[] = years.map((y) => {
        const row: YearlyTrendRow = { year: y }
        let totalNew = 0, totalCancel = 0, totalCum = 0

        BRANCHES.forEach((b) => {
          const newCount = allCustomers.filter((c) =>
            c.branch === b && c.contract_date && new Date(c.contract_date).getFullYear() === y
          ).length
          const cancelCount = allCustomers.filter((c) =>
            c.branch === b && c.cancel_date && new Date(c.cancel_date).getFullYear() === y
          ).length

          cumulative[b] += newCount - cancelCount
          row[`${b}_신규`] = newCount
          row[`${b}_해지`] = cancelCount
          row[`${b}_누적`] = cumulative[b]
          totalNew += newCount
          totalCancel += cancelCount
          totalCum += cumulative[b]
        })

        row['전체_신규'] = totalNew
        row['전체_해지'] = totalCancel
        row['전체_누적'] = totalCum
        row['전체_순증'] = totalNew - totalCancel
        return row
      })
      setYearlyTrends(trends)
    } catch (err) {
      console.error('Statistics fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [year])

  useEffect(() => {
    fetchStatistics()
  }, [fetchStatistics])

  return { erpLinkage, erpTypeStats, manufacturerStats, yearlyTrends, isLoading }
}
