import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { fetchAllCustomers } from '@/lib/fetchAll'
import type { BranchType, BranchTarget } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'

const BRANCHES = ALL_BRANCHES

export type ReportType = '일간' | '주간' | '월간' | '연간'

// ====== 브랜치별 핵심 매트릭스 ======
export interface BranchMatrix {
  branch: BranchType
  branchLabel: string
  newCount: number; openedCount: number; linkedCount: number; cancelledCount: number
  totalCompleted: number; totalAll: number; linkageRate: number
  // 목표
  targetNew: number; targetOpen: number; targetLinkage: number
  achieveRateNew: number; achieveRateOpen: number; achieveRateLinkage: number
  // 전기 대비
  prevNewCount: number; prevOpenedCount: number; prevLinkedCount: number; prevCancelledCount: number
  deltaNew: number; deltaOpened: number; deltaLinked: number; deltaCancelled: number
  // 연계형/기본형
  linkTypeCount: number; basicTypeCount: number
  // 매출 합계 (백만)
  totalRevenue: number
}

// ====== 월별 KPI 추적 (목표 대비 누적) ======
export interface MonthlyKpiTrack {
  month: string
  cumulativeNew: number
  cumulativeOpen: number
  cumulativeLink: number
  cumulativeCancel: number
  targetNew: number
  targetOpen: number
  targetLink: number
}

// ====== 컨설턴트 실적 ======
export interface ConsultantRank {
  rank: number
  name: string
  branch: string
  newCount: number
  openedCount: number
  linkedCount: number
  cancelledCount: number
  revenue: number
}

// ====== ERP 제조사별 ======
export interface ManufacturerRow {
  manufacturer: string
  [key: string]: string | number
}

// ====== ERP 연계 ======
export interface ErpLinkRow {
  branch: BranchType; branchLabel: string
  inflowCount: number; linkedCount: number; linkageRate: number
  linkTypeCount: number; basicTypeCount: number
}

// ====== 매출 구간 분석 ======
export interface RevenueSegment {
  segment: string
  count: number
  percentage: number
  linkedCount: number
  linkRate: number
}

// ====== 연도별 추이 ======
export interface YearlyTrend {
  year: number
  newCount: number; openedCount: number; linkedCount: number; cancelledCount: number
  netGrowth: number; cumulative: number
}

// ====== 보고서 전체 데이터 ======
export interface ReportData {
  reportType: ReportType
  periodLabel: string; prevPeriodLabel: string
  startDate: string; endDate: string
  branch: BranchType | '전체'
  generatedAt: string; year: number

  // 1. 브랜치별 매트릭스 (핵심)
  branchMatrix: BranchMatrix[]
  totalMatrix: {
    newCount: number; openedCount: number; linkedCount: number; cancelledCount: number
    totalCompleted: number; totalAll: number; linkageRate: number
    targetNew: number; targetOpen: number; targetLinkage: number
    achieveRateNew: number; achieveRateOpen: number; achieveRateLinkage: number
    deltaNew: number; deltaOpened: number; deltaLinked: number; deltaCancelled: number
    totalRevenue: number
  }

  // 2. 월별 KPI 누적 추적 (연간/월간용)
  monthlyKpiTrack: MonthlyKpiTrack[]

  // 3. ERP 연계
  erpLinkage: ErpLinkRow[]

  // 4. ERP 제조사별
  manufacturerStats: ManufacturerRow[]

  // 5. 컨설턴트 실적 순위
  consultantRanks: ConsultantRank[]

  // 6. 매출 구간 분석
  revenueSegments: RevenueSegment[]

  // 7. 연도별 추이 (연간용)
  yearlyTrends: YearlyTrend[]

  // 8. 신규/해지 고객 목록
  topNewCustomers: Array<{ company_name: string; branch: string; contract_date: string; erp_type: string | null; revenue: number | null }>
  topCancelledCustomers: Array<{ company_name: string; branch: string; cancel_date: string; cancel_reason: string | null; revenue: number | null }>

  // 9. 특이사항 자동 감지
  highlights: string[]

  // 10. 위험 신호
  risks: string[]
}

// 기간 계산
function getPeriodDates(type: ReportType, baseDate: Date) {
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  switch (type) {
    case '일간': {
      const prev = new Date(baseDate); prev.setDate(prev.getDate() - 1)
      return { start: fmt(baseDate), end: fmt(baseDate), label: `${baseDate.getFullYear()}년 ${baseDate.getMonth()+1}월 ${baseDate.getDate()}일`, prevStart: fmt(prev), prevEnd: fmt(prev), prevLabel: `전일 (${prev.getMonth()+1}/${prev.getDate()})` }
    }
    case '주간': {
      const day = baseDate.getDay(); const off = day === 0 ? -6 : 1 - day
      const mon = new Date(baseDate); mon.setDate(baseDate.getDate() + off)
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      const pMon = new Date(mon); pMon.setDate(mon.getDate() - 7)
      const pSun = new Date(sun); pSun.setDate(sun.getDate() - 7)
      return { start: fmt(mon), end: fmt(sun), label: `${fmt(mon)} ~ ${fmt(sun)}`, prevStart: fmt(pMon), prevEnd: fmt(pSun), prevLabel: `전주` }
    }
    case '월간': {
      const s = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
      const e = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0)
      const ps = new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1)
      const pe = new Date(baseDate.getFullYear(), baseDate.getMonth(), 0)
      return { start: fmt(s), end: fmt(e), label: `${baseDate.getFullYear()}년 ${baseDate.getMonth()+1}월`, prevStart: fmt(ps), prevEnd: fmt(pe), prevLabel: `전월 (${ps.getMonth()+1}월)` }
    }
    case '연간': {
      const y = baseDate.getFullYear()
      return { start: `${y}-01-01`, end: `${y}-12-31`, label: `${y}년`, prevStart: `${y-1}-01-01`, prevEnd: `${y-1}-12-31`, prevLabel: `${y-1}년` }
    }
  }
}

export function useReportData() {
  const [isGenerating, setIsGenerating] = useState(false)

  const generateReportData = useCallback(async (type: ReportType, baseDate: Date, branch: BranchType | '전체'): Promise<ReportData> => {
    setIsGenerating(true)
    try {
      const { start, end, label, prevStart, prevEnd, prevLabel } = getPeriodDates(type, baseDate)
      const year = baseDate.getFullYear()

      const [allRaw, { data: targetsData }] = await Promise.all([
        fetchAllCustomers(),
        supabase.from('branch_targets').select('*').eq('year', year),
      ])

      let all = allRaw
      if (!all) throw new Error('데이터 조회 실패')
      if (branch !== '전체') all = all.filter((c) => c.branch === branch)

      const targets = (targetsData ?? []) as BranchTarget[]
      const inP = (d: string | null) => d ? d >= start && d <= end : false
      const inPrev = (d: string | null) => d ? d >= prevStart && d <= prevEnd : false

      const targetBranches = branch === '전체' ? BRANCHES : [branch]

      // ====== 1. 브랜치별 매트릭스 ======
      const branchMatrix: BranchMatrix[] = targetBranches.map((b) => {
        const bd = all.filter((c) => c.branch === b)
        const t = targets.find((t) => t.branch === b)
        const nc = bd.filter(c => inP(c.contract_date)).length
        const oc = bd.filter(c => inP(c.open_date)).length
        const lc = bd.filter(c => inP(c.erp_link_date)).length
        const cc = bd.filter(c => inP(c.cancel_date)).length
        const pnc = bd.filter(c => inPrev(c.contract_date)).length
        const poc = bd.filter(c => inPrev(c.open_date)).length
        const plc = bd.filter(c => inPrev(c.erp_link_date)).length
        const pcc = bd.filter(c => inPrev(c.cancel_date)).length
        const tc = bd.filter(c => c.status === '완료').length
        const ltc = bd.filter(c => c.erp_link_date).length
        const btc = tc - ltc
        const tNew = t?.target_new ?? 0; const tOpen = t?.target_open ?? 0; const tLink = t?.target_linkage ?? 0
        const rev = bd.reduce((s, c) => s + (c.revenue || 0), 0)

        return {
          branch: b, branchLabel: BRANCH_LABELS[b],
          newCount: nc, openedCount: oc, linkedCount: lc, cancelledCount: cc,
          totalCompleted: tc, totalAll: bd.length,
          linkageRate: tc > 0 ? Math.round((ltc / tc) * 1000) / 10 : 0,
          targetNew: tNew, targetOpen: tOpen, targetLinkage: tLink,
          achieveRateNew: tNew > 0 ? Math.round((nc / tNew) * 1000) / 10 : 0,
          achieveRateOpen: tOpen > 0 ? Math.round((oc / tOpen) * 1000) / 10 : 0,
          achieveRateLinkage: tLink > 0 ? Math.round((lc / tLink) * 1000) / 10 : 0,
          prevNewCount: pnc, prevOpenedCount: poc, prevLinkedCount: plc, prevCancelledCount: pcc,
          deltaNew: nc - pnc, deltaOpened: oc - poc, deltaLinked: lc - plc, deltaCancelled: cc - pcc,
          linkTypeCount: ltc, basicTypeCount: btc > 0 ? btc : 0,
          totalRevenue: rev,
        }
      })

      // 합계
      const sm = (k: keyof BranchMatrix) => branchMatrix.reduce((s, b) => s + (b[k] as number), 0)
      const tAll = sm('totalAll'); const tComp = sm('totalCompleted'); const tLink = sm('linkedCount')
      const tTN = sm('targetNew'); const tTO = sm('targetOpen'); const tTL = sm('targetLinkage')
      const sNew = sm('newCount')
      const totalMatrix = {
        newCount: sNew, openedCount: sm('openedCount'), linkedCount: tLink, cancelledCount: sm('cancelledCount'),
        totalCompleted: tComp, totalAll: tAll,
        linkageRate: tComp > 0 ? Math.round((sm('linkTypeCount') / tComp) * 1000) / 10 : 0,
        targetNew: tTN, targetOpen: tTO, targetLinkage: tTL,
        achieveRateNew: tTN > 0 ? Math.round((sNew / tTN) * 1000) / 10 : 0,
        achieveRateOpen: tTO > 0 ? Math.round((sm('openedCount') / tTO) * 1000) / 10 : 0,
        achieveRateLinkage: tTL > 0 ? Math.round((tLink / tTL) * 1000) / 10 : 0,
        deltaNew: sm('deltaNew'), deltaOpened: sm('deltaOpened'), deltaLinked: sm('deltaLinked'), deltaCancelled: sm('deltaCancelled'),
        totalRevenue: sm('totalRevenue'),
      }

      // ====== 2. 월별 KPI 누적 추적 ======
      const monthlyKpiTrack: MonthlyKpiTrack[] = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1
        // 1월~해당월 누적
        let cumNew = 0, cumOpen = 0, cumLink = 0, cumCancel = 0
        for (let j = 1; j <= m; j++) {
          const js = `${year}-${String(j).padStart(2, '0')}`
          cumNew += all.filter(c => c.contract_date && c.contract_date.startsWith(js)).length
          cumOpen += all.filter(c => c.open_date && c.open_date.startsWith(js)).length
          cumLink += all.filter(c => c.erp_link_date && c.erp_link_date.startsWith(js)).length
          cumCancel += all.filter(c => c.cancel_date && c.cancel_date.startsWith(js)).length
        }
        return {
          month: `${m}월`,
          cumulativeNew: cumNew, cumulativeOpen: cumOpen, cumulativeLink: cumLink, cumulativeCancel: cumCancel,
          targetNew: tTN, targetOpen: tTO, targetLink: tTL,
        }
      })

      // ====== 3. ERP 연계 ======
      const erpLinkage: ErpLinkRow[] = targetBranches.map((b) => {
        const bd = all.filter(c => c.branch === b)
        const comp = bd.filter(c => c.status === '완료')
        const linked = comp.filter(c => c.erp_link_date)
        return {
          branch: b, branchLabel: BRANCH_LABELS[b],
          inflowCount: comp.length, linkedCount: linked.length,
          linkageRate: comp.length > 0 ? Math.round((linked.length / comp.length) * 1000) / 10 : 0,
          linkTypeCount: linked.length, basicTypeCount: comp.length - linked.length,
        }
      })

      // ====== 4. 제조사별 ======
      const cwm = all.filter(c => c.erp_manufacturer)
      const mfrs = [...new Set(cwm.map(c => c.erp_manufacturer as string))].sort()
      const manufacturerStats: ManufacturerRow[] = mfrs.map(mfr => {
        const row: ManufacturerRow = { manufacturer: mfr }
        let total = 0
        targetBranches.forEach(b => {
          const cnt = cwm.filter(c => c.erp_manufacturer === mfr && c.branch === b).length
          row[BRANCH_LABELS[b]] = cnt; total += cnt
        })
        row['합계'] = total
        return row
      }).filter(r => (r['합계'] as number) > 0).sort((a, b) => (b['합계'] as number) - (a['합계'] as number))

      // ====== 5. 컨설턴트 순위 ======
      const consultantMap: Record<string, { branch: string; newC: number; openC: number; linkC: number; cancelC: number; rev: number }> = {}
      all.filter(c => c.consultant_main && inP(c.contract_date)).forEach(c => {
        const n = c.consultant_main
        if (!consultantMap[n]) consultantMap[n] = { branch: c.branch, newC: 0, openC: 0, linkC: 0, cancelC: 0, rev: 0 }
        consultantMap[n].newC++
        consultantMap[n].rev += (c.revenue || 0)
      })
      all.filter(c => c.consultant_main && inP(c.open_date)).forEach(c => {
        if (consultantMap[c.consultant_main]) consultantMap[c.consultant_main].openC++
      })
      all.filter(c => c.consultant_main && inP(c.erp_link_date)).forEach(c => {
        if (consultantMap[c.consultant_main]) consultantMap[c.consultant_main].linkC++
      })
      const consultantRanks: ConsultantRank[] = Object.entries(consultantMap)
        .sort((a, b) => b[1].newC - a[1].newC)
        .slice(0, 15)
        .map(([name, d], i) => ({
          rank: i + 1, name, branch: BRANCH_LABELS[d.branch as BranchType] ?? d.branch,
          newCount: d.newC, openedCount: d.openC, linkedCount: d.linkC, cancelledCount: d.cancelC,
          revenue: d.rev,
        }))

      // ====== 6. 매출 구간 분석 ======
      const segments = [
        { label: '100백만 미만', min: 0, max: 100 },
        { label: '100~500백만', min: 100, max: 500 },
        { label: '500~1,000백만', min: 500, max: 1000 },
        { label: '1,000~5,000백만', min: 1000, max: 5000 },
        { label: '5,000백만 이상', min: 5000, max: Infinity },
      ]
      const revenueSegments: RevenueSegment[] = segments.map(seg => {
        const filtered = all.filter(c => c.revenue && c.revenue >= seg.min && c.revenue < seg.max)
        const linked = filtered.filter(c => c.erp_link_date)
        return {
          segment: seg.label, count: filtered.length,
          percentage: all.length > 0 ? Math.round((filtered.length / all.length) * 1000) / 10 : 0,
          linkedCount: linked.length,
          linkRate: filtered.length > 0 ? Math.round((linked.length / filtered.length) * 1000) / 10 : 0,
        }
      })

      // ====== 7. 연도별 추이 (연간용) ======
      const yearlyTrends: YearlyTrend[] = []
      if (type === '연간') {
        const years = [...new Set(all.filter(c => c.contract_date).map(c => Number(c.contract_date.substring(0, 4))))].sort()
        let cum = 0
        years.forEach(y => {
          const nc = all.filter(c => c.contract_date && c.contract_date.startsWith(String(y))).length
          const oc = all.filter(c => c.open_date && c.open_date.startsWith(String(y))).length
          const lc = all.filter(c => c.erp_link_date && c.erp_link_date.startsWith(String(y))).length
          const cc = all.filter(c => c.cancel_date && c.cancel_date.startsWith(String(y))).length
          cum += nc - cc
          yearlyTrends.push({ year: y, newCount: nc, openedCount: oc, linkedCount: lc, cancelledCount: cc, netGrowth: nc - cc, cumulative: cum })
        })
      }

      // ====== 8. 고객 목록 ======
      const newInP = all.filter(c => inP(c.contract_date))
      const topNewCustomers = newInP.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 20)
        .map(c => ({ company_name: c.company_name, branch: BRANCH_LABELS[c.branch as BranchType] ?? c.branch, contract_date: c.contract_date ?? '', erp_type: c.erp_type, revenue: c.revenue }))
      const cancelInP = all.filter(c => inP(c.cancel_date))
      const topCancelledCustomers = cancelInP.sort((a, b) => (b.revenue ?? 0) - (a.revenue ?? 0)).slice(0, 20)
        .map(c => ({ company_name: c.company_name, branch: BRANCH_LABELS[c.branch as BranchType] ?? c.branch, cancel_date: c.cancel_date ?? '', cancel_reason: c.cancel_reason, revenue: c.revenue }))

      // ====== 9. 특이사항 ======
      const highlights: string[] = []
      const bigNew = newInP.filter(c => c.revenue && c.revenue >= 1000)
      if (bigNew.length > 0) highlights.push(`대형 신규 고객 ${bigNew.length}건 (매출 1,000백만↑): ${bigNew.slice(0, 3).map(c => c.company_name).join(', ')}${bigNew.length > 3 ? ' 외' : ''}`)
      branchMatrix.forEach(b => {
        if (b.targetNew > 0 && b.achieveRateNew >= 100) highlights.push(`${b.branchLabel}: 신규 목표 초과 달성 (${b.achieveRateNew}%)`)
      })
      if (totalMatrix.achieveRateNew >= 100) highlights.push(`사업2섹터 전체 신규 목표 달성 완료 (${totalMatrix.achieveRateNew}%)`)

      // ====== 10. 위험 신호 ======
      const risks: string[] = []
      branchMatrix.forEach(b => {
        if (b.targetNew > 0 && b.achieveRateNew < 50 && b.achieveRateNew > 0) risks.push(`${b.branchLabel}: 신규 달성율 ${b.achieveRateNew}% - 목표 대비 부진`)
        if (b.cancelledCount > b.newCount && b.newCount > 0) risks.push(`${b.branchLabel}: 해지(${b.cancelledCount}) > 신규(${b.newCount}) - 순감소 발생`)
        if (b.linkageRate < 40 && b.totalCompleted > 100) risks.push(`${b.branchLabel}: 연계율 ${b.linkageRate}% - 연계 전환 강화 필요`)
      })
      const bigCancel = cancelInP.filter(c => c.revenue && c.revenue >= 1000)
      if (bigCancel.length > 0) risks.push(`대형 고객 해지 ${bigCancel.length}건 (매출 1,000백만↑): ${bigCancel.slice(0, 3).map(c => c.company_name).join(', ')}`)

      return {
        reportType: type, periodLabel: label, prevPeriodLabel: prevLabel,
        startDate: start, endDate: end, branch,
        generatedAt: new Date().toLocaleString('ko-KR'), year,
        branchMatrix, totalMatrix, monthlyKpiTrack,
        erpLinkage, manufacturerStats, consultantRanks, revenueSegments, yearlyTrends,
        topNewCustomers, topCancelledCustomers, highlights, risks,
      }
    } finally {
      setIsGenerating(false)
    }
  }, [])

  return { generateReportData, isGenerating }
}
