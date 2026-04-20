import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import type { AccessLog, BranchType } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import * as XLSX from 'xlsx'

const ACTION_TYPES = [
  { value: '', label: '전체' },
  { value: 'LOGIN', label: '로그인' },
  { value: 'CUSTOMER_CREATE', label: '고객등록' },
  { value: 'CUSTOMER_UPDATE', label: '고객수정' },
  { value: 'CUSTOMER_DELETE', label: '고객삭제' },
  { value: 'REPORT_GENERATE', label: '보고서생성' },
  { value: 'USER_APPROVE', label: '사용자승인' },
  { value: 'USER_REJECT', label: '사용자거절' },
  { value: 'VOC_CREATE', label: 'VOC등록' },
  { value: 'ERP_MODIFY', label: 'ERP수정' },
]

const ACTION_BADGE: Record<string, string> = {
  LOGIN: 'bg-blue-100 text-blue-800',
  CUSTOMER_CREATE: 'bg-green-100 text-green-800',
  CUSTOMER_UPDATE: 'bg-yellow-100 text-yellow-800',
  CUSTOMER_DELETE: 'bg-red-100 text-red-800',
  REPORT_GENERATE: 'bg-purple-100 text-purple-800',
  USER_APPROVE: 'bg-emerald-100 text-emerald-800',
  USER_REJECT: 'bg-orange-100 text-orange-800',
  USER_SUSPEND: 'bg-gray-100 text-gray-800',
  USER_DELETE: 'bg-red-100 text-red-800',
  USER_ROLE_CHANGE: 'bg-indigo-100 text-indigo-800',
  USER_BRANCH_CHANGE: 'bg-cyan-100 text-cyan-800',
  USER_REACTIVATE: 'bg-teal-100 text-teal-800',
  VOC_CREATE: 'bg-pink-100 text-pink-800',
  ERP_MODIFY: 'bg-amber-100 text-amber-800',
}

export default function AccessLogsPage() {
  const [logs, setLogs] = useState<AccessLog[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const pageSize = 50

  // 필터
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterBranch, setFilterBranch] = useState<BranchType | '전체'>('전체')
  const [filterAction, setFilterAction] = useState('')
  const [keyword, setKeyword] = useState('')

  const totalPages = Math.ceil(totalCount / pageSize)

  const fetchLogs = useCallback(async () => {
    setIsLoading(true)
    let query = supabase
      .from('access_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`)
    if (filterBranch !== '전체') query = query.eq('branch', filterBranch)
    if (filterAction) query = query.eq('action_type', filterAction)
    if (keyword) {
      query = query.or(`user_name.ilike.%${keyword}%,user_email.ilike.%${keyword}%`)
    }

    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    const { data, count } = await query.range(from, to)

    if (data) setLogs(data as AccessLog[])
    setTotalCount(count ?? 0)
    setIsLoading(false)
  }, [dateFrom, dateTo, filterBranch, filterAction, keyword, page])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  // 필터 변경 시 페이지 리셋
  useEffect(() => { setPage(1) }, [dateFrom, dateTo, filterBranch, filterAction, keyword])

  // 엑셀 다운로드
  const handleExport = () => {
    if (logs.length === 0) return

    const exportData = logs.map((l) => ({
      '일시': new Date(l.created_at).toLocaleString('ko-KR'),
      '사용자': l.user_name,
      '이메일': l.user_email,
      '브랜치': l.branch,
      '액션': l.action_type,
      '대상': l.target_description,
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '접근로그')
    XLSX.writeFile(wb, `접근로그_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div>
      <Header title="접근 로그" />
      <div className="p-6">
        {/* 필터 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <label className="block text-xs text-gray-500 mb-1">시작일</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">종료일</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">브랜치</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value as BranchType | '전체')}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                <option value="전체">전체</option>
                {ALL_BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABELS[b]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">액션 유형</label>
              <select value={filterAction} onChange={(e) => setFilterAction(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs text-gray-500 mb-1">사용자 검색</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={keyword} onChange={(e) => setKeyword(e.target.value)}
                  placeholder="이름 또는 이메일" className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
            <button onClick={handleExport}
              className="px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 transition-colors">
              <Download size={16} /> Excel
            </button>
          </div>
        </div>

        {/* 테이블 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">사용자</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">브랜치</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">대상</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">로딩 중...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">로그가 없습니다</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs">{log.user_name || '-'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{log.user_email || '-'}</td>
                      <td className="px-4 py-3 text-xs">
                        {log.branch ? (
                          <span className="inline-flex px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                            {BRANCH_LABELS[log.branch as BranchType] ?? log.branch}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${ACTION_BADGE[log.action_type] || 'bg-gray-100 text-gray-600'}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs max-w-[250px] truncate">
                        {log.target_description || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                {(page - 1) * pageSize + 1}~{Math.min(page * pageSize, totalCount)} / {totalCount}건
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(page - 1)} disabled={page === 1}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronLeft size={16} />
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const startPage = Math.max(1, Math.min(page - 2, totalPages - 4))
                  const p = startPage + i
                  if (p > totalPages) return null
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      className={`w-8 h-8 text-sm rounded-lg transition-colors ${
                        p === page ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-700'
                      }`}>
                      {p}
                    </button>
                  )
                })}
                <button onClick={() => setPage(page + 1)} disabled={page === totalPages}
                  className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition-colors">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
