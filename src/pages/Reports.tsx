import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { FileBarChart, TrendingUp, Users, Calendar, Download, Sparkles, RefreshCw, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import * as XLSX from 'xlsx'

type ReportTab = 'periodic' | 'manager' | 'unopened' | 'marketing'
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'

const PIE_COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6']
const BAR_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#ef4444']

export default function Reports() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<ReportTab>('periodic')
  const [period, setPeriod] = useState<Period>('weekly')
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  useEffect(() => { loadData() }, [])
  useEffect(() => { setAiSummary('') }, [tab, period])

  const loadData = async () => {
    const { data } = await supabase.from('customers').select('*').range(0, 9999)
    setCustomers(data || [])
    setLoading(false)
  }

  const now = new Date()
  const today = now.toISOString().split('T')[0]
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1)
  const weekStartStr = weekStart.toISOString().split('T')[0]

  // 공통 통계
  const thisWeekNew = customers.filter((c) => c.reception_date >= weekStartStr && c.reception_date <= today).length
  const thisMonthNew = customers.filter((c) => c.reception_date?.startsWith(thisMonthKey)).length
  const lastMonthNew = customers.filter((c) => c.reception_date?.startsWith(lastMonthKey)).length
  const thisYearNew = customers.filter((c) => c.reception_date?.startsWith(String(now.getFullYear()))).length

  const statusCounts = {
    opened: customers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length,
    waiting: customers.filter((c) => c.opening_status === '개설대기').length,
    progress: customers.filter((c) => c.opening_status === '개설진행').length,
    canceled: customers.filter((c) => c.opening_status === '개설취소').length,
  }

  // 기간별 데이터
  const getPeriodData = () => {
    if (period === 'daily') {
      return Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i)
        return { label: `${d.getMonth() + 1}/${d.getDate()}`, count: customers.filter((c) => c.reception_date === d.toISOString().split('T')[0]).length }
      })
    } else if (period === 'weekly') {
      return Array.from({ length: 8 }, (_, i) => {
        const ws = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (7 - i) * 7 - now.getDay() + 1)
        const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6)
        return { label: `${ws.getMonth() + 1}/${ws.getDate()}~${we.getMonth() + 1}/${we.getDate()}`, count: customers.filter((c) => c.reception_date >= ws.toISOString().split('T')[0] && c.reception_date <= we.toISOString().split('T')[0]).length }
      })
    } else if (period === 'monthly') {
      return Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        return { label: `${d.getMonth() + 1}월`, count: customers.filter((c) => c.reception_date?.startsWith(key)).length }
      })
    } else {
      return Array.from({ length: 5 }, (_, i) => {
        const y = now.getFullYear() - 4 + i
        return { label: `${y}년`, count: customers.filter((c) => c.reception_date?.startsWith(String(y))).length }
      })
    }
  }

  // 담당자별 통계
  const managerMap: Record<string, { total: number; opened: number; waiting: number; progress: number; canceled: number; thisMonth: number }> = {}
  customers.forEach((c) => {
    if (!c.manager) return
    if (!managerMap[c.manager]) managerMap[c.manager] = { total: 0, opened: 0, waiting: 0, progress: 0, canceled: 0, thisMonth: 0 }
    managerMap[c.manager].total++
    if (c.opening_status === '개설완료' || c.opening_status === '이행완료') managerMap[c.manager].opened++
    if (c.opening_status === '개설대기') managerMap[c.manager].waiting++
    if (c.opening_status === '개설진행') managerMap[c.manager].progress++
    if (c.opening_status === '개설취소') managerMap[c.manager].canceled++
    if (c.reception_date?.startsWith(thisMonthKey)) managerMap[c.manager].thisMonth++
  })
  const managerData = Object.entries(managerMap).sort((a, b) => b[1].total - a[1].total)

  // 미개설 고객 분석
  const unopened = customers.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료' && c.opening_status !== '개설취소')
  const getUnopenedDays = (c: any) => {
    if (!c.reception_date) return 0
    return Math.floor((now.getTime() - new Date(c.reception_date).getTime()) / (1000 * 60 * 60 * 24))
  }
  const unopened30 = unopened.filter((c) => getUnopenedDays(c) <= 30)
  const unopened30to90 = unopened.filter((c) => { const d = getUnopenedDays(c); return d > 30 && d <= 90 })
  const unopened90plus = unopened.filter((c) => getUnopenedDays(c) > 90)

  // ERP/연계 분포
  const erpMap: Record<string, number> = {}
  customers.forEach((c) => { if (c.erp_company) erpMap[c.erp_company] = (erpMap[c.erp_company] || 0) + 1 })
  const erpData = Object.entries(erpMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

  const connMap: Record<string, number> = {}
  customers.forEach((c) => { if (c.connection_status) connMap[c.connection_status] = (connMap[c.connection_status] || 0) + 1 })
  const connData = Object.entries(connMap).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }))

  // AI 요약 생성
  const generateAiSummary = async () => {
    setAiLoading(true)
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      let context = ''
      if (tab === 'periodic') {
        context = `기간별 보고서 (${period === 'daily' ? '일간' : period === 'weekly' ? '주간' : period === 'monthly' ? '월간' : '연간'})\n이번 주 신규: ${thisWeekNew}건, 이번 달: ${thisMonthNew}건 (전월 ${lastMonthNew}건), 올해: ${thisYearNew}건\n전체: ${customers.length}건, 개설완료: ${statusCounts.opened}건, 대기: ${statusCounts.waiting}건, 진행: ${statusCounts.progress}건, 취소: ${statusCounts.canceled}건`
      } else if (tab === 'manager') {
        context = `담당자별 실적 보고서\n` + managerData.slice(0, 5).map(([name, s]) => `${name}: 총 ${s.total}건 (완료 ${s.opened}, 대기 ${s.waiting}, 진행 ${s.progress}, 이번달 신규 ${s.thisMonth})`).join('\n')
      } else if (tab === 'unopened') {
        context = `미개설 고객 관리 보고서\n전체 미개설: ${unopened.length}건\n30일 이내: ${unopened30.length}건, 30~90일: ${unopened30to90.length}건, 90일+: ${unopened90plus.length}건\n평균 미개설 기간: ${Math.round(unopened.reduce((sum, c) => sum + getUnopenedDays(c), 0) / (unopened.length || 1))}일`
      } else {
        const convRate = customers.length > 0 ? Math.round((statusCounts.opened / customers.length) * 100) : 0
        context = `마케팅 보고서\n전체: ${customers.length}건, 개설 전환율: ${convRate}%\nERP별: ${erpData.slice(0, 5).map((e) => `${e.name} ${e.count}건`).join(', ')}\n연계상태: ${connData.map((c) => `${c.name} ${c.count}건`).join(', ')}`
      }

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`, 'apikey': supabaseAnonKey },
        body: JSON.stringify({ todaySchedules: [], recentCustomers: [], managerName: profile?.name || '', date: today, reportContext: context }),
      })
      const text = await res.text()
      if (res.ok) { const data = JSON.parse(text); setAiSummary(data?.summary || '') }
      else { setAiSummary('AI 요약을 생성할 수 없습니다.') }
    } catch { setAiSummary('AI 요약을 생성할 수 없습니다.') }
    setAiLoading(false)
  }

  // Excel 다운로드
  const downloadExcel = () => {
    let sheetData: any[][] = []
    const reportName = tab === 'periodic' ? '업무보고서' : tab === 'manager' ? '담당자실적' : tab === 'unopened' ? '미개설관리' : '마케팅보고서'

    if (tab === 'periodic') {
      sheetData = [['구분', '건수'], ['전체 고객', customers.length], ['개설완료', statusCounts.opened], ['개설대기', statusCounts.waiting], ['개설진행', statusCounts.progress], ['개설취소', statusCounts.canceled], ['이번 주 신규', thisWeekNew], ['이번 달 신규', thisMonthNew], ['전월 신규', lastMonthNew], ['올해 누적', thisYearNew], [], ['기간별 추이'], ...getPeriodData().map((d) => [d.label, d.count])]
    } else if (tab === 'manager') {
      sheetData = [['담당자', '전체', '개설완료', '개설대기', '개설진행', '개설취소', '이번달 신규'], ...managerData.map(([name, s]) => [name, s.total, s.opened, s.waiting, s.progress, s.canceled, s.thisMonth])]
    } else if (tab === 'unopened') {
      sheetData = [['고객명', '고객번호', '사업자번호', '담당자', '접수일', '개설상태', '미개설일수'], ...unopened.sort((a, b) => getUnopenedDays(b) - getUnopenedDays(a)).map((c) => [c.customer_name, c.customer_number, c.business_number, c.manager, c.reception_date, c.opening_status, getUnopenedDays(c)])]
    } else {
      sheetData = [['ERP회사', '고객수'], ...erpData.map((e) => [e.name, e.count]), [], ['연계상태', '건수'], ...connData.map((c) => [c.name, c.count])]
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetData)
    ws['!cols'] = Array(10).fill({ wch: 15 })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, reportName)
    XLSX.writeFile(wb, `${reportName}_${today}.xlsx`)
  }

  const periodData = getPeriodData()

  if (loading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">보고서</h2>
          <p className="text-sm text-gray-400 mt-0.5">기준일: {today}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generateAiSummary} disabled={aiLoading}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-50 border border-purple-200 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm">
            {aiLoading ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />} AI 요약
          </button>
          <button onClick={downloadExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm">
            <Download size={14} /> Excel 다운로드
          </button>
        </div>
      </div>

      {/* AI 요약 */}
      {aiSummary && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-1"><Sparkles size={14} className="text-purple-600" /><span className="text-xs font-medium text-purple-700">AI 분석 요약</span></div>
          <p className="text-sm text-gray-700">{aiSummary}</p>
        </div>
      )}

      {/* 보고서 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-5 overflow-x-auto">
        {([['periodic', '업무 보고서', FileBarChart], ['manager', '담당자 실적', Users], ['unopened', '미개설 관리', AlertTriangle], ['marketing', '마케팅', TrendingUp]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              tab === key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── 업무 보고서 ── */}
      {tab === 'periodic' && (
        <div className="space-y-5">
          {/* 핵심 지표 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: '이번 주 신규', value: thisWeekNew, color: 'bg-blue-50 text-blue-600', icon: TrendingUp },
              { label: '이번 달 신규', value: thisMonthNew, sub: lastMonthNew > 0 ? `전월 대비 ${thisMonthNew >= lastMonthNew ? '+' : ''}${thisMonthNew - lastMonthNew}건` : '', color: 'bg-emerald-50 text-emerald-600', icon: Calendar },
              { label: '올해 누적', value: thisYearNew, color: 'bg-purple-50 text-purple-600', icon: FileBarChart },
              { label: '전체 고객', value: customers.length, color: 'bg-amber-50 text-amber-600', icon: Users },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="flex items-center gap-3">
                  <div className={`${card.color} p-2.5 rounded-lg`}><card.icon size={18} /></div>
                  <div>
                    <p className="text-xs text-gray-500">{card.label}</p>
                    <p className="text-xl font-bold text-gray-800">{card.value.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span></p>
                    {card.sub && <p className={`text-xs ${card.sub.includes('+') ? 'text-emerald-500' : 'text-red-500'}`}>{card.sub}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 차트 + 기간 선택 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">신규 접수 추이</h3>
              <div className="flex bg-gray-100 rounded-lg p-0.5">
                {([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간'], ['yearly', '연간']] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${period === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>
                ))}
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={periodData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" />
                <Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} />
                <Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 개설 상태 + 연계 상태 */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">개설 상태 분포</h3>
              <div className="flex items-center">
                <ResponsiveContainer width="50%" height={160}>
                  <PieChart><Pie data={[{ name: '완료', value: statusCounts.opened }, { name: '대기', value: statusCounts.waiting }, { name: '진행', value: statusCounts.progress }, { name: '취소', value: statusCounts.canceled }]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>{PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /></PieChart>
                </ResponsiveContainer>
                <div className="w-1/2 space-y-1.5">
                  {[['개설완료', statusCounts.opened, PIE_COLORS[0]], ['개설대기', statusCounts.waiting, PIE_COLORS[1]], ['개설진행', statusCounts.progress, PIE_COLORS[2]], ['개설취소', statusCounts.canceled, PIE_COLORS[3]]].map(([n, v, c]) => (
                    <div key={n as string} className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c as string }}></div><span className="text-xs text-gray-600">{n}</span></div>
                      <span className="text-xs font-semibold text-gray-800">{(v as number).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">ERP 회사별 분포</h3>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={erpData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── 담당자 실적 ── */}
      {tab === 'manager' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="font-semibold text-gray-800 text-sm">담당자별 실적 현황</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">담당자</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">전체</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-emerald-600">개설완료</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">개설대기</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600">개설진행</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-red-600">개설취소</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-purple-600">이번달 신규</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-600">전환율</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {managerData.map(([name, s], i) => (
                    <tr key={name} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-emerald-50/30 transition`}>
                      <td className="px-4 py-2.5 font-medium text-gray-800">{name}</td>
                      <td className="text-center px-3 py-2.5 font-bold">{s.total}</td>
                      <td className="text-center px-3 py-2.5 text-emerald-600 font-semibold">{s.opened}</td>
                      <td className="text-center px-3 py-2.5 text-amber-600">{s.waiting}</td>
                      <td className="text-center px-3 py-2.5 text-blue-600">{s.progress}</td>
                      <td className="text-center px-3 py-2.5 text-red-600">{s.canceled}</td>
                      <td className="text-center px-3 py-2.5 text-purple-600 font-semibold">{s.thisMonth}</td>
                      <td className="text-center px-3 py-2.5">{s.total > 0 ? Math.round((s.opened / s.total) * 100) : 0}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">담당자별 고객 수 비교</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, managerData.length * 35)}>
              <BarChart data={managerData.slice(0, 15).map(([name, s]) => ({ name, total: s.total, opened: s.opened }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" width={70} /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="total" fill="#94a3b8" radius={[0, 4, 4, 0]} name="전체" /><Bar dataKey="opened" fill="#059669" radius={[0, 4, 4, 0]} name="개설완료" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── 미개설 관리 ── */}
      {tab === 'unopened' && (
        <div className="space-y-5">
          {/* 핵심 지표 */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: '전체 미개설', value: unopened.length, color: 'bg-amber-50 text-amber-600' },
              { label: '30일 이내', value: unopened30.length, color: 'bg-emerald-50 text-emerald-600' },
              { label: '30~90일', value: unopened30to90.length, color: 'bg-blue-50 text-blue-600' },
              { label: '90일+ (장기)', value: unopened90plus.length, color: 'bg-red-50 text-red-600' },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className="text-2xl font-bold text-gray-800">{c.value.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span></p>
              </div>
            ))}
          </div>

          {/* 기간별 분포 차트 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">미개설 기간별 분포</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={[{ name: '30일 이내', count: unopened30.length }, { name: '30~90일', count: unopened30to90.length }, { name: '90일+', count: unopened90plus.length }]}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{BAR_COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 장기 미개설 목록 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-red-50">
              <h3 className="font-semibold text-red-700 text-sm">장기 미개설 고객 (90일+) - {unopened90plus.length}건</h3>
            </div>
            <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-600">고객명</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">고객번호</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">담당자</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">접수일</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-600">상태</th>
                    <th className="text-right px-4 py-2 text-xs font-semibold text-red-600">미개설일수</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {unopened90plus.sort((a, b) => getUnopenedDays(b) - getUnopenedDays(a)).slice(0, 50).map((c, i) => (
                    <tr key={c.id} className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'} hover:bg-red-50/30`}>
                      <td className="px-4 py-2 font-medium text-gray-800">{c.customer_name}</td>
                      <td className="px-3 py-2 text-gray-600">{c.customer_number || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{c.manager || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{c.reception_date || '-'}</td>
                      <td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">{c.opening_status}</span></td>
                      <td className="px-4 py-2 text-right font-bold text-red-600">{getUnopenedDays(c)}일</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 마케팅 ── */}
      {tab === 'marketing' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">개설 전환율</p>
              <p className="text-3xl font-bold text-emerald-600">{customers.length > 0 ? Math.round((statusCounts.opened / customers.length) * 100) : 0}%</p>
              <p className="text-xs text-gray-400 mt-0.5">개설완료 / 전체</p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">평균 개설 소요기간</p>
              <p className="text-3xl font-bold text-blue-600">{(() => {
                const withDates = customers.filter((c) => c.reception_date && c.opening_date && (c.opening_status === '개설완료' || c.opening_status === '이행완료'))
                if (withDates.length === 0) return '-'
                const avg = withDates.reduce((sum, c) => sum + Math.floor((new Date(c.opening_date).getTime() - new Date(c.reception_date).getTime()) / (1000 * 60 * 60 * 24)), 0) / withDates.length
                return Math.round(avg)
              })()}<span className="text-sm font-normal text-gray-400 ml-0.5">일</span></p>
            </div>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <p className="text-xs text-gray-500 mb-1">이번 달 전환 건수</p>
              <p className="text-3xl font-bold text-purple-600">{customers.filter((c) => c.opening_date?.startsWith(thisMonthKey) && (c.opening_status === '개설완료' || c.opening_status === '이행완료')).length}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span></p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">ERP 회사별 분포</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={erpData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-800 mb-3">연계 상태 분포</h3>
              <div className="space-y-2.5">
                {connData.map((item) => {
                  const pct = customers.length > 0 ? (item.count / customers.length) * 100 : 0
                  return (
                    <div key={item.name}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600">{item.name}</span>
                        <span className="text-xs font-semibold text-gray-800">{item.count.toLocaleString()}건 ({pct.toFixed(1)}%)</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* 월별 누적 추이 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-3">월별 신규 접수 추이 (최근 12개월)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={Array.from({ length: 12 }, (_, i) => {
                const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                return { label: `${d.getMonth() + 1}월`, count: customers.filter((c) => c.reception_date?.startsWith(key)).length }
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
