// @ts-nocheck
import XLSX from 'xlsx-js-style'
import type { ReportData } from '@/hooks/useReportData'

// 스타일 정의
const STYLES = {
  title: { font: { bold: true, sz: 16, color: { rgb: '1E40AF' } }, alignment: { horizontal: 'center' } },
  subtitle: { font: { bold: true, sz: 12, color: { rgb: '374151' } } },
  header: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E40AF' } }, alignment: { horizontal: 'center' }, border: { bottom: { style: 'thin', color: { rgb: 'D1D5DB' } } } },
  headerGreen: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '059669' } }, alignment: { horizontal: 'center' } },
  headerCyan: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '0891B2' } }, alignment: { horizontal: 'center' } },
  headerPurple: { font: { bold: true, sz: 10, color: { rgb: '7C3AED' } }, fill: { fgColor: { rgb: 'EDE9FE' } }, alignment: { horizontal: 'center' } },
  headerOrange: { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: 'EA580C' } }, alignment: { horizontal: 'center' } },
  label: { font: { bold: true, sz: 10, color: { rgb: '374151' } }, fill: { fgColor: { rgb: 'F3F4F6' } } },
  value: { font: { sz: 10 }, alignment: { horizontal: 'right' } },
  valueGreen: { font: { sz: 10, color: { rgb: '059669' }, bold: true }, alignment: { horizontal: 'right' } },
  valueRed: { font: { sz: 10, color: { rgb: 'DC2626' }, bold: true }, alignment: { horizontal: 'right' } },
  valueBlue: { font: { sz: 10, color: { rgb: '2563EB' }, bold: true }, alignment: { horizontal: 'right' } },
  totalRow: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'E5E7EB' } }, alignment: { horizontal: 'right' } },
  totalLabel: { font: { bold: true, sz: 10 }, fill: { fgColor: { rgb: 'E5E7EB' } } },
  normal: { font: { sz: 10 } },
  normalCenter: { font: { sz: 10 }, alignment: { horizontal: 'center' } },
  warning: { font: { sz: 10, color: { rgb: 'DC2626' } }, fill: { fgColor: { rgb: 'FEF2F2' } } },
  success: { font: { sz: 10, color: { rgb: '059669' } }, fill: { fgColor: { rgb: 'F0FDF4' } } },
  border: { border: { bottom: { style: 'thin', color: { rgb: 'E5E7EB' } } } },
}

function cell(v: string | number, style: object = {}) {
  return { v, s: style }
}

export function generateExcelReport(data: ReportData): Blob {
  const wb = XLSX.utils.book_new()

  // ========== 시트 1: 보고서 요약 ==========
  const s1 = [
    [cell('DB Branch 고객현황 보고서', STYLES.title), cell('', {}), cell('', {}), cell('', {}), cell('', {})],
    [],
    [cell('보고서 유형', STYLES.label), cell(data.reportType, STYLES.normal)],
    [cell('보고 기간', STYLES.label), cell(data.periodLabel, STYLES.normal)],
    [cell('전기 비교', STYLES.label), cell(data.prevPeriodLabel, STYLES.normal)],
    [cell('대상', STYLES.label), cell(data.branch === '전체' ? '전체 브랜치 (사업2섹터)' : data.branch, STYLES.normal)],
    [cell('생성 일시', STYLES.label), cell(data.generatedAt, STYLES.normal)],
    [],
    [cell('핵심 KPI', STYLES.subtitle)],
    [cell('항목', STYLES.header), cell('금기', STYLES.header), cell('전기대비 증감', STYLES.header), cell('목표', STYLES.header), cell('달성율(%)', STYLES.header)],
    [cell('신규 인입', STYLES.label), cell(data.totalMatrix.newCount, STYLES.value), cell(data.totalMatrix.deltaNew, data.totalMatrix.deltaNew >= 0 ? STYLES.valueGreen : STYLES.valueRed), cell(data.totalMatrix.targetNew, STYLES.value), cell(data.totalMatrix.achieveRateNew, data.totalMatrix.achieveRateNew >= 100 ? STYLES.valueGreen : STYLES.valueRed)],
    [cell('개설 완료', STYLES.label), cell(data.totalMatrix.openedCount, STYLES.value), cell(data.totalMatrix.deltaOpened, data.totalMatrix.deltaOpened >= 0 ? STYLES.valueGreen : STYLES.valueRed), cell(data.totalMatrix.targetOpen, STYLES.value), cell(data.totalMatrix.achieveRateOpen, data.totalMatrix.achieveRateOpen >= 100 ? STYLES.valueGreen : STYLES.valueRed)],
    [cell('ERP 연계', STYLES.label), cell(data.totalMatrix.linkedCount, STYLES.value), cell(data.totalMatrix.deltaLinked, data.totalMatrix.deltaLinked >= 0 ? STYLES.valueGreen : STYLES.valueRed), cell(data.totalMatrix.targetLinkage, STYLES.value), cell(data.totalMatrix.achieveRateLinkage, data.totalMatrix.achieveRateLinkage >= 100 ? STYLES.valueGreen : STYLES.valueRed)],
    [cell('해지', STYLES.label), cell(data.totalMatrix.cancelledCount, STYLES.valueRed), cell(data.totalMatrix.deltaCancelled, data.totalMatrix.deltaCancelled <= 0 ? STYLES.valueGreen : STYLES.valueRed), cell('-', STYLES.normalCenter), cell('-', STYLES.normalCenter)],
    [],
    [cell('누적 개설완료', STYLES.label), cell(data.totalMatrix.totalCompleted, STYLES.value)],
    [cell('전체 고객 합계', STYLES.label), cell(data.totalMatrix.totalAll, STYLES.value)],
    [cell('ERP 연계율', STYLES.label), cell(`${data.totalMatrix.linkageRate}%`, STYLES.valueBlue)],
  ]

  // 특이사항/위험
  if (data.highlights.length > 0 || data.risks.length > 0) {
    s1.push([])
    if (data.highlights.length > 0) {
      s1.push([cell('긍정 신호', STYLES.subtitle)])
      data.highlights.forEach(h => s1.push([cell(`✓ ${h}`, STYLES.success)]))
    }
    if (data.risks.length > 0) {
      s1.push([cell('위험 신호', STYLES.subtitle)])
      data.risks.forEach(r => s1.push([cell(`⚠ ${r}`, STYLES.warning)]))
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(s1)
  ws1['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }]
  ws1['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]
  XLSX.utils.book_append_sheet(wb, ws1, '보고서 요약')

  // ========== 시트 2: 브랜치별 매트릭스 ==========
  const m2h = ['브랜치', '신규', '개설', '연계', '해지', '연계율(%)', '신규목표', '신규달성(%)', '연계목표', '연계달성(%)', '연계형', '기본형', '합계'].map(h => cell(h, STYLES.header))
  const m2r = data.branchMatrix.filter(b => b.totalAll > 0).map(b => [
    cell(b.branchLabel, STYLES.label),
    cell(b.newCount, STYLES.value), cell(b.openedCount, STYLES.value), cell(b.linkedCount, STYLES.value),
    cell(b.cancelledCount, STYLES.valueRed),
    cell(`${b.linkageRate}%`, b.linkageRate >= 80 ? STYLES.valueGreen : b.linkageRate >= 50 ? STYLES.valueBlue : STYLES.valueRed),
    cell(b.targetNew, STYLES.normalCenter),
    cell(`${b.achieveRateNew}%`, b.achieveRateNew >= 100 ? STYLES.valueGreen : b.achieveRateNew >= 70 ? STYLES.valueBlue : STYLES.valueRed),
    cell(b.targetLinkage, STYLES.normalCenter),
    cell(`${b.achieveRateLinkage}%`, b.achieveRateLinkage >= 100 ? STYLES.valueGreen : STYLES.valueRed),
    cell(b.linkTypeCount, STYLES.value), cell(b.basicTypeCount, STYLES.value),
    cell(b.totalAll, { ...STYLES.totalRow }),
  ])
  // 합계 행
  m2r.push([
    cell('사업2섹터 합계', STYLES.totalLabel),
    cell(data.totalMatrix.newCount, STYLES.totalRow), cell(data.totalMatrix.openedCount, STYLES.totalRow),
    cell(data.totalMatrix.linkedCount, STYLES.totalRow), cell(data.totalMatrix.cancelledCount, STYLES.totalRow),
    cell(`${data.totalMatrix.linkageRate}%`, STYLES.totalRow),
    cell(data.totalMatrix.targetNew, STYLES.totalRow), cell(`${data.totalMatrix.achieveRateNew}%`, STYLES.totalRow),
    cell(data.totalMatrix.targetLinkage, STYLES.totalRow), cell(`${data.totalMatrix.achieveRateLinkage}%`, STYLES.totalRow),
    cell(data.branchMatrix.reduce((s, b) => s + b.linkTypeCount, 0), STYLES.totalRow),
    cell(data.branchMatrix.reduce((s, b) => s + b.basicTypeCount, 0), STYLES.totalRow),
    cell(data.totalMatrix.totalAll, STYLES.totalRow),
  ])

  const ws2 = XLSX.utils.aoa_to_sheet([
    [cell(`브랜치별 현황 매트릭스 (${data.periodLabel})`, STYLES.subtitle)], [], m2h, ...m2r,
  ])
  ws2['!cols'] = Array(13).fill({ wch: 11 }); ws2['!cols'][0] = { wch: 16 }
  XLSX.utils.book_append_sheet(wb, ws2, '브랜치별 매트릭스')

  // ========== 시트 3: 월별 KPI 추적 ==========
  if (data.monthlyKpiTrack.length > 0) {
    const h3 = ['월', '누적신규', '누적개설', '누적연계', '누적해지', '신규목표', '개설목표', '연계목표'].map(h => cell(h, STYLES.headerGreen))
    const r3 = data.monthlyKpiTrack.map(m => [
      cell(m.month, STYLES.label), cell(m.cumulativeNew, STYLES.value), cell(m.cumulativeOpen, STYLES.value),
      cell(m.cumulativeLink, STYLES.value), cell(m.cumulativeCancel, STYLES.valueRed),
      cell(m.targetNew, STYLES.normalCenter), cell(m.targetOpen, STYLES.normalCenter), cell(m.targetLink, STYLES.normalCenter),
    ])
    const ws3 = XLSX.utils.aoa_to_sheet([[cell(`${data.year}년 월별 KPI 누적 추적`, STYLES.subtitle)], [], h3, ...r3])
    ws3['!cols'] = Array(8).fill({ wch: 12 }); ws3['!cols'][0] = { wch: 8 }
    XLSX.utils.book_append_sheet(wb, ws3, '월별 KPI 추적')
  }

  // ========== 시트 4: 컨설턴트 순위 ==========
  if (data.consultantRanks.length > 0) {
    const h4 = ['순위', '컨설턴트', '브랜치', '신규', '개설', '연계', '고객매출합(백만)'].map(h => cell(h, STYLES.headerOrange))
    const r4 = data.consultantRanks.map(c => [
      cell(c.rank, STYLES.normalCenter),
      cell(c.name, c.rank <= 3 ? { font: { bold: true, sz: 10, color: { rgb: 'B45309' } } } : STYLES.normal),
      cell(c.branch, STYLES.normal),
      cell(c.newCount, STYLES.valueBlue), cell(c.openedCount, STYLES.value), cell(c.linkedCount, STYLES.value),
      cell(c.revenue > 0 ? c.revenue : '-', STYLES.value),
    ])
    const ws4 = XLSX.utils.aoa_to_sheet([[cell(`컨설턴트 실적 순위 (${data.periodLabel})`, STYLES.subtitle)], [], h4, ...r4])
    ws4['!cols'] = [{ wch: 6 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 18 }]
    XLSX.utils.book_append_sheet(wb, ws4, '컨설턴트 순위')
  }

  // ========== 시트 5: ERP 제조사별 ==========
  if (data.manufacturerStats.length > 0) {
    const bls = data.branchMatrix.filter(b => b.totalAll > 0).map(b => b.branchLabel)
    const h5 = ['제조사', ...bls, '합계'].map(h => cell(h, STYLES.headerPurple))
    const r5 = data.manufacturerStats.map(r => [
      cell(r.manufacturer, STYLES.label),
      ...bls.map(bl => cell((r[bl] as number) || 0, STYLES.value)),
      cell((r['합계'] as number) || 0, STYLES.totalRow),
    ])
    const ws5 = XLSX.utils.aoa_to_sheet([[cell('ERP 제조사별 현황', STYLES.subtitle)], [], h5, ...r5])
    ws5['!cols'] = [{ wch: 16 }, ...bls.map(() => ({ wch: 12 })), { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws5, 'ERP 제조사별')
  }

  // ========== 시트 6: 매출구간 ==========
  if (data.revenueSegments.length > 0) {
    const h6 = ['매출 구간', '고객수', '비중(%)', 'ERP연계수', '연계율(%)'].map(h => cell(h, STYLES.headerCyan))
    const r6 = data.revenueSegments.filter(s => s.count > 0).map(s => [
      cell(s.segment, STYLES.label), cell(s.count, STYLES.value), cell(`${s.percentage}%`, STYLES.value),
      cell(s.linkedCount, STYLES.value), cell(`${s.linkRate}%`, s.linkRate >= 80 ? STYLES.valueGreen : STYLES.valueRed),
    ])
    const ws6 = XLSX.utils.aoa_to_sheet([[cell('매출 구간별 고객 분포', STYLES.subtitle)], [], h6, ...r6])
    ws6['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 }]
    XLSX.utils.book_append_sheet(wb, ws6, '매출구간 분석')
  }

  // ========== 시트 7: 신규 고객 ==========
  if (data.topNewCustomers.length > 0) {
    const h7 = ['업체명', '브랜치', '계약일자', 'ERP종류', '매출액(백만)'].map(h => cell(h, STYLES.header))
    const r7 = data.topNewCustomers.map(c => [
      cell(c.company_name, STYLES.normal), cell(c.branch, STYLES.normalCenter), cell(c.contract_date, STYLES.normalCenter),
      cell(c.erp_type || '-', STYLES.normal), cell(c.revenue ?? '-', STYLES.value),
    ])
    const ws7 = XLSX.utils.aoa_to_sheet([[cell(`신규 고객 목록 (${data.periodLabel})`, STYLES.subtitle)], [], h7, ...r7])
    ws7['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws7, '신규 고객')
  }

  // ========== 시트 8: 해지 고객 ==========
  if (data.topCancelledCustomers.length > 0) {
    const h8 = ['업체명', '브랜치', '해지일자', '해지사유', '매출액(백만)'].map(h => cell(h, { ...STYLES.header, fill: { fgColor: { rgb: 'DC2626' } } }))
    const r8 = data.topCancelledCustomers.map(c => [
      cell(c.company_name, STYLES.normal), cell(c.branch, STYLES.normalCenter), cell(c.cancel_date, STYLES.normalCenter),
      cell(c.cancel_reason || '-', STYLES.normal), cell(c.revenue ?? '-', STYLES.value),
    ])
    const ws8 = XLSX.utils.aoa_to_sheet([[cell(`해지 고객 목록 (${data.periodLabel})`, STYLES.subtitle)], [], h8, ...r8])
    ws8['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 12 }, { wch: 28 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws8, '해지 고객')
  }

  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
