/**
 * 보고서 미리보기 - 개별 섹션 렌더러
 * 각 섹션은 viewMode에 따라 카드/테이블/차트 형태로 전환 가능
 */
import type { ReportData } from '@/hooks/useReportData'
import type { ViewMode } from '@/store/reportLayoutStore'
import {
  TrendingUp, TrendingDown, Link2, ShieldAlert, Trophy,
  ArrowUpRight, ArrowDownRight, Minus, MessageSquareText, CircleDot,
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, ComposedChart,
} from 'recharts'
import { BRANCH_LABELS, type BranchType } from '@/types'

// ===== 공통 컴포넌트 =====
function Delta({ value }: { value: number }) {
  if (value === 0) return <span style={{ color: '#9ca3af', fontSize: '10px' }}><Minus size={9} className="inline" /> 0</span>
  if (value > 0) return <span style={{ color: '#059669', fontSize: '10px' }}><ArrowUpRight size={9} className="inline" />+{value}</span>
  return <span style={{ color: '#ef4444', fontSize: '10px' }}><ArrowDownRight size={9} className="inline" />{value}</span>
}

function TrafficLight({ rate }: { rate: number }) {
  if (rate === 0) return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#d1d5db' }} />
  if (rate >= 90) return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#22c55e' }} />
  if (rate >= 60) return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#eab308' }} />
  return <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: '#ef4444', animation: 'pulse 2s infinite' }} />
}

function AchieveBar({ rate }: { rate: number }) {
  if (rate === 0) return <span style={{ fontSize: '10px', color: '#9ca3af' }}>-</span>
  const w = Math.min(rate, 100)
  const c = rate >= 100 ? '#22c55e' : rate >= 70 ? '#3b82f6' : rate >= 40 ? '#eab308' : '#ef4444'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <TrafficLight rate={rate} />
      <div style={{ flex: 1, backgroundColor: '#e5e7eb', borderRadius: 9999, height: 5, minWidth: 30 }}>
        <div style={{ backgroundColor: c, height: 5, borderRadius: 9999, width: `${w}%` }} />
      </div>
      <span style={{ fontSize: '10px', fontWeight: 700, color: c, width: 36, textAlign: 'right' }}>{rate}%</span>
    </div>
  )
}

// ===== 컨텍스트 요약 생성 =====
function generateContextSummary(d: ReportData): string[] {
  const lines: string[] = []
  const tm = d.totalMatrix
  lines.push(`${d.periodLabel} 기준, 사업2섹터 전체 ${tm.totalAll.toLocaleString()}건의 고객을 관리 중이며, ${tm.totalCompleted.toLocaleString()}건(${tm.totalAll > 0 ? Math.round(tm.totalCompleted / tm.totalAll * 100) : 0}%)이 개설 완료 상태입니다.`)
  if (tm.linkageRate > 0) {
    const ls = tm.linkageRate >= 70 ? '양호한 수준' : tm.linkageRate >= 50 ? '개선이 필요한 수준' : '시급히 개선이 필요한 수준'
    lines.push(`ERP 연계율은 ${tm.linkageRate}%로 ${ls}입니다.`)
  }
  if (tm.targetNew > 0) {
    if (tm.achieveRateNew >= 100) lines.push(`신규 인입 목표(${tm.targetNew}건) 대비 ${tm.achieveRateNew}% 달성으로 목표를 초과 달성했습니다.`)
    else { const gap = tm.targetNew - tm.newCount; lines.push(`신규 인입 목표(${tm.targetNew}건) 대비 ${tm.achieveRateNew}% 달성 중이며, ${gap}건의 추가 확보가 필요합니다.`) }
  }
  if (tm.deltaNew !== 0) lines.push(`전기 대비 신규 ${Math.abs(tm.deltaNew)}건 ${tm.deltaNew > 0 ? '증가' : '감소'}, 해지 ${Math.abs(tm.deltaCancelled)}건 ${tm.deltaCancelled >= 0 ? '증가' : '감소'}했습니다.`)
  const under = d.branchMatrix.filter(b => b.targetNew > 0 && b.achieveRateNew < 50 && b.achieveRateNew > 0)
  if (under.length > 0) lines.push(`주의: ${under.map(b => `${b.branchLabel}(${b.achieveRateNew}%)`).join(', ')} 달성율 50% 미만, 집중 관리 필요.`)
  return lines
}

// ===== 섹션 렌더러 =====
interface SectionProps {
  d: ReportData
  viewMode: ViewMode
  customKpis?: Array<{ kpi_name: string; branch: string; target_value: number; actual_value: number; unit: string }>
}

// 경영진 요약
export function SummarySection({ d }: SectionProps) {
  const lines = generateContextSummary(d)
  return (
    <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: 14 }}>
      <h4 style={{ fontSize: 12, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <MessageSquareText size={14} /> 경영진 요약 (Executive Summary)
      </h4>
      {lines.map((l, i) => <p key={i} style={{ fontSize: 11, color: '#1e3a5f', lineHeight: 1.7, marginBottom: 2 }}>• {l}</p>)}
    </div>
  )
}

// 위험/긍정 신호
export function AlertsSection({ d }: SectionProps) {
  if (d.risks.length === 0 && d.highlights.length === 0) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: d.risks.length > 0 && d.highlights.length > 0 ? '1fr 1fr' : '1fr', gap: 10 }}>
      {d.risks.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: 12 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><ShieldAlert size={14} /> 위험 신호 ({d.risks.length})</h4>
          {d.risks.map((r, i) => <p key={i} style={{ fontSize: 10, color: '#7f1d1d', marginBottom: 3 }}>⚠ {r}</p>)}
        </div>
      )}
      {d.highlights.length > 0 && (
        <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 12 }}>
          <h4 style={{ fontSize: 12, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}><TrendingUp size={14} /> 긍정 신호 ({d.highlights.length})</h4>
          {d.highlights.map((h, i) => <p key={i} style={{ fontSize: 10, color: '#14532d', marginBottom: 3 }}>✓ {h}</p>)}
        </div>
      )}
    </div>
  )
}

// KPI 카드 / 테이블
export function KpiSection({ d, viewMode }: SectionProps) {
  const tm = d.totalMatrix
  const items = [
    { label: '신규 인입', value: tm.newCount, delta: tm.deltaNew, target: tm.targetNew, achieve: tm.achieveRateNew, color: '#2563eb' },
    { label: '개설 완료', value: tm.openedCount, delta: tm.deltaOpened, target: tm.targetOpen, achieve: tm.achieveRateOpen, color: '#059669' },
    { label: 'ERP 연계', value: tm.linkedCount, delta: tm.deltaLinked, target: tm.targetLinkage, achieve: tm.achieveRateLinkage, color: '#0891b2' },
    { label: '해지', value: tm.cancelledCount, delta: tm.deltaCancelled, color: '#dc2626' },
    { label: 'ERP 연계율', value: `${tm.linkageRate}%`, color: '#7c3aed' },
    { label: '전체 고객', value: tm.totalAll.toLocaleString(), color: '#374151' },
  ]

  if (viewMode === 'table') {
    return (
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead><tr style={{ backgroundColor: '#f3f4f6' }}>
          <th style={{ padding: '8px 12px', textAlign: 'left' }}>지표</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>수치</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>전기대비</th>
          <th style={{ padding: '8px', textAlign: 'right' }}>목표</th>
          <th style={{ padding: '8px', textAlign: 'center', minWidth: 100 }}>달성율</th>
        </tr></thead>
        <tbody>{items.map(item => (
          <tr key={item.label} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '6px 12px', fontWeight: 600 }}>{item.label}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, fontSize: 14 }}>{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.delta !== undefined ? <Delta value={item.delta} /> : '-'}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{item.target ?? '-'}</td>
            <td style={{ padding: '6px 8px' }}>{item.achieve !== undefined ? <AchieveBar rate={item.achieve} /> : '-'}</td>
          </tr>
        ))}</tbody>
      </table>
    )
  }

  return (
    <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
      {items.map(card => (
        <div key={card.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, borderLeft: `4px solid ${card.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 10, color: '#6b7280' }}>{card.label}</p>
            {card.achieve !== undefined && <TrafficLight rate={card.achieve} />}
          </div>
          <p style={{ fontSize: 20, fontWeight: 700, color: '#1f2937', margin: '4px 0' }}>{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
          {card.delta !== undefined && <Delta value={card.delta} />}
          {card.target !== undefined && card.target > 0 && (
            <div style={{ marginTop: 6 }}><p style={{ fontSize: 9, color: '#9ca3af' }}>목표 {card.target} 대비</p><AchieveBar rate={card.achieve!} /></div>
          )}
        </div>
      ))}
    </div>
  )
}

// 브랜치별 매트릭스
export function MatrixSection({ d }: SectionProps) {
  const ab = d.branchMatrix.filter(b => b.totalAll > 0)
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead><tr style={{ backgroundColor: '#f3f4f6' }}>
          <th style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600 }}>브랜치</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', color: '#2563eb' }}>신규</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>개설</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', color: '#0891b2' }}>연계</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', color: '#dc2626' }}>해지</th>
          <th style={{ padding: '8px 6px', textAlign: 'center', color: '#7c3aed' }}>연계율</th>
          <th style={{ padding: '8px 6px', textAlign: 'center', color: '#ea580c', minWidth: 100 }}>신규달성</th>
          <th style={{ padding: '8px 6px', textAlign: 'center', color: '#0891b2', minWidth: 100 }}>연계달성</th>
          <th style={{ padding: '8px 6px', textAlign: 'right' }}>연계형</th>
          <th style={{ padding: '8px 6px', textAlign: 'right', color: '#6b7280' }}>기본형</th>
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, backgroundColor: '#e5e7eb' }}>합계</th>
        </tr></thead>
        <tbody>
          {ab.map(b => (
            <tr key={b.branch} style={{ borderBottom: '1px solid #f3f4f6' }}>
              <td style={{ padding: '6px 10px', fontWeight: 600 }}>{b.branchLabel}</td>
              <td style={{ padding: '6px', textAlign: 'right' }}>{b.newCount} <Delta value={b.deltaNew} /></td>
              <td style={{ padding: '6px', textAlign: 'right' }}>{b.openedCount} <Delta value={b.deltaOpened} /></td>
              <td style={{ padding: '6px', textAlign: 'right' }}>{b.linkedCount} <Delta value={b.deltaLinked} /></td>
              <td style={{ padding: '6px', textAlign: 'right', color: '#dc2626' }}>{b.cancelledCount}</td>
              <td style={{ padding: '6px', textAlign: 'center' }}>
                <span style={{ fontWeight: 700, padding: '2px 6px', borderRadius: 9999, fontSize: 10, backgroundColor: b.linkageRate >= 80 ? '#f0fdf4' : b.linkageRate >= 50 ? '#fefce8' : '#fef2f2', color: b.linkageRate >= 80 ? '#166534' : b.linkageRate >= 50 ? '#854d0e' : '#991b1b' }}>{b.linkageRate}%</span>
              </td>
              <td style={{ padding: '6px' }}><AchieveBar rate={b.achieveRateNew} /></td>
              <td style={{ padding: '6px' }}><AchieveBar rate={b.achieveRateLinkage} /></td>
              <td style={{ padding: '6px', textAlign: 'right', color: '#0891b2' }}>{b.linkTypeCount.toLocaleString()}</td>
              <td style={{ padding: '6px', textAlign: 'right', color: '#6b7280' }}>{b.basicTypeCount.toLocaleString()}</td>
              <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, backgroundColor: '#f9fafb' }}>{b.totalAll.toLocaleString()}</td>
            </tr>
          ))}
          <tr style={{ backgroundColor: '#e5e7eb', fontWeight: 700, borderTop: '2px solid #9ca3af' }}>
            <td style={{ padding: '8px 10px' }}>사업2섹터 합계</td>
            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#2563eb' }}>{d.totalMatrix.newCount}</td>
            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#059669' }}>{d.totalMatrix.openedCount}</td>
            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#0891b2' }}>{d.totalMatrix.linkedCount}</td>
            <td style={{ padding: '8px 6px', textAlign: 'right', color: '#dc2626' }}>{d.totalMatrix.cancelledCount}</td>
            <td style={{ padding: '8px 6px', textAlign: 'center' }}>{d.totalMatrix.linkageRate}%</td>
            <td style={{ padding: '8px 6px' }}><AchieveBar rate={d.totalMatrix.achieveRateNew} /></td>
            <td style={{ padding: '8px 6px' }}><AchieveBar rate={d.totalMatrix.achieveRateLinkage} /></td>
            <td style={{ padding: '8px 6px', textAlign: 'right' }}>{ab.reduce((s, b) => s + b.linkTypeCount, 0).toLocaleString()}</td>
            <td style={{ padding: '8px 6px', textAlign: 'right' }}>{ab.reduce((s, b) => s + b.basicTypeCount, 0).toLocaleString()}</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', backgroundColor: '#d1d5db' }}>{d.totalMatrix.totalAll.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// 차트
export function ChartsSection({ d }: SectionProps) {
  const ab = d.branchMatrix.filter(b => b.totalAll > 0)
  return (
    <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>{d.year}년 월별 누적 신규 vs 목표</p>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={d.monthlyKpiTrack}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="month" tick={{ fontSize: 9 }} /><YAxis tick={{ fontSize: 9 }} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="targetNew" fill="#E5E7EB" name="목표" />
            <Line type="monotone" dataKey="cumulativeNew" stroke="#2563eb" name="누적신규" strokeWidth={2} dot={{ r: 2 }} />
            <Line type="monotone" dataKey="cumulativeLink" stroke="#0891b2" name="누적연계" strokeWidth={2} dot={{ r: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div>
        <p style={{ fontSize: 11, fontWeight: 600, color: '#374151', marginBottom: 8 }}>브랜치별 신규 실적 vs 목표</p>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ab.map(b => ({ name: b.branchLabel, 실적: b.newCount, 목표: b.targetNew }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 8 }} /><YAxis tick={{ fontSize: 9 }} />
            <Tooltip /><Legend wrapperStyle={{ fontSize: 9 }} />
            <Bar dataKey="목표" fill="#E5E7EB" /><Bar dataKey="실적" fill="#2563eb" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// 커스텀 KPI
export function CustomKpiSection({ d, viewMode, customKpis }: SectionProps) {
  if (!customKpis || customKpis.length === 0) return (
    <div style={{ padding: 20, textAlign: 'center', color: '#9ca3af', fontSize: 12 }}>
      커스텀 KPI가 설정되지 않았습니다. [시스템관리 → 목표관리]에서 설정해주세요.
    </div>
  )

  if (viewMode === 'card') {
    return (
      <div style={{ padding: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {customKpis.map((k, i) => {
          const rate = k.target_value > 0 ? Math.round((k.actual_value / k.target_value) * 1000) / 10 : 0
          return (
            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <p style={{ fontSize: 10, color: '#6b7280' }}>{k.kpi_name}</p>
                <TrafficLight rate={rate} />
              </div>
              <p style={{ fontSize: 18, fontWeight: 700, margin: '4px 0' }}>{k.actual_value.toLocaleString()}{k.unit}</p>
              <p style={{ fontSize: 9, color: '#9ca3af' }}>목표: {k.target_value.toLocaleString()}{k.unit} ({k.branch})</p>
              <AchieveBar rate={rate} />
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
      <thead><tr style={{ backgroundColor: '#f3f4f6' }}>
        <th style={{ padding: '8px 12px', textAlign: 'left' }}>KPI 항목</th>
        <th style={{ padding: '8px', textAlign: 'left' }}>브랜치</th>
        <th style={{ padding: '8px', textAlign: 'right' }}>실적</th>
        <th style={{ padding: '8px', textAlign: 'right' }}>목표</th>
        <th style={{ padding: '8px', textAlign: 'center', minWidth: 100 }}>달성율</th>
      </tr></thead>
      <tbody>{customKpis.map((k, i) => {
        const rate = k.target_value > 0 ? Math.round((k.actual_value / k.target_value) * 1000) / 10 : 0
        return (
          <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '6px 12px', fontWeight: 600 }}>{k.kpi_name}</td>
            <td style={{ padding: '6px 8px', color: '#6b7280' }}>{k.branch}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700 }}>{k.actual_value.toLocaleString()}{k.unit}</td>
            <td style={{ padding: '6px 8px', textAlign: 'right' }}>{k.target_value.toLocaleString()}{k.unit}</td>
            <td style={{ padding: '6px 8px' }}><AchieveBar rate={rate} /></td>
          </tr>
        )
      })}</tbody>
    </table>
  )
}

// 컨설턴트 순위
export function ConsultantsSection({ d }: SectionProps) {
  if (d.consultantRanks.length === 0) return null
  return (
    <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
      <thead><tr style={{ backgroundColor: '#fffbeb' }}>
        <th style={{ padding: '8px', textAlign: 'center', width: 40 }}>#</th>
        <th style={{ padding: '8px', textAlign: 'left' }}>컨설턴트</th>
        <th style={{ padding: '8px', textAlign: 'left' }}>브랜치</th>
        <th style={{ padding: '8px', textAlign: 'right', color: '#2563eb' }}>신규</th>
        <th style={{ padding: '8px', textAlign: 'right', color: '#059669' }}>개설</th>
        <th style={{ padding: '8px', textAlign: 'right', color: '#0891b2' }}>연계</th>
        <th style={{ padding: '8px', textAlign: 'right' }}>매출합(백만)</th>
      </tr></thead>
      <tbody>{d.consultantRanks.map(c => (
        <tr key={c.name} style={{ borderBottom: '1px solid #f3f4f6', backgroundColor: c.rank <= 3 ? '#fffbeb' : undefined }}>
          <td style={{ padding: '6px 8px', textAlign: 'center', fontWeight: 700 }}>{c.rank <= 3 ? ['🥇', '🥈', '🥉'][c.rank - 1] : c.rank}</td>
          <td style={{ padding: '6px 8px', fontWeight: c.rank <= 3 ? 700 : 400 }}>{c.name}</td>
          <td style={{ padding: '6px 8px', color: '#6b7280' }}>{c.branch}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#2563eb' }}>{c.newCount}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#059669' }}>{c.openedCount}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right', color: '#0891b2' }}>{c.linkedCount}</td>
          <td style={{ padding: '6px 8px', textAlign: 'right' }}>{c.revenue > 0 ? c.revenue.toLocaleString() : '-'}</td>
        </tr>
      ))}</tbody>
    </table>
  )
}

// 제조사별
export function ManufacturersSection({ d }: SectionProps) {
  const ab = d.branchMatrix.filter(b => b.totalAll > 0)
  if (d.manufacturerStats.length === 0) return null
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
        <thead><tr style={{ backgroundColor: '#f5f3ff' }}>
          <th style={{ padding: '8px 10px', textAlign: 'left', color: '#5b21b6' }}>제조사</th>
          {ab.map(b => <th key={b.branch} style={{ padding: '8px 6px', textAlign: 'right', color: '#6b7280' }}>{b.branchLabel}</th>)}
          <th style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>합계</th>
        </tr></thead>
        <tbody>{d.manufacturerStats.slice(0, 12).map(row => (
          <tr key={row.manufacturer} style={{ borderBottom: '1px solid #f3f4f6' }}>
            <td style={{ padding: '5px 10px', fontWeight: 500 }}>{row.manufacturer}</td>
            {ab.map(b => <td key={b.branch} style={{ padding: '5px 6px', textAlign: 'right' }}>{(row[b.branchLabel] as number) || 0}</td>)}
            <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700 }}>{(row['합계'] as number) || 0}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  )
}

// 신규/해지 고객
export function CustomersSection({ d }: SectionProps) {
  return (
    <div style={{ padding: 14, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {d.topNewCustomers.length > 0 && (
        <div style={{ border: '1px solid #dbeafe', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', backgroundColor: '#eff6ff' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#1e40af' }}>신규 ({d.topNewCustomers.length}건)</p>
          </div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <tbody>{d.topNewCustomers.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{c.company_name}</td>
                  <td style={{ padding: '4px 6px', color: '#6b7280' }}>{c.branch}</td>
                  <td style={{ padding: '4px 6px', color: '#9ca3af' }}>{c.contract_date}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      {d.topCancelledCustomers.length > 0 && (
        <div style={{ border: '1px solid #fecaca', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2' }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: '#991b1b' }}>해지 ({d.topCancelledCustomers.length}건)</p>
          </div>
          <div style={{ maxHeight: 180, overflow: 'auto' }}>
            <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <tbody>{d.topCancelledCustomers.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{c.company_name}</td>
                  <td style={{ padding: '4px 6px', color: '#6b7280' }}>{c.branch}</td>
                  <td style={{ padding: '4px 6px', color: '#9ca3af' }}>{c.cancel_date}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
