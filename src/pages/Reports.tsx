import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Download } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import * as XLSX from 'xlsx'

type ReportTab = 'periodic' | 'manager' | 'unopened' | 'marketing'
type Period = 'daily' | 'weekly' | 'monthly' | 'yearly'
const PIE_COLORS = ['#059669', '#f59e0b', '#3b82f6', '#ef4444']

export default function Reports() {
  const { tab: urlTab } = useParams<{ tab: string }>()
  const tab: ReportTab = (['periodic', 'manager', 'unopened', 'marketing'].includes(urlTab || '') ? urlTab : 'periodic') as ReportTab
  const [period, setPeriod] = useState<Period>('weekly')
  const [managerPeriod, setManagerPeriod] = useState<Period>('monthly')
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showPreview, setShowPreview] = useState(false)
  const [previewData, setPreviewData] = useState<any[][]>([])
  const [previewTitle, setPreviewTitle] = useState('')

  useEffect(() => { supabase.from('customers').select('*').range(0, 9999).then(({ data }) => { setCustomers(data || []); setLoading(false) }) }, [])

  const now = new Date(); const today = now.toISOString().split('T')[0]
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const lastMonthKey = (() => { const d = new Date(now.getFullYear(), now.getMonth() - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` })()
  const weekStartStr = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay() + 1).toISOString().split('T')[0]

  const thisWeekNew = customers.filter((c) => c.reception_date >= weekStartStr && c.reception_date <= today).length
  const thisMonthNew = customers.filter((c) => c.reception_date?.startsWith(thisMonthKey)).length
  const lastMonthNew = customers.filter((c) => c.reception_date?.startsWith(lastMonthKey)).length
  const thisYearNew = customers.filter((c) => c.reception_date?.startsWith(String(now.getFullYear()))).length
  const sc = { opened: customers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length, waiting: customers.filter((c) => c.opening_status === '개설대기').length, progress: customers.filter((c) => c.opening_status === '개설진행').length, canceled: customers.filter((c) => c.opening_status === '개설취소').length }

  const getPeriodData = (p: Period) => {
    if (p === 'daily') return Array.from({ length: 14 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13 + i); return { label: `${d.getMonth() + 1}/${d.getDate()}`, count: customers.filter((c) => c.reception_date === d.toISOString().split('T')[0]).length } })
    if (p === 'weekly') return Array.from({ length: 8 }, (_, i) => { const ws = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (7 - i) * 7 - now.getDay() + 1); const we = new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + 6); return { label: `${ws.getMonth() + 1}/${ws.getDate()}~${we.getMonth() + 1}/${we.getDate()}`, count: customers.filter((c) => c.reception_date >= ws.toISOString().split('T')[0] && c.reception_date <= we.toISOString().split('T')[0]).length } })
    if (p === 'monthly') return Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return { label: `${d.getMonth() + 1}월`, count: customers.filter((c) => c.reception_date?.startsWith(k)).length } })
    return Array.from({ length: 5 }, (_, i) => { const y = now.getFullYear() - 4 + i; return { label: `${y}년`, count: customers.filter((c) => c.reception_date?.startsWith(String(y))).length } })
  }

  const mDateFrom = managerPeriod === 'daily' ? today : managerPeriod === 'weekly' ? weekStartStr : managerPeriod === 'monthly' ? `${thisMonthKey}-01` : `${now.getFullYear()}-01-01`
  const mm: Record<string, { total: number; opened: number; waiting: number; progress: number; canceled: number; periodNew: number }> = {}
  customers.forEach((c) => { if (!c.manager) return; if (!mm[c.manager]) mm[c.manager] = { total: 0, opened: 0, waiting: 0, progress: 0, canceled: 0, periodNew: 0 }; mm[c.manager].total++; if (c.opening_status === '개설완료' || c.opening_status === '이행완료') mm[c.manager].opened++; if (c.opening_status === '개설대기') mm[c.manager].waiting++; if (c.opening_status === '개설진행') mm[c.manager].progress++; if (c.opening_status === '개설취소') mm[c.manager].canceled++; if (c.reception_date && c.reception_date >= mDateFrom) mm[c.manager].periodNew++ })
  const managerData = Object.entries(mm).sort((a, b) => b[1].total - a[1].total)

  const unopened = customers.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료' && c.opening_status !== '개설취소')
  const getDays = (c: any) => c.reception_date ? Math.floor((now.getTime() - new Date(c.reception_date).getTime()) / 86400000) : 0
  const u30 = unopened.filter((c) => getDays(c) <= 30), u3090 = unopened.filter((c) => { const d = getDays(c); return d > 30 && d <= 90 }), u90 = unopened.filter((c) => getDays(c) > 90)
  const avgDays = unopened.length > 0 ? Math.round(unopened.reduce((s, c) => s + getDays(c), 0) / unopened.length) : 0
  const uByMgr: Record<string, number> = {}; unopened.forEach((c) => { if (c.manager) uByMgr[c.manager] = (uByMgr[c.manager] || 0) + 1 })
  const uMgrData = Object.entries(uByMgr).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, count]) => ({ name, count }))

  const erpMap: Record<string, number> = {}; customers.forEach((c) => { if (c.erp_company) erpMap[c.erp_company] = (erpMap[c.erp_company] || 0) + 1 })
  const erpData = Object.entries(erpMap).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, count]) => ({ name, count }))

  // 해지 고객 통계
  const terminated = customers.filter((c) => c.management_type === '해지' || c.termination_date)
  const thisMonthTerminated = terminated.filter((c) => c.termination_date?.startsWith(thisMonthKey)).length
  const lastMonthTerminated = terminated.filter((c) => c.termination_date?.startsWith(lastMonthKey)).length
  const thisWeekTerminated = terminated.filter((c) => c.termination_date && c.termination_date >= weekStartStr && c.termination_date <= today).length
  const thisYearTerminated = terminated.filter((c) => c.termination_date?.startsWith(String(now.getFullYear()))).length

  const pct = (n: number, total: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : '0%'

  const genExcel = (): { data: any[][]; title: string } => {
    const rd = `보고서 생성일: ${today}`
    const pl = period === 'daily' ? '일간' : period === 'weekly' ? '주간' : period === 'monthly' ? '월간' : '연간'

    if (tab === 'periodic') {
      return { title: `${pl} 업무 보고서`, data: [
        [`webcash 하나CMS팀 - ${pl} 업무 보고서`, '', '', '', '', ''],
        [rd, '', '', '', '', ''],
        [],
        ['[ 핵심 지표 ]', '', '', '', '', ''],
        ['구분', '신규 인입', '해지', '순증감', '', ''],
        ['이번 주', thisWeekNew, thisWeekTerminated, thisWeekNew - thisWeekTerminated, '', ''],
        ['이번 달', thisMonthNew, thisMonthTerminated, thisMonthNew - thisMonthTerminated, '', ''],
        ['전월', lastMonthNew, lastMonthTerminated, lastMonthNew - lastMonthTerminated, '', ''],
        ['올해 누적', thisYearNew, thisYearTerminated, thisYearNew - thisYearTerminated, '', ''],
        [],
        ['[ 전체 현황 ]', '', '', '', '', ''],
        ['구분', '건수', '비율', '', '', ''],
        ['전체 고객', customers.length, '100%', '', '', ''],
        ['개설완료', sc.opened, pct(sc.opened, customers.length), '', '', ''],
        ['개설대기', sc.waiting, pct(sc.waiting, customers.length), '', '', ''],
        ['개설진행', sc.progress, pct(sc.progress, customers.length), '', '', ''],
        ['개설취소', sc.canceled, pct(sc.canceled, customers.length), '', '', ''],
        ['해지 고객', terminated.length, pct(terminated.length, customers.length), '', '', ''],
        [],
        [`[ ${pl} 신규 접수 추이 ]`, '', '', '', '', ''],
        ['기간', '신규 인입', '', '', '', ''],
        ...getPeriodData(period).map((d) => [d.label, d.count, '', '', '', '']),
      ]}
    }
    if (tab === 'manager') {
      const mpl = managerPeriod === 'daily' ? '금일' : managerPeriod === 'weekly' ? '금주' : managerPeriod === 'monthly' ? '금월' : '올해'
      return { title: '담당자별 실적', data: [
        ['webcash 하나CMS팀 - 담당자별 실적 보고서', '', '', '', '', '', '', ''],
        [rd, '', '', '', '', '', '', ''],
        [],
        ['[ 담당자별 실적 현황 ]', '', '', '', '', '', '', ''],
        ['담당자', '전체', '개설완료', '개설대기', '개설진행', '개설취소', `${mpl} 신규`, '전환율'],
        ...managerData.map(([n, s]) => [n, s.total, s.opened, s.waiting, s.progress, s.canceled, s.periodNew, `${s.total > 0 ? Math.round((s.opened / s.total) * 100) : 0}%`]),
      ]}
    }
    if (tab === 'unopened') {
      return { title: '미개설 관리', data: [
        ['webcash 하나CMS팀 - 미개설 고객 관리 보고서', '', '', '', '', '', ''],
        [rd, '', '', '', '', '', ''],
        [],
        ['[ 미개설 현황 요약 ]', '', '', '', '', '', ''],
        ['구분', '건수', '', '', '', '', ''],
        ['전체 미개설', unopened.length, '', '', '', '', ''],
        ['30일 이내', u30.length, '', '', '', '', ''],
        ['30~90일', u3090.length, '', '', '', '', ''],
        ['90일+', u90.length, '', '', '', '', ''],
        ['평균 미개설 기간', `${avgDays}일`, '', '', '', '', ''],
        [],
        ['[ 미개설 고객 상세 목록 ]', '', '', '', '', '', ''],
        ['고객명', '고객번호', '사업자번호', '담당자', '접수일', '상태', '미개설일수'],
        ...unopened.sort((a, b) => getDays(b) - getDays(a)).map((c) => [c.customer_name, c.customer_number, c.business_number, c.manager, c.reception_date, c.opening_status, getDays(c)]),
      ]}
    }
    return { title: '마케팅 보고서', data: [
      ['webcash 하나CMS팀 - 마케팅 보고서', '', '', '', '', ''],
      [rd, '', '', '', '', ''],
      [],
      ['[ 상품별 현황 ]', '', '', '', '', ''],
      ['상품', '고객수', '비고', '', '', ''],
      ['대시보드', '-', '데이터 연동 예정', '', '', ''],
      ['글로벌대시보드', '-', '데이터 연동 예정', '', '', ''],
      ['이음텍스', '-', '데이터 연동 예정', '', '', ''],
      ['MAU', '-', '데이터 연동 예정', '', '', ''],
      [],
      ['[ ERP 회사별 분포 ]', '', '', '', '', ''],
      ['ERP 회사', '고객수', '', '', '', ''],
      ...erpData.map((e) => [e.name, e.count, '', '', '', '']),
    ]}
  }

  const handleDownload = () => { const { data, title } = genExcel(); setPreviewData(data); setPreviewTitle(title); setShowPreview(true) }

  const confirmDownload = () => {
    const { data, title } = genExcel()
    const ws = XLSX.utils.aoa_to_sheet(data)

    // 컬럼 너비 자동 계산
    const maxCols = Math.max(...data.map((r) => r.length))
    ws['!cols'] = Array.from({ length: maxCols }, (_, ci) => {
      const maxLen = Math.max(...data.map((r) => String(r[ci] ?? '').length))
      return { wch: Math.max(maxLen * 2, 14) }
    })

    // 제목행 병합
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } }]

    // 셀 스타일 적용 (제목, 섹션 헤더, 데이터 헤더)
    data.forEach((row, ri) => {
      row.forEach((_: any, ci: number) => {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
        if (!ws[addr]) return
        const isTitle = ri === 0
        const isSection = row[0] != null && String(row[0]).startsWith('[')
        const isHeader = ri > 0 && !isSection && data[ri - 1]?.length === 0 || (data[ri - 1] && data[ri - 1][0] != null && String(data[ri - 1][0]).startsWith('['))

        if (isTitle) {
          ws[addr].s = { font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center' } }
        } else if (isSection) {
          ws[addr].s = { font: { bold: true, sz: 11 }, fill: { fgColor: { rgb: 'F3F4F6' } } }
        } else if (isHeader) {
          ws[addr].s = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '059669' } }, alignment: { horizontal: 'center' } }
        }
      })
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, title)
    XLSX.writeFile(wb, `${title}_${today}.xlsx`)
    setShowPreview(false)
  }

  if (loading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{tab === 'periodic' ? '업무 보고서' : tab === 'manager' ? '담당자 실적' : tab === 'unopened' ? '미개설 관리' : '마케팅 보고서'}</h2>
          <p className="text-sm text-gray-400 mt-0.5">기준일: {today} · 전체 {customers.length.toLocaleString()}건</p>
        </div>
        <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-100 transition text-sm"><Download size={15} /> Excel 다운로드</button>
      </div>

      {tab === 'periodic' && (<div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { l: '이번 주 신규', v: thisWeekNew, s: '' },
            { l: '이번 달 신규', v: thisMonthNew, s: lastMonthNew > 0 ? `전월 대비 ${thisMonthNew >= lastMonthNew ? '+' : ''}${thisMonthNew - lastMonthNew}건` : '' },
            { l: '해지 고객', v: terminated.length, s: thisMonthTerminated > 0 ? `이번 달 ${thisMonthTerminated}건` : '' },
            { l: '순증감 (금월)', v: thisMonthNew - thisMonthTerminated, s: `인입 ${thisMonthNew} - 해지 ${thisMonthTerminated}` },
          ].map((c) => (
            <div key={c.l} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 mb-1">{c.l}</p><p className="text-2xl font-bold text-gray-800">{c.v.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">건</span></p>{c.s && <p className={`text-xs mt-0.5 ${c.s.includes('+') ? 'text-emerald-500' : 'text-red-500'}`}>{c.s}</p>}</div>
          ))}
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4"><h3 className="font-semibold text-gray-800">신규 접수 추이</h3><div className="flex bg-gray-100 rounded-lg p-0.5">{([['daily', '일간'], ['weekly', '주간'], ['monthly', '월간'], ['yearly', '연간']] as const).map(([k, l]) => (<button key={k} onClick={() => setPeriod(k)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${period === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>))}</div></div>
          <ResponsiveContainer width="100%" height={240}><BarChart data={getPeriodData(period)}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#059669" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">개설 상태</h3><div className="flex items-center"><ResponsiveContainer width="50%" height={160}><PieChart><Pie data={[{ name: '완료', value: sc.opened }, { name: '대기', value: sc.waiting }, { name: '진행', value: sc.progress }, { name: '취소', value: sc.canceled }]} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value" strokeWidth={0}>{PIE_COLORS.map((c, i) => <Cell key={i} fill={c} />)}</Pie><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /></PieChart></ResponsiveContainer><div className="w-1/2 space-y-1.5">{[['개설완료', sc.opened, PIE_COLORS[0]], ['개설대기', sc.waiting, PIE_COLORS[1]], ['개설진행', sc.progress, PIE_COLORS[2]], ['개설취소', sc.canceled, PIE_COLORS[3]]].map(([n, v, c]) => (<div key={n as string} className="flex items-center justify-between"><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c as string }}></div><span className="text-xs text-gray-600">{n}</span></div><span className="text-xs font-semibold">{(v as number).toLocaleString()}</span></div>))}</div></div></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">ERP 회사별</h3><ResponsiveContainer width="100%" height={160}><BarChart data={erpData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#f59e0b" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
      </div>)}

      {tab === 'manager' && (<div className="space-y-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50"><h3 className="font-semibold text-gray-800 text-sm">담당자별 실적</h3><div className="flex bg-gray-200 rounded-lg p-0.5">{([['daily', '금일'], ['weekly', '금주'], ['monthly', '금월'], ['yearly', '올해']] as const).map(([k, l]) => (<button key={k} onClick={() => setManagerPeriod(k)} className={`px-3 py-1 rounded-md text-xs font-medium transition ${managerPeriod === k ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500'}`}>{l}</button>))}</div></div>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 border-b border-gray-200"><tr><th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-600">담당자</th><th className="text-center px-3 py-2.5 text-xs font-semibold">전체</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-emerald-600">완료</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-amber-600">대기</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-blue-600">진행</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-red-600">취소</th><th className="text-center px-3 py-2.5 text-xs font-semibold text-purple-600">{managerPeriod === 'daily' ? '금일' : managerPeriod === 'weekly' ? '금주' : managerPeriod === 'monthly' ? '금월' : '올해'} 신규</th><th className="text-center px-3 py-2.5 text-xs font-semibold">전환율</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{managerData.map(([name, s], i) => (<tr key={name} className={`${i % 2 ? 'bg-gray-50/50' : ''} hover:bg-emerald-50/30`}><td className="px-4 py-2.5 font-medium">{name}</td><td className="text-center font-bold">{s.total}</td><td className="text-center text-emerald-600 font-semibold">{s.opened}</td><td className="text-center text-amber-600">{s.waiting}</td><td className="text-center text-blue-600">{s.progress}</td><td className="text-center text-red-600">{s.canceled}</td><td className="text-center text-purple-600 font-semibold">{s.periodNew}</td><td className="text-center">{s.total > 0 ? Math.round((s.opened / s.total) * 100) : 0}%</td></tr>))}</tbody></table></div>
        </div>
      </div>)}

      {tab === 'unopened' && (<div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {[{ l: '전체 미개설', v: unopened.length, c: 'text-gray-700' }, { l: '30일 이내', v: u30.length, c: 'text-emerald-600' }, { l: '30~90일', v: u3090.length, c: 'text-amber-600' }, { l: '90일+', v: u90.length, c: 'text-red-600' }, { l: '평균 기간', v: avgDays, c: 'text-blue-600' }].map((c) => (
            <div key={c.l} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 mb-1">{c.l}</p><p className={`text-2xl font-bold ${c.c}`}>{c.v.toLocaleString()}<span className="text-sm font-normal text-gray-400 ml-0.5">{c.l === '평균 기간' ? '일' : '건'}</span></p></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">기간별 분포</h3><ResponsiveContainer width="100%" height={180}><BarChart data={[{ name: '30일 이내', count: u30.length }, { name: '30~90일', count: u3090.length }, { name: '90일+', count: u90.length }]}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" radius={[4, 4, 0, 0]}>{['#059669', '#f59e0b', '#ef4444'].map((c, i) => <Cell key={i} fill={c} />)}</Bar></BarChart></ResponsiveContainer></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">담당자별 미개설 TOP 10</h3><ResponsiveContainer width="100%" height={180}><BarChart data={uMgrData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis type="number" tick={{ fontSize: 10 }} stroke="#9ca3af" /><YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} stroke="#9ca3af" width={60} /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-red-50"><h3 className="font-semibold text-red-700 text-sm">장기 미개설 (90일+) - {u90.length}건</h3></div>
          <div className="overflow-x-auto max-h-[350px] overflow-y-auto"><table className="w-full text-sm"><thead className="bg-gray-50 sticky top-0"><tr><th className="text-left px-4 py-2 text-xs font-semibold">고객명</th><th className="text-left px-3 py-2 text-xs">고객번호</th><th className="text-left px-3 py-2 text-xs">담당자</th><th className="text-left px-3 py-2 text-xs">접수일</th><th className="text-left px-3 py-2 text-xs">상태</th><th className="text-right px-4 py-2 text-xs text-red-600">미개설일수</th></tr></thead>
          <tbody className="divide-y divide-gray-50">{u90.sort((a, b) => getDays(b) - getDays(a)).slice(0, 50).map((c, i) => (<tr key={c.id} className={i % 2 ? 'bg-gray-50/50' : ''}><td className="px-4 py-2 font-medium">{c.customer_name}</td><td className="px-3 py-2 text-gray-600">{c.customer_number || '-'}</td><td className="px-3 py-2 text-gray-600">{c.manager || '-'}</td><td className="px-3 py-2 text-gray-600">{c.reception_date || '-'}</td><td className="px-3 py-2"><span className="px-1.5 py-0.5 rounded text-xs bg-amber-100 text-amber-700">{c.opening_status}</span></td><td className="px-4 py-2 text-right font-bold text-red-600">{getDays(c)}일</td></tr>))}</tbody></table></div>
        </div>
      </div>)}

      {tab === 'marketing' && (<div className="space-y-5">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4"><p className="text-sm text-amber-700">마케팅 데이터 연동 준비 중입니다. 상품별 데이터가 연동되면 자동 반영됩니다.</p></div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{['대시보드', '글로벌대시보드', '이음텍스', 'MAU'].map((p) => (<div key={p} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100"><p className="text-xs text-gray-500 mb-1">{p}</p><p className="text-2xl font-bold text-gray-300">-</p><p className="text-xs text-gray-400 mt-0.5">연동 예정</p></div>))}</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">ERP 회사별</h3><ResponsiveContainer width="100%" height={200}><BarChart data={erpData}><CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" /><XAxis dataKey="name" tick={{ fontSize: 9 }} stroke="#9ca3af" /><YAxis tick={{ fontSize: 10 }} stroke="#9ca3af" /><Tooltip formatter={(v) => `${Number(v).toLocaleString()}건`} /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5"><h3 className="font-semibold text-gray-800 mb-3">개설 전환율</h3><div className="text-center py-6"><p className="text-5xl font-bold text-emerald-600">{customers.length > 0 ? Math.round((sc.opened / customers.length) * 100) : 0}%</p><p className="text-sm text-gray-400 mt-2">완료 {sc.opened.toLocaleString()}건 / 전체 {customers.length.toLocaleString()}건</p></div></div>
        </div>
      </div>)}

      {showPreview && (<div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowPreview(false)}>
        <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100"><div><h3 className="font-bold text-gray-800">Excel 미리보기</h3><p className="text-xs text-gray-400 mt-0.5">{previewTitle} · {today}</p></div><div className="flex gap-2"><button onClick={confirmDownload} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"><Download size={14} /> 다운로드</button><button onClick={() => setShowPreview(false)} className="px-3 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm">닫기</button></div></div>
          <div className="flex-1 overflow-auto p-4"><div className="border border-gray-200 rounded-lg overflow-hidden"><table className="w-full text-sm"><tbody>{previewData.map((row, i) => {
            const isTitle = i === 0
            const isEmpty = row.length === 0
            const isSection = !isEmpty && row[0] != null && String(row[0]).startsWith('[')
            const cls = isTitle ? 'bg-slate-800 text-white font-bold' : isEmpty ? 'h-3' : isSection ? 'bg-gray-100 font-semibold' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
            return (<tr key={i} className={cls}>{isEmpty ? <td colSpan={10}></td> : row.map((cell: any, j: number) => (<td key={j} className={`px-3 py-1.5 border-b border-gray-100 whitespace-nowrap ${isTitle ? 'text-sm' : 'text-xs text-gray-700'}`}>{cell ?? ''}</td>))}</tr>)
          })}</tbody></table></div></div>
        </div>
      </div>)}
    </div>
  )
}
