import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Target, Plus, Edit2, Trash2, Save, X, Calendar, TrendingUp } from 'lucide-react'

interface KpiItem {
  id: string
  year: number
  kpi_name: string
  kpi_category: string
  target_value: number
  unit: string
  description: string
  sort_order: number
  created_at: string
  updated_at: string
}

const CATEGORIES = ['일반', '고객관리', '사업', '서비스', '마케팅', '품질']
const UNITS = ['건', '%', '원', '명', '개', 'MAU']

export default function KpiSettings() {
  const [kpis, setKpis] = useState<KpiItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<KpiItem | null>(null)
  const [form, setForm] = useState({
    year: new Date().getFullYear(),
    kpi_name: '',
    kpi_category: '일반',
    target_value: 0,
    unit: '건',
    description: '',
  })

  useEffect(() => { loadKpis() }, [selectedYear])

  const loadKpis = async () => {
    const { data } = await supabase.from('kpi_targets').select('*').order('sort_order').order('created_at')
    const all = data || []
    setKpis(all.filter((k: KpiItem) => k.year === selectedYear))

    const years = [...new Set(all.map((k: KpiItem) => k.year))].sort((a, b) => b - a)
    const currentYear = new Date().getFullYear()
    if (!years.includes(currentYear)) years.unshift(currentYear)
    setAvailableYears(years)
    setLoading(false)
  }

  const openForm = (kpi?: KpiItem) => {
    if (kpi) {
      setEditing(kpi)
      setForm({
        year: kpi.year,
        kpi_name: kpi.kpi_name,
        kpi_category: kpi.kpi_category,
        target_value: kpi.target_value,
        unit: kpi.unit,
        description: kpi.description,
      })
    } else {
      setEditing(null)
      setForm({
        year: selectedYear,
        kpi_name: '',
        kpi_category: '일반',
        target_value: 0,
        unit: '건',
        description: '',
      })
    }
    setShowForm(true)
  }

  const saveKpi = async () => {
    if (!form.kpi_name.trim()) { alert('KPI 지표명을 입력해주세요.'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (editing) {
      await supabase.from('kpi_targets').update({
        year: form.year,
        kpi_name: form.kpi_name.trim(),
        kpi_category: form.kpi_category,
        target_value: form.target_value,
        unit: form.unit,
        description: form.description.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', editing.id)
    } else {
      await supabase.from('kpi_targets').insert([{
        year: form.year,
        kpi_name: form.kpi_name.trim(),
        kpi_category: form.kpi_category,
        target_value: form.target_value,
        unit: form.unit,
        description: form.description.trim(),
        sort_order: kpis.length + 1,
        created_by: user?.id,
      }])
    }
    setShowForm(false)
    loadKpis()
  }

  const deleteKpi = async (id: string) => {
    if (!confirm('이 KPI를 삭제하시겠습니까?')) return
    await supabase.from('kpi_targets').delete().eq('id', id)
    loadKpis()
  }

  const copyFromYear = async (fromYear: number) => {
    if (!confirm(`${fromYear}년 KPI를 ${selectedYear}년으로 복사하시겠습니까?`)) return
    const { data } = await supabase.from('kpi_targets').select('*').eq('year', fromYear)
    if (!data || data.length === 0) { alert('복사할 KPI가 없습니다.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    const newKpis = data.map((k: any) => ({
      year: selectedYear,
      kpi_name: k.kpi_name,
      kpi_category: k.kpi_category,
      target_value: k.target_value,
      unit: k.unit,
      description: k.description,
      sort_order: k.sort_order,
      created_by: user?.id,
    }))
    await supabase.from('kpi_targets').insert(newKpis)
    loadKpis()
  }

  // 카테고리별 그룹핑
  const grouped: Record<string, KpiItem[]> = {}
  kpis.forEach((k) => {
    if (!grouped[k.kpi_category]) grouped[k.kpi_category] = []
    grouped[k.kpi_category].push(k)
  })

  const formatValue = (value: number, unit: string) => {
    return value.toLocaleString() + (unit ? ` ${unit}` : '')
  }

  if (loading) return <div className="text-center py-12 text-gray-400">불러오는 중...</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">KPI 목표 관리</h2>
          <p className="text-sm text-gray-400 mt-0.5">연도별 목표 지표를 관리합니다. 보고서에 자동 반영됩니다.</p>
        </div>
        <div className="flex gap-2">
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
            {availableYears.map((y) => <option key={y} value={y}>{y}년</option>)}
          </select>
          <button onClick={() => openForm()}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm">
            <Plus size={15} /> KPI 추가
          </button>
        </div>
      </div>

      {/* 전년도 복사 */}
      {kpis.length === 0 && availableYears.filter((y) => y !== selectedYear).length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 flex items-center justify-between">
          <p className="text-sm text-blue-700">{selectedYear}년 KPI가 없습니다. 이전 연도에서 복사하시겠습니까?</p>
          <div className="flex gap-2">
            {availableYears.filter((y) => y !== selectedYear).slice(0, 3).map((y) => (
              <button key={y} onClick={() => copyFromYear(y)}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs hover:bg-blue-700">
                {y}년 복사
              </button>
            ))}
          </div>
        </div>
      )}

      {kpis.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
          <Target size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-3">{selectedYear}년 KPI가 없습니다.</p>
          <button onClick={() => openForm()} className="text-emerald-600 text-sm hover:underline">첫 KPI 추가하기</button>
        </div>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                <div className="w-1 h-4 bg-emerald-500 rounded"></div>
                <h3 className="font-semibold text-gray-700 text-sm">{cat}</h3>
                <span className="text-xs text-gray-400">{items.length}건</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((kpi) => (
                  <div key={kpi.id} className="px-5 py-3 hover:bg-gray-50/50 transition flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-gray-800 text-sm">{kpi.kpi_name}</span>
                        <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full">
                          목표: {formatValue(kpi.target_value, kpi.unit)}
                        </span>
                      </div>
                      {kpi.description && <p className="text-xs text-gray-500 mt-1">{kpi.description}</p>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => openForm(kpi)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition">
                        <Edit2 size={14} />
                      </button>
                      <button onClick={() => deleteKpi(kpi.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Target size={18} className="text-emerald-600" />
                {editing ? 'KPI 수정' : 'KPI 추가'}
              </h3>
              <button onClick={() => setShowForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><Calendar size={11} /> 연도 *</label>
                  <input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: parseInt(e.target.value) || selectedYear })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">카테고리</label>
                  <select value={form.kpi_category} onChange={(e) => setForm({ ...form, kpi_category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1 flex items-center gap-1"><TrendingUp size={11} /> KPI 지표명 *</label>
                <input type="text" value={form.kpi_name} onChange={(e) => setForm({ ...form, kpi_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="예: 신규 고객 유치, MAU 달성, 유통사업 매출" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">목표값 *</label>
                  <input type="number" value={form.target_value} onChange={(e) => setForm({ ...form, target_value: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">단위</label>
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">설명 <span className="text-gray-400">(선택)</span></label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="KPI에 대한 부연 설명" />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm">취소</button>
              <button onClick={saveKpi} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm flex items-center justify-center gap-1.5">
                <Save size={14} /> {editing ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
