import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCustomers, appendMemo } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { MessageSquarePlus, X, Search, Save, CheckCircle, ExternalLink } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export default function QuickMemo() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [memo, setMemo] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [selected, setSelected] = useState<any | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [allCustomers, setAllCustomers] = useState<any[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const memoRef = useRef<HTMLTextAreaElement>(null)

  // 모달 열 때 고객 목록 한 번만 로드
  const openModal = async () => {
    setOpen(true)
    setSavedId(null)
    if (allCustomers.length === 0) {
      setLoadingCustomers(true)
      const customers = await fetchCustomers()
      setAllCustomers(customers)
      setLoadingCustomers(false)
    }
    setTimeout(() => searchRef.current?.focus(), 100)
  }

  const closeModal = () => {
    setOpen(false)
    setQuery('')
    setMemo('')
    setSelected(null)
    setResults([])
    setSavedId(null)
  }

  // Esc 키로 닫기
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearch = (q: string) => {
    setQuery(q)
    setSelected(null)
    setSavedId(null)
    if (!q.trim()) { setResults([]); return }
    const filtered = allCustomers
      .filter((c: any) => c.customer_name?.includes(q.trim()))
      .slice(0, 8)
    setResults(filtered)
  }

  const handleSelect = (c: any) => {
    setSelected(c)
    setResults([])
    setQuery(c.customer_name)
    setTimeout(() => memoRef.current?.focus(), 50)
  }

  const handleSave = async () => {
    if (!selected || !memo.trim()) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const userName = profile?.name || user?.user_metadata?.name || ''
      await appendMemo({
        customer_id: selected.id,
        customer_name: selected.customer_name || '',
        content: memo.trim(),
        created_by: userName,
      })
      setSavedId(selected.id)
      setMemo('')
      setQuery('')
      setSelected(null)
    } catch (err: any) {
      alert('메모 저장 실패: ' + err.message)
    }
    setSaving(false)
  }

  return (
    <>
      {/* 플로팅 버튼 */}
      <button
        onClick={openModal}
        title="빠른 메모 (단축키: 없음)"
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all hover:scale-105 active:scale-95"
      >
        <MessageSquarePlus size={22} />
      </button>

      {/* 모달 오버레이 */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <MessageSquarePlus size={18} className="text-emerald-600" />
                <span className="font-semibold text-gray-800">빠른 메모</span>
                <span className="text-xs text-gray-400">전화 중 빠르게 메모하세요</span>
              </div>
              <button onClick={closeModal} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* 저장 완료 메시지 */}
              {savedId && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium">
                    <CheckCircle size={16} />
                    메모가 저장되었습니다.
                  </div>
                  <button
                    onClick={() => { closeModal(); navigate(`/customers/${savedId}`) }}
                    className="flex items-center gap-1 text-xs text-emerald-600 hover:underline"
                  >
                    고객 페이지 이동 <ExternalLink size={11} />
                  </button>
                </div>
              )}

              {/* 고객사 검색 */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  고객사 검색
                </label>
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={query}
                    onChange={(e) => handleSearch(e.target.value)}
                    onFocus={() => { if (query && !selected) handleSearch(query) }}
                    placeholder="고객사 이름으로 검색..."
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                    autoComplete="off"
                  />
                  {loadingCustomers && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>

                {/* 검색 결과 드롭다운 */}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {results.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => handleSelect(c)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-emerald-50 flex items-center justify-between gap-3 transition"
                      >
                        <span className="font-medium text-gray-800 truncate">{c.customer_name}</span>
                        <span className="text-xs text-gray-400 shrink-0">{c.manager || ''}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* 선택된 고객 표시 */}
                {selected && (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-emerald-600 font-medium">{selected.customer_name}</span>
                    <span className="text-xs text-gray-400">선택됨</span>
                    <button onClick={() => { setSelected(null); setQuery(''); searchRef.current?.focus() }} className="ml-1 text-xs text-gray-400 hover:text-red-400">✕</button>
                  </div>
                )}
              </div>

              {/* 메모 입력 */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                  메모 내용
                </label>
                <textarea
                  ref={memoRef}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  rows={4}
                  placeholder="통화 내용, 요청 사항, 특이사항 등을 입력하세요..."
                  className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                />
                <p className="text-xs text-gray-300 text-right mt-1">{memo.length}자</p>
              </div>

              {/* 저장 버튼 */}
              <button
                onClick={handleSave}
                disabled={!selected || !memo.trim() || saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <Save size={15} />
                {saving ? '저장 중...' : '메모 저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
