import { useState } from 'react'
import Header from '@/components/layout/Header'
import { useDashboard } from '@/hooks/useDashboard'
import type { BranchType } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'
import {
  CheckCircle, TrendingUp, TrendingDown, Clock, Link2, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus,
} from 'lucide-react'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'

const BRANCHES_FILTER: (BranchType | '전체')[] = ['전체', ...ALL_BRANCHES]
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4']

// 증감 표시 컴포넌트
function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous
  if (diff === 0) return <span className="text-xs text-gray-400 flex items-center gap-0.5"><Minus size={12} />전월동일</span>
  if (diff > 0) return <span className="text-xs text-green-600 flex items-center gap-0.5"><ArrowUpRight size={12} />▲{diff} 전월比</span>
  return <span className="text-xs text-red-500 flex items-center gap-0.5"><ArrowDownRight size={12} />▼{Math.abs(diff)} 전월比</span>
}

// 달성율 바
function ProgressBar({ actual, target }: { actual: number; target: number }) {
  if (target === 0) return <span className="text-xs text-gray-400">목표 미설정</span>
  const rate = Math.round((actual / target) * 100)
  const width = Math.min(rate, 100)
  const color = rate >= 100 ? 'bg-green-500' : rate >= 70 ? 'bg-blue-500' : rate >= 40 ? 'bg-yellow-500' : 'bg-red-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-200 rounded-full h-2 min-w-[60px]">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${width}%` }} />
      </div>
      <span className={`text-xs font-bold ${rate >= 100 ? 'text-green-600' : rate >= 70 ? 'text-blue-600' : 'text-red-600'}`}>{rate}%</span>
    </div>
  )
}

// 연계율 뱃지
function LinkRateBadge({ linked, total }: { linked: number; total: number }) {
  if (total === 0) return <span className="text-xs text-gray-400">-</span>
  const rate = Math.round((linked / total) * 1000) / 10
  const color = rate >= 80 ? 'text-green-600 bg-green-50' : rate >= 50 ? 'text-yellow-700 bg-yellow-50' : 'text-red-600 bg-red-50'
  return <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${color}`}>{rate}%</span>
}

export default function DashboardPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [branch, setBranch] = useState<BranchType | '전체'>('전체')

  const { kpi, branchSummaries, monthlyTrends, lastUpdated, isLoading } = useDashboard(year, branch)

  const pieData = branchSummaries.filter((b) => b.total > 0).map((b) => ({ name: BRANCH_LABELS[b.branch], value: b.total }))
  const activeSummaries = branchSummaries.filter((b) => b.total > 0)

  // 전체 연계율
  const totalLinked = branchSummaries.reduce((s, b) => s + b.yearlyLinked, 0)
  const totalCompleted = branchSummaries.reduce((s, b) => s + b.statusCompleted, 0)
  const overallLinkRate = totalCompleted > 0 ? Math.round((totalLinked / totalCompleted) * 1000) / 10 : 0

  return (
    <div>
      <Header title="대시보드" />
      <div className="p-6">
        {/* 필터 */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {Array.from({ length: currentYear - 2004 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <select value={branch} onChange={(e) => setBranch(e.target.value as BranchType | '전체')} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {BRANCHES_FILTER.map((b) => <option key={b} value={b}>{b === '전체' ? '전체 브랜치' : BRANCH_LABELS[b]}</option>)}
          </select>
          {lastUpdated && (
            <span className="text-xs text-gray-400 ml-auto">최종 업데이트: {new Date(lastUpdated).toLocaleString('ko-KR')}</span>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* KPI 카드 6개 (전월대비 증감 포함) */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              {[
                { title: '전체 등록', value: kpi.grandTotal, icon: BarChart3, color: 'text-purple-600', bg: 'bg-purple-50' },
                { title: '개설 완료', value: kpi.totalCompleted, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
                { title: 'ERP 연계율', value: `${overallLinkRate}%`, icon: Link2, color: 'text-blue-600', bg: 'bg-blue-50', noDelta: true },
                { title: '금월 신규', value: kpi.currentMonthNew, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50', delta: { current: kpi.currentMonthNew, previous: kpi.prevMonthNew } },
                { title: '금월 해지', value: kpi.currentMonthCancelled, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50', delta: { current: kpi.currentMonthCancelled, previous: kpi.prevMonthCancelled } },
                { title: '대기/진행', value: kpi.pendingInProgress, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
              ].map((card) => (
                <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.bg}`}>
                      <card.icon size={20} className={card.color} />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">{card.title}</p>
                      <p className="text-xl font-bold text-gray-800">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</p>
                    </div>
                  </div>
                  {card.delta && <DeltaBadge current={card.delta.current} previous={card.delta.previous} />}
                </div>
              ))}
            </div>

            {/* 브랜치별 현황 매트릭스 (핵심 테이블) */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-gray-800">브랜치별 현황 매트릭스</h3>
                  <p className="text-xs text-gray-400 mt-0.5">개설완료 + 진행 + 대기 + 해지 = 합계</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-3 py-3 text-left text-xs font-medium text-gray-500">브랜치</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-green-600">개설완료</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-yellow-600">진행</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-500">대기</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-red-500">해지</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-gray-800 bg-gray-100">합계</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-blue-600">{year} 신규</th>
                      <th className="px-3 py-3 text-right text-xs font-medium text-cyan-600">{year} 연계</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-purple-600">연계율</th>
                      <th className="px-3 py-3 text-center text-xs font-medium text-orange-600 min-w-[120px]">신규 달성율</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {activeSummaries.map((b) => (
                      <tr key={b.branch} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-gray-900">{BRANCH_LABELS[b.branch]}</td>
                        <td className="px-3 py-2.5 text-right text-green-700">{b.statusCompleted.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-yellow-700">{b.statusInProgress.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-gray-500">{b.statusPending.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-red-600">{b.statusCancelled.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right font-bold text-gray-900 bg-gray-50">{b.total.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-blue-600 font-medium">{b.yearlyNew.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-cyan-600 font-medium">{b.yearlyLinked.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-center"><LinkRateBadge linked={b.yearlyLinked} total={b.statusCompleted} /></td>
                        <td className="px-3 py-2.5"><ProgressBar actual={b.yearlyNew} target={b.targetNew} /></td>
                      </tr>
                    ))}
                    {/* 합계 행 */}
                    <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                      <td className="px-3 py-2.5 text-gray-900">합계</td>
                      <td className="px-3 py-2.5 text-right text-green-700">{activeSummaries.reduce((s, b) => s + b.statusCompleted, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-yellow-700">{activeSummaries.reduce((s, b) => s + b.statusInProgress, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-gray-500">{activeSummaries.reduce((s, b) => s + b.statusPending, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-red-600">{activeSummaries.reduce((s, b) => s + b.statusCancelled, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right font-bold text-gray-900 bg-gray-100">{activeSummaries.reduce((s, b) => s + b.total, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-blue-600">{activeSummaries.reduce((s, b) => s + b.yearlyNew, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-right text-cyan-600">{activeSummaries.reduce((s, b) => s + b.yearlyLinked, 0).toLocaleString()}</td>
                      <td className="px-3 py-2.5 text-center"><LinkRateBadge linked={totalLinked} total={totalCompleted} /></td>
                      <td className="px-3 py-2.5">
                        <ProgressBar
                          actual={activeSummaries.reduce((s, b) => s + b.yearlyNew, 0)}
                          target={activeSummaries.reduce((s, b) => s + b.targetNew, 0)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 차트 영역 2x2 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 월별 신규/해지/연계 추이 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">{year}년 월별 추이</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={monthlyTrends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="newCount" stroke="#3b82f6" name="신규" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="openCount" stroke="#10b981" name="개설" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="linkCount" stroke="#06b6d4" name="연계" strokeWidth={2} dot={{ r: 3 }} />
                    <Line type="monotone" dataKey="cancelCount" stroke="#ef4444" name="해지" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* 브랜치별 목표 달성 현황 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">{year}년 브랜치별 신규 실적</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={activeSummaries.map((b) => ({
                    name: BRANCH_LABELS[b.branch],
                    실적: b.yearlyNew,
                    목표: b.targetNew,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="목표" fill="#E5E7EB" name="목표" />
                    <Bar dataKey="실적" fill="#3b82f6" name="실적" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* 브랜치 비중 도넛 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">브랜치별 비중</h3>
                {pieData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={100} paddingAngle={3} dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[280px] text-gray-400 text-sm">데이터 없음</div>
                )}
              </div>

              {/* 브랜치별 연계율 비교 */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="font-semibold text-gray-800 mb-4">브랜치별 ERP 연계율</h3>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={activeSummaries.map((b) => ({
                    name: BRANCH_LABELS[b.branch],
                    연계율: b.statusCompleted > 0 ? Math.round((b.yearlyLinked / b.statusCompleted) * 1000) / 10 : 0,
                  }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                    <Tooltip formatter={(v: number) => `${v}%`} />
                    <Bar dataKey="연계율" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
