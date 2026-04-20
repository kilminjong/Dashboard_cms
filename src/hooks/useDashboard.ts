import { useState, useEffect, useCallback } from 'react'
import { fetchAllCustomers } from '@/lib/fetchAll'
import { supabase } from '@/lib/supabase'
import type { BranchType, KpiData, BranchSummary, BranchTarget } from '@/types'
import { ALL_BRANCHES } from '@/types'

const BRANCHES = ALL_BRANCHES

interface MonthlyTrend {
  month: string
  newCount: number
  cancelCount: number
  linkCount: number
  openCount: number
}

interface DashboardData {
  kpi: KpiData
  branchSummaries: BranchSummary[]
  monthlyTrends: MonthlyTrend[]
  lastUpdated: string | null
  targets: BranchTarget[]
}

const emptyKpi: KpiData = {
  totalCompleted: 0, yearlyNewInflow: 0, yearlyCancelled: 0, pendingInProgress: 0,
  totalCancelled: 0, grandTotal: 0, yearlyLinked: 0, yearlyOpened: 0,
  prevMonthNew: 0, prevMonthCancelled: 0, prevMonthLinked: 0,
  currentMonthNew: 0, currentMonthCancelled: 0, currentMonthLinked: 0,
}

export function useDashboard(year: number, branch: BranchType | '전체') {
  const [data, setData] = useState<DashboardData>({
    kpi: emptyKpi, branchSummaries: [], monthlyTrends: [], lastUpdated: null, targets: [],
  })
  const [isLoading, setIsLoading] = useState(true)

  const fetchDashboard = useCallback(async () => {
    setIsLoading(true)
    try {
      // 전체 데이터 + 목표 병렬 조회
      const [allCustomersRaw, { data: targetsData }] = await Promise.all([
        fetchAllCustomers(),
        supabase.from('branch_targets').select('*').eq('year', year),
      ])

      let allCustomers = allCustomersRaw
      if (!allCustomers || allCustomers.length === 0) {
        setIsLoading(false)
        return
      }

      const targets = (targetsData ?? []) as BranchTarget[]

      if (branch !== '전체') {
        allCustomers = allCustomers.filter((c) => c.branch === branch)
      }

      // 날짜 헬퍼
      const yearMatch = (date: string | null) => date && new Date(date).getFullYear() === year
      const monthMatch = (date: string | null, m: string) => date && date.startsWith(m)

      // 현재/전월 계산
      const now = new Date()
      const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`

      // KPI 계산
      const totalCompleted = allCustomers.filter((c) => c.status === '완료').length
      const yearlyNewInflow = allCustomers.filter((c) => yearMatch(c.contract_date)).length
      const yearlyCancelled = allCustomers.filter((c) => yearMatch(c.cancel_date)).length
      const yearlyLinked = allCustomers.filter((c) => yearMatch(c.erp_link_date)).length
      const yearlyOpened = allCustomers.filter((c) => yearMatch(c.open_date)).length
      const pendingInProgress = allCustomers.filter((c) => c.status === '대기' || c.status === '진행').length
      const totalCancelled = allCustomers.filter((c) => c.cancel_date !== null).length
      const grandTotal = allCustomers.length

      // 전월/당월 비교
      const currentMonthNew = allCustomers.filter((c) => monthMatch(c.contract_date, curMonth)).length
      const currentMonthCancelled = allCustomers.filter((c) => monthMatch(c.cancel_date, curMonth)).length
      const currentMonthLinked = allCustomers.filter((c) => monthMatch(c.erp_link_date, curMonth)).length
      const prevMonthNew = allCustomers.filter((c) => monthMatch(c.contract_date, prevMonth)).length
      const prevMonthCancelled = allCustomers.filter((c) => monthMatch(c.cancel_date, prevMonth)).length
      const prevMonthLinked = allCustomers.filter((c) => monthMatch(c.erp_link_date, prevMonth)).length

      // 브랜치별 요약
      const branchSummaries: BranchSummary[] = BRANCHES.map((b) => {
        const bd = allCustomers.filter((c) => c.branch === b)
        const t = targets.find((t) => t.branch === b)
        return {
          branch: b,
          statusCompleted: bd.filter((c) => c.status === '완료').length,
          statusInProgress: bd.filter((c) => c.status === '진행').length,
          statusPending: bd.filter((c) => c.status === '대기').length,
          statusCancelled: bd.filter((c) => c.status === '해지').length,
          yearlyNew: bd.filter((c) => yearMatch(c.contract_date)).length,
          yearlyOpened: bd.filter((c) => yearMatch(c.open_date)).length,
          yearlyCancelled: bd.filter((c) => yearMatch(c.cancel_date)).length,
          yearlyLinked: bd.filter((c) => yearMatch(c.erp_link_date)).length,
          targetNew: t?.target_new ?? 0,
          targetOpen: t?.target_open ?? 0,
          targetLinkage: t?.target_linkage ?? 0,
          total: bd.length,
        }
      })

      // 월별 추이
      const monthlyTrends: MonthlyTrend[] = Array.from({ length: 12 }, (_, i) => {
        const month = i + 1
        const ms = `${year}-${String(month).padStart(2, '0')}`
        return {
          month: `${month}월`,
          newCount: allCustomers.filter((c) => monthMatch(c.contract_date, ms)).length,
          cancelCount: allCustomers.filter((c) => monthMatch(c.cancel_date, ms)).length,
          linkCount: allCustomers.filter((c) => monthMatch(c.erp_link_date, ms)).length,
          openCount: allCustomers.filter((c) => monthMatch(c.open_date, ms)).length,
        }
      })

      const lastUpdated = allCustomers.length > 0
        ? allCustomers.reduce((latest, c) => c.updated_at > latest ? c.updated_at : latest, allCustomers[0].updated_at)
        : null

      setData({
        kpi: {
          totalCompleted, yearlyNewInflow, yearlyCancelled, pendingInProgress,
          totalCancelled, grandTotal, yearlyLinked, yearlyOpened,
          prevMonthNew, prevMonthCancelled, prevMonthLinked,
          currentMonthNew, currentMonthCancelled, currentMonthLinked,
        },
        branchSummaries,
        monthlyTrends,
        lastUpdated,
        targets,
      })
    } catch (err) {
      console.error('Dashboard fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [year, branch])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  return { ...data, isLoading, refetch: fetchDashboard }
}
