import { useState, useEffect, useCallback } from 'react'
import Header from '@/components/layout/Header'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { BranchTarget } from '@/types'
import { ALL_BRANCHES, BRANCH_LABELS } from '@/types'
import { Save, Target } from 'lucide-react'

export default function TargetManagementPage() {
  const { user } = useAuthStore()
  const isSuperAdmin = user?.role === 'SUPER_ADMIN'
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [targets, setTargets] = useState<Record<string, { target_new: number; target_open: number; target_linkage: number }>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const fetchTargets = useCallback(async () => {
    setIsLoading(true)
    const { data } = await supabase.from('branch_targets').select('*').eq('year', year)
    const map: typeof targets = {}
    ALL_BRANCHES.forEach((b) => {
      const t = (data as BranchTarget[] | null)?.find((r) => r.branch === b)
      map[b] = {
        target_new: t?.target_new ?? 0,
        target_open: t?.target_open ?? 0,
        target_linkage: t?.target_linkage ?? 0,
      }
    })
    setTargets(map)
    setIsLoading(false)
  }, [year])

  useEffect(() => { fetchTargets() }, [fetchTargets])

  const handleChange = (branch: string, field: string, value: string) => {
    setTargets((prev) => ({
      ...prev,
      [branch]: { ...prev[branch], [field]: Number(value) || 0 },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    for (const branch of ALL_BRANCHES) {
      const t = targets[branch]
      if (!t) continue

      const { data: existing } = await supabase
        .from('branch_targets')
        .select('id')
        .eq('year', year)
        .eq('branch', branch)
        .single()

      if (existing) {
        await supabase.from('branch_targets').update({
          target_new: t.target_new,
          target_open: t.target_open,
          target_linkage: t.target_linkage,
        }).eq('id', existing.id)
      } else {
        await supabase.from('branch_targets').insert({
          year,
          branch,
          target_new: t.target_new,
          target_open: t.target_open,
          target_linkage: t.target_linkage,
          created_by: user?.id,
        })
      }
    }
    setIsSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  // 합계 계산
  const totals = ALL_BRANCHES.reduce(
    (acc, b) => ({
      target_new: acc.target_new + (targets[b]?.target_new ?? 0),
      target_open: acc.target_open + (targets[b]?.target_open ?? 0),
      target_linkage: acc.target_linkage + (targets[b]?.target_linkage ?? 0),
    }),
    { target_new: 0, target_open: 0, target_linkage: 0 }
  )

  return (
    <div>
      <Header title="연간 목표 관리" />
      <div className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
            {Array.from({ length: 5 }, (_, i) => currentYear + 1 - i).map((y) => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
          {isSuperAdmin && (
            <button onClick={handleSave} disabled={isSaving}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary-dark flex items-center gap-2 transition-colors disabled:opacity-50">
              <Save size={16} /> {isSaving ? '저장 중...' : '목표 저장'}
            </button>
          )}
          {saved && <span className="text-sm text-green-600 font-medium">저장 완료!</span>}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-200 flex items-center gap-2">
            <Target size={18} className="text-primary" />
            <h3 className="font-semibold text-gray-800">{year}년 브랜치별 KPI 목표 설정</h3>
          </div>

          {isLoading ? (
            <div className="p-12 text-center text-gray-400">로딩 중...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-medium text-gray-500">브랜치</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-blue-600">신규 인입 목표 (건)</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-green-600">개설 완료 목표 (건)</th>
                    <th className="px-5 py-3 text-center text-xs font-medium text-cyan-600">ERP 연계 목표 (건)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {ALL_BRANCHES.map((b) => (
                    <tr key={b} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">{BRANCH_LABELS[b]}</td>
                      <td className="px-5 py-3 text-center">
                        <input type="number" value={targets[b]?.target_new ?? 0}
                          onChange={(e) => handleChange(b, 'target_new', e.target.value)}
                          disabled={!isSuperAdmin}
                          className="w-24 px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input type="number" value={targets[b]?.target_open ?? 0}
                          onChange={(e) => handleChange(b, 'target_open', e.target.value)}
                          disabled={!isSuperAdmin}
                          className="w-24 px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                      </td>
                      <td className="px-5 py-3 text-center">
                        <input type="number" value={targets[b]?.target_linkage ?? 0}
                          onChange={(e) => handleChange(b, 'target_linkage', e.target.value)}
                          disabled={!isSuperAdmin}
                          className="w-24 px-3 py-1.5 text-center border border-gray-300 rounded-lg text-sm disabled:bg-gray-100" />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-semibold border-t-2 border-gray-300">
                    <td className="px-5 py-3 text-gray-900">사업2섹터 합계</td>
                    <td className="px-5 py-3 text-center text-blue-600">{totals.target_new.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center text-green-600">{totals.target_open.toLocaleString()}</td>
                    <td className="px-5 py-3 text-center text-cyan-600">{totals.target_linkage.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4">
          설정된 목표는 대시보드 달성율, 보고서에 자동 반영됩니다.
        </p>
      </div>
    </div>
  )
}
