import { useState } from 'react'
import Header from '@/components/layout/Header'
import { useStatistics } from '@/hooks/useStatistics'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
  LineChart, Line,
} from 'recharts'

import { ALL_BRANCHES } from '@/types'
const BRANCHES = ALL_BRANCHES
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#06b6d4']
const TABS = ['ERP 연계 현황', 'ERP 종류별 통계', '제조사 기준 현황', '연도별 추이 분석'] as const

export default function StatisticsPage() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [activeTab, setActiveTab] = useState<typeof TABS[number]>(TABS[0])

  const { erpLinkage, erpTypeStats, manufacturerStats, yearlyTrends, isLoading } = useStatistics(year)

  // 제조사별 도넛 데이터
  const mfrPieData = manufacturerStats
    .filter((m) => (m['합계'] as number) > 0)
    .map((m) => ({ name: m.manufacturer, value: m['합계'] as number }))

  return (
    <div>
      <Header title="통계 분석" />
      <div className="p-6">
        {/* 연도 필터 + 탭 */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            {Array.from({ length: currentYear - 2004 }, (_, i) => currentYear - i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm rounded-md transition-colors ${
                  activeTab === tab
                    ? 'bg-white text-gray-800 shadow-sm font-medium'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ERP 연계 현황 */}
            {activeTab === 'ERP 연계 현황' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-5 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">{year}년 브랜치별 ERP 연계 현황</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜치</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">인입건수</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">ERP 연계건</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">연계율(%)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {erpLinkage.map((row) => (
                          <tr key={row.branch} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-900">{row.branch}</td>
                            <td className="px-5 py-3 text-right text-gray-700">{row.inflowCount.toLocaleString()}</td>
                            <td className="px-5 py-3 text-right text-blue-600 font-medium">{row.linkedCount.toLocaleString()}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`font-semibold ${row.linkageRate >= 80 ? 'text-green-600' : row.linkageRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {row.linkageRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-5 py-3">합계</td>
                          <td className="px-5 py-3 text-right">{erpLinkage.reduce((s, r) => s + r.inflowCount, 0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right text-blue-600">{erpLinkage.reduce((s, r) => s + r.linkedCount, 0).toLocaleString()}</td>
                          <td className="px-5 py-3 text-right">
                            {(() => {
                              const total = erpLinkage.reduce((s, r) => s + r.inflowCount, 0)
                              const linked = erpLinkage.reduce((s, r) => s + r.linkedCount, 0)
                              return total > 0 ? `${(linked / total * 100).toFixed(1)}%` : '0%'
                            })()}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 막대 차트 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">브랜치별 ERP 연계율</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={erpLinkage}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="branch" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="inflowCount" fill="#93c5fd" name="인입건수" />
                      <Bar dataKey="linkedCount" fill="#3b82f6" name="ERP 연계건" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ERP 종류별 통계 */}
            {activeTab === 'ERP 종류별 통계' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="px-5 py-4 border-b border-gray-200">
                  <h3 className="font-semibold text-gray-800">ERP 종류별 × 브랜치별 집계 (완료 고객 기준)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">ERP 종류</th>
                        {BRANCHES.map((b) => (
                          <th key={b} className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">{b}</th>
                        ))}
                        <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">합계</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {erpTypeStats.map((row, i) => (
                        <tr
                          key={row.erpType}
                          className={`hover:bg-gray-50 ${i === erpTypeStats.length - 1 ? 'bg-gray-50 font-semibold' : ''}`}
                        >
                          <td className="px-5 py-3 font-medium text-gray-900">{row.erpType}</td>
                          {BRANCHES.map((b) => (
                            <td key={b} className="px-5 py-3 text-right text-gray-700">{(row[b] as number) || 0}</td>
                          ))}
                          <td className="px-5 py-3 text-right font-semibold text-gray-900">{(row['합계'] as number) || 0}</td>
                        </tr>
                      ))}
                      {erpTypeStats.length === 0 && (
                        <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 제조사 기준 현황 */}
            {activeTab === '제조사 기준 현황' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-5 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">ERP 제조사별 브랜치 보유 현황</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">제조사</th>
                          {BRANCHES.map((b) => (
                            <th key={b} className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">{b}</th>
                          ))}
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">합계</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {manufacturerStats.map((row) => (
                          <tr key={row.manufacturer} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-900">{row.manufacturer}</td>
                            {BRANCHES.map((b) => (
                              <td key={b} className="px-5 py-3 text-right text-gray-700">{(row[b] as number) || 0}</td>
                            ))}
                            <td className="px-5 py-3 text-right font-semibold">{(row['합계'] as number) || 0}</td>
                          </tr>
                        ))}
                        {manufacturerStats.length === 0 && (
                          <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 제조사 도넛 차트 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                  <h3 className="font-semibold text-gray-800 mb-4">제조사별 비중</h3>
                  {mfrPieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={350}>
                      <PieChart>
                        <Pie
                          data={mfrPieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={110}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}
                        >
                          {mfrPieData.map((_, index) => (
                            <Cell key={index} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[350px] text-gray-400 text-sm">데이터가 없습니다</div>
                  )}
                </div>
              </div>
            )}

            {/* 연도별 추이 분석 */}
            {activeTab === '연도별 추이 분석' && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                  <div className="px-5 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-800">연도별 신규/해지/누적/순증 추이</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-5 py-3 text-left text-xs font-medium text-gray-500 uppercase">연도</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">전체 신규</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">전체 해지</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">순증</th>
                          <th className="px-5 py-3 text-right text-xs font-medium text-gray-500 uppercase">누적</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {yearlyTrends.map((row) => (
                          <tr key={row.year} className="hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-900">{row.year}</td>
                            <td className="px-5 py-3 text-right text-blue-600 font-medium">{(row['전체_신규'] as number).toLocaleString()}</td>
                            <td className="px-5 py-3 text-right text-red-600 font-medium">{(row['전체_해지'] as number).toLocaleString()}</td>
                            <td className="px-5 py-3 text-right">
                              <span className={`font-semibold ${(row['전체_순증'] as number) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(row['전체_순증'] as number) > 0 ? '+' : ''}{(row['전체_순증'] as number).toLocaleString()}
                              </span>
                            </td>
                            <td className="px-5 py-3 text-right font-semibold text-gray-900">{(row['전체_누적'] as number).toLocaleString()}</td>
                          </tr>
                        ))}
                        {yearlyTrends.length === 0 && (
                          <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">데이터가 없습니다</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 연도별 라인 차트 */}
                {yearlyTrends.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                    <h3 className="font-semibold text-gray-800 mb-4">연도별 신규/해지 추이</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={yearlyTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="year" tick={{ fontSize: 12 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="전체_신규" stroke="#3b82f6" name="신규" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="전체_해지" stroke="#ef4444" name="해지" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="전체_누적" stroke="#10b981" name="누적" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
