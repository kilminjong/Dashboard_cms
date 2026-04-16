import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchCustomers } from '../lib/googleSheets'
import { useAuth } from '../hooks/useAuth'
import { Send, Bot, User, Trash2, Sparkles, Plus, MessageSquare, HelpCircle, Menu, ChevronDown, ChevronRight, Edit2, X, Save, Search, Image } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface FaqItem {
  id: string
  category: string
  question: string
  answer: string
  sort_order: number
  images?: string[]
}

const QUICK_PROMPTS = [
  '이번 달 신규 고객 몇 명이야?',
  '개설 안 된 고객 목록 보여줘',
  '내 담당 고객 현황 알려줘',
  '신규 고객 환영 이메일 작성해줘',
  'SQL 쿼리 정리해줘',
  '보고서 양식 만들어줘',
]

export default function AiAssistant() {
  const { profile } = useAuth()
  const [activeTab, setActiveTab] = useState<'chat' | 'faq'>('chat')

  // 대화 관련
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [currentConvId, setCurrentConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // FAQ 관련
  const [faqs, setFaqs] = useState<FaqItem[]>([])
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null)
  const [showFaqForm, setShowFaqForm] = useState(false)
  const [editingFaq, setEditingFaq] = useState<FaqItem | null>(null)
  const [faqForm, setFaqForm] = useState({ category: '', question: '', answer: '', images: '' })
  const [uploadingImage, setUploadingImage] = useState(false)
  const faqImageInputRef = useRef<HTMLInputElement>(null)
  const faqAnswerRef = useRef<HTMLTextAreaElement>(null)
  const [faqCategories, setFaqCategories] = useState<string[]>([])
  const [faqSearch, setFaqSearch] = useState('')

  useEffect(() => {
    loadConversations()
    loadFaqs()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 대화 관련 함수 ──
  const loadConversations = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('ai_conversations')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50)
    setConversations(data || [])
  }

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from('ai_messages')
      .select('role, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    setMessages(data || [])
    setCurrentConvId(convId)
    setActiveTab('chat')
    setSidebarOpen(false)
  }

  const startNewChat = () => {
    setCurrentConvId(null)
    setMessages([])
    setActiveTab('chat')
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  const deleteConversation = async (convId: string) => {
    await supabase.from('ai_conversations').delete().eq('id', convId)
    if (currentConvId === convId) { setCurrentConvId(null); setMessages([]) }
    loadConversations()
  }

  // ── FAQ 관련 함수 ──
  const loadFaqs = async () => {
    const { data } = await supabase.from('faqs').select('*').order('sort_order')
    const items = data || []
    setFaqs(items)
    setFaqCategories([...new Set(items.map((f) => f.category))])
  }

  const openFaqForm = (faq?: FaqItem) => {
    if (faq) {
      setEditingFaq(faq)
      setFaqForm({ category: faq.category, question: faq.question, answer: faq.answer, images: (faq.images || []).join('\n') })
    } else {
      setEditingFaq(null)
      setFaqForm({ category: '', question: '', answer: '', images: '' })
    }
    setShowFaqForm(true)
  }

  const saveFaq = async () => {
    if (!faqForm.category.trim() || !faqForm.question.trim() || !faqForm.answer.trim()) {
      alert('카테고리, 질문, 답변 모두 입력해주세요.')
      return
    }
    const { data: { user } } = await supabase.auth.getUser()
    const imageList = faqForm.images.split('\n').map((s) => s.trim()).filter(Boolean)
    if (editingFaq) {
      await supabase.from('faqs').update({
        category: faqForm.category.trim(),
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        images: imageList,
        updated_at: new Date().toISOString(),
      }).eq('id', editingFaq.id)
    } else {
      await supabase.from('faqs').insert([{
        category: faqForm.category.trim(),
        question: faqForm.question.trim(),
        answer: faqForm.answer.trim(),
        images: imageList,
        sort_order: faqs.length + 1,
        created_by: user?.id,
      }])
    }
    setShowFaqForm(false)
    loadFaqs()
  }

  const handleFaqImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setUploadingImage(true)

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const insertedTags: string[] = []

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
      const safeName = `faq_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error } = await supabase.storage.from('faq').upload(safeName, file, { cacheControl: '3600', upsert: false })
      if (error) {
        alert(`이미지 업로드 실패: ${error.message}`)
      } else {
        const imageUrl = `${supabaseUrl}/storage/v1/object/public/faq/${safeName}`
        insertedTags.push(`\n![이미지](${imageUrl})\n`)
      }
    }

    if (insertedTags.length > 0) {
      // 답변 텍스트의 커서 위치에 이미지 삽입
      const textarea = faqAnswerRef.current
      const tag = insertedTags.join('')
      if (textarea) {
        const start = textarea.selectionStart || faqForm.answer.length
        const before = faqForm.answer.substring(0, start)
        const after = faqForm.answer.substring(start)
        setFaqForm({ ...faqForm, answer: before + tag + after })
      } else {
        setFaqForm({ ...faqForm, answer: faqForm.answer + tag })
      }
    }

    setUploadingImage(false)
    if (faqImageInputRef.current) faqImageInputRef.current.value = ''
  }

  const deleteFaq = async (id: string) => {
    if (!confirm('이 FAQ를 삭제하시겠습니까?')) return
    await supabase.from('faqs').delete().eq('id', id)
    if (expandedFaqId === id) setExpandedFaqId(null)
    loadFaqs()
  }

  // ── AI 전송 ──
  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    const userMsg: Message = { role: 'user', content: msg, created_at: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setActiveTab('chat')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let convId = currentConvId
      if (!convId) {
        const title = msg.length > 30 ? msg.substring(0, 30) + '...' : msg
        const { data: newConv } = await supabase.from('ai_conversations').insert([{ user_id: user.id, title }]).select('id').single()
        if (newConv) { convId = newConv.id; setCurrentConvId(convId) }
      }
      if (convId) {
        await supabase.from('ai_messages').insert([{ conversation_id: convId, role: 'user', content: msg }])
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      const customers = await fetchCustomers().catch(() => [])

      const today = new Date().toISOString().split('T')[0]
      const { data: schedules } = await supabase.from('schedules').select('title, description, start_date').gte('start_date', today).order('start_date').limit(20)

      const allCustomers = customers || []
      const userMsgLower = msg.toLowerCase()

      const cmsKeywords = ['고객', '개설', '미개설', '담당', 'erp', '연계', '사업자', '접수', '신규', '취소', '진행', '대기', '완료', '이행', '인입', '등록', '몇명', '몇건', '현황', '목록', '리스트', '통계', '보여줘', '알려줘', '조회']
      const isCmsQuery = cmsKeywords.some((kw) => userMsgLower.includes(kw))

      const now = new Date()
      const monthlyStats: Record<string, number> = {}
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        monthlyStats[key] = allCustomers.filter((c) => c.reception_date?.startsWith(key)).length
      }
      const managerCounts: Record<string, number> = {}
      allCustomers.forEach((c) => { if (c.manager) managerCounts[c.manager] = (managerCounts[c.manager] || 0) + 1 })

      let filteredCustomers = allCustomers
      let isFiltered = false

      if (userMsgLower.includes('개설 안') || userMsgLower.includes('미개설') || userMsgLower.includes('개설되지') || userMsgLower.includes('개설전')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료'); isFiltered = true
      } else if (userMsgLower.includes('개설완료') || userMsgLower.includes('완료된')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료'); isFiltered = true
      } else if (userMsgLower.includes('개설취소') || userMsgLower.includes('취소된')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status === '개설취소'); isFiltered = true
      } else if (userMsgLower.includes('개설대기')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status === '개설대기'); isFiltered = true
      } else if (userMsgLower.includes('개설진행') || userMsgLower.includes('진행중')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status === '개설진행'); isFiltered = true
      }
      if (userMsgLower.includes('내 담당') || userMsgLower.includes('내가 담당')) {
        filteredCustomers = filteredCustomers.filter((c) => c.manager === (profile?.name || '')); isFiltered = true
      }

      const stats = {
        total: allCustomers.length,
        opened: allCustomers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length,
        waiting: allCustomers.filter((c) => c.opening_status === '개설대기').length,
        progress: allCustomers.filter((c) => c.opening_status === '개설진행').length,
        canceled: allCustomers.filter((c) => c.opening_status === '개설취소').length,
        thisMonthNew: allCustomers.filter((c) => c.reception_date?.startsWith(today.substring(0, 7))).length,
        myCustomers: allCustomers.filter((c) => c.manager === (profile?.name || '')).length,
        monthlyStats, managerCounts,
      }

      const chatHistory = newMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`, 'apikey': supabaseAnonKey },
        body: JSON.stringify({
          messages: chatHistory,
          filteredCustomers: isFiltered ? filteredCustomers.slice(0, 100) : [],
          filteredCount: isFiltered ? filteredCustomers.length : 0,
          isFiltered, isCmsQuery,
          stats: isCmsQuery ? stats : { total: allCustomers.length },
          scheduleData: schedules || [], managerName: profile?.name || '', date: today,
        }),
      })

      const responseText = await res.text()
      let reply = '오류가 발생했습니다. 관리자에게 문의해주세요.'
      if (res.ok) { const data = JSON.parse(responseText); reply = data?.reply || reply }

      setMessages((prev) => [...prev, { role: 'assistant', content: reply, created_at: new Date().toISOString() }])

      if (convId) {
        await supabase.from('ai_messages').insert([{ conversation_id: convId, role: 'assistant', content: reply }])
        await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId)
        loadConversations()
      }
    } catch (err) {
      console.error('[AI Chat 에러]', err)
      setMessages((prev) => [...prev, { role: 'assistant', content: '오류가 발생했습니다. 관리자에게 문의해주세요.', created_at: new Date().toISOString() }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }, [input, loading, messages, currentConvId, profile])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const mdComponents = {
    td: ({ children }: any) => <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-50 whitespace-nowrap">{children}</td>,
    p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-700">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-lg font-bold text-gray-800 mt-3 mb-2 first:mt-0">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-base font-bold text-gray-800 mt-3 mb-1.5 first:mt-0">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-bold text-gray-700 mt-2 mb-1 first:mt-0">{children}</h3>,
    ul: ({ children }: any) => <ul className="mb-2 ml-4 space-y-0.5 list-disc text-gray-700">{children}</ul>,
    ol: ({ children }: any) => <ol className="mb-2 ml-4 space-y-0.5 list-decimal text-gray-700">{children}</ol>,
    li: ({ children }: any) => <li className="text-sm">{children}</li>,
    strong: ({ children }: any) => <strong className="font-semibold text-gray-800">{children}</strong>,
    code: ({ children, className }: any) => {
      if (className?.includes('language-')) return <code className="block bg-gray-800 text-emerald-300 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre">{children}</code>
      return <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    },
    pre: ({ children }: any) => <div className="my-2">{children}</div>,
    table: ({ children }: any) => <div className="overflow-x-auto my-3 rounded-lg border border-gray-200"><table className="w-full text-sm">{children}</table></div>,
    thead: ({ children }: any) => <thead className="bg-emerald-50">{children}</thead>,
    th: ({ children }: any) => <th className="px-3 py-2 text-left text-xs font-semibold text-emerald-700 border-b border-gray-200 whitespace-nowrap">{children}</th>,
    tr: ({ children }: any) => <tr className="hover:bg-gray-50 transition">{children}</tr>,
    hr: () => <hr className="my-3 border-gray-200" />,
    a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700">{children}</a>,
  }

  return (
    <div className="flex h-[calc(100vh-8rem)]">
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* 좌측 사이드바 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gray-50 border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`} style={{ top: 'auto', height: 'calc(100vh - 8rem)' }}>
        <div className="p-3 border-b border-gray-200">
          <button onClick={startNewChat} className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium">
            <Plus size={16} /> 새 대화
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-center py-8 text-gray-300 text-xs">대화 이력이 없습니다.</p>
          ) : (
            conversations.map((conv) => (
              <div key={conv.id} onClick={() => loadMessages(conv.id)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition ${
                  currentConvId === conv.id && activeTab === 'chat' ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-gray-100 text-gray-600'
                }`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{conv.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{new Date(conv.updated_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id) }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition">
                  <Trash2 size={13} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* 메인 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 + 탭 */}
        <div className="bg-white border-b border-gray-100">
          <div className="flex items-center gap-3 px-4 py-3">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
              <Menu size={20} className="text-gray-500" />
            </button>
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Bot size={18} className="text-emerald-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold text-gray-800 text-sm">AI 어시스턴트</h2>
              <p className="text-xs text-gray-400 truncate">
                {activeTab === 'faq' ? 'FAQ · 자주 묻는 질문' : currentConvId ? conversations.find((c) => c.id === currentConvId)?.title || '대화 중' : 'Claude API 연동 · 모든 질문 가능'}
              </p>
            </div>
          </div>
          {/* 탭 */}
          <div className="flex px-4">
            <button onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'chat' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              <MessageSquare size={15} /> AI 채팅
            </button>
            <button onClick={() => setActiveTab('faq')}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition ${
                activeTab === 'faq' ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}>
              <HelpCircle size={15} /> FAQ
            </button>
          </div>
        </div>

        {/* ── AI 채팅 영역 ── */}
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <div className="bg-emerald-50 p-4 rounded-2xl mb-4"><Sparkles size={32} className="text-emerald-500" /></div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">무엇을 도와드릴까요?</h3>
                  <p className="text-sm text-gray-400 mb-6 max-w-sm">어떤 질문이든 물어보세요.<br />고객 데이터 조회, 이메일 작성, SQL 정리 등 모든 업무를 지원합니다.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button key={prompt} onClick={() => handleSend(prompt)}
                        className="text-left px-4 py-3 bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-gray-100 hover:border-emerald-200 rounded-xl text-sm text-gray-600 transition shadow-sm">
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      {msg.role === 'assistant' && <div className="bg-emerald-100 p-1.5 rounded-lg h-fit mt-0.5 shrink-0"><Bot size={16} className="text-emerald-600" /></div>}
                      <div className={`${msg.role === 'user' ? 'max-w-[85%] sm:max-w-[70%] bg-emerald-600 text-white rounded-2xl rounded-tr-md' : 'max-w-full w-full bg-white text-gray-800 rounded-2xl rounded-tl-md border border-gray-100 shadow-sm'} px-4 py-3`}>
                        {msg.role === 'assistant' ? (
                          <div className="markdown-body text-sm leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        )}
                        <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-emerald-200' : 'text-gray-300'}`}>
                          {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {msg.role === 'user' && <div className="bg-gray-200 p-1.5 rounded-lg h-fit mt-0.5 shrink-0"><User size={16} className="text-gray-500" /></div>}
                    </div>
                  ))}
                  {loading && (
                    <div className="flex gap-3 justify-start">
                      <div className="bg-emerald-100 p-1.5 rounded-lg h-fit mt-0.5 shrink-0"><Bot size={16} className="text-emerald-600" /></div>
                      <div className="bg-white rounded-2xl rounded-tl-md border border-gray-100 shadow-sm px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
            <div className="border-t border-gray-100 bg-white p-3">
              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
                  rows={1} disabled={loading}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none placeholder-gray-300 disabled:opacity-50 max-h-32"
                  placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)" style={{ minHeight: '42px' }}
                  onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = '42px'; t.style.height = Math.min(t.scrollHeight, 128) + 'px' }} />
                <button onClick={() => handleSend()} disabled={loading || !input.trim()}
                  className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition shrink-0">
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── FAQ 영역 ── */}
        {activeTab === 'faq' && (
          <div className="flex-1 overflow-y-auto bg-gray-50/50">
            <div className="max-w-3xl mx-auto p-4 sm:p-6">
              {/* FAQ 헤더 + 검색 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-gray-800">자주 묻는 질문</h3>
                  <p className="text-sm text-gray-400 mt-0.5">키워드로 검색하거나 항목을 선택하세요.</p>
                </div>
                <button onClick={() => openFaqForm()}
                  className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm shrink-0">
                  <Plus size={15} /> FAQ 등록
                </button>
              </div>

              {/* 검색바 */}
              <div className="relative mb-5">
                <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={faqSearch}
                  onChange={(e) => { setFaqSearch(e.target.value); setExpandedFaqId(null) }}
                  placeholder="검색어를 입력하세요 (예: 티베로, 오류, 설치방법)"
                  className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm bg-white shadow-sm"
                />
                {faqSearch && (
                  <button onClick={() => setFaqSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                    <X size={16} />
                  </button>
                )}
              </div>

              {(() => {
                // 검색 필터링: 질문, 답변, 카테고리 모두에서 키워드 매칭
                const query = faqSearch.trim().toLowerCase()
                const keywords = query.split(/\s+/).filter(Boolean)

                const filteredFaqs = query
                  ? faqs.filter((f) =>
                      keywords.some((kw) =>
                        f.question.toLowerCase().includes(kw) ||
                        f.answer.toLowerCase().includes(kw) ||
                        f.category.toLowerCase().includes(kw)
                      )
                    )
                  : faqs

                const filteredCategories = [...new Set(filteredFaqs.map((f) => f.category))]

                if (filteredFaqs.length === 0 && query) {
                  return (
                    <div className="text-center py-12">
                      <Search size={36} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400 text-sm">"{faqSearch}"에 대한 검색 결과가 없습니다.</p>
                      <p className="text-gray-300 text-xs mt-1">다른 키워드로 검색하거나 FAQ를 등록해보세요.</p>
                    </div>
                  )
                }

                if (filteredFaqs.length === 0) {
                  return (
                    <div className="text-center py-16">
                      <HelpCircle size={40} className="text-gray-200 mx-auto mb-3" />
                      <p className="text-gray-400">등록된 FAQ가 없습니다.</p>
                      <button onClick={() => openFaqForm()} className="text-emerald-600 text-sm mt-2 hover:underline">첫 FAQ를 등록해보세요</button>
                    </div>
                  )
                }

                return (
                  <div className="space-y-5">
                    {query && (
                      <p className="text-xs text-gray-400">검색 결과: <strong className="text-gray-600">{filteredFaqs.length}건</strong></p>
                    )}
                    {filteredCategories.map((cat) => (
                      <div key={cat}>
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-5 bg-emerald-500 rounded-full"></div>
                          <h4 className="text-sm font-bold text-gray-700">{cat}</h4>
                          <span className="text-xs text-gray-400">{filteredFaqs.filter((f) => f.category === cat).length}건</span>
                        </div>
                        <div className="space-y-2">
                          {filteredFaqs.filter((f) => f.category === cat).map((faq) => {
                            // 검색 키워드 하이라이트
                            const highlightText = (text: string) => {
                              if (!query) return text
                              let result = text
                              keywords.forEach((kw) => {
                                const regex = new RegExp(`(${kw})`, 'gi')
                                result = result.replace(regex, '|||$1|||')
                              })
                              return result
                            }

                            const questionParts = highlightText(faq.question).split('|||')
                            const isExpanded = expandedFaqId === faq.id

                            return (
                              <div key={faq.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden transition ${isExpanded ? 'border-emerald-200' : 'border-gray-100'}`}>
                                <button
                                  onClick={() => setExpandedFaqId(isExpanded ? null : faq.id)}
                                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition"
                                >
                                  <span className="text-sm font-medium text-gray-800 pr-4">
                                    {questionParts.map((part, idx) =>
                                      keywords.some((kw) => part.toLowerCase() === kw)
                                        ? <mark key={idx} className="bg-yellow-100 text-yellow-800 px-0.5 rounded">{part}</mark>
                                        : <span key={idx}>{part}</span>
                                    )}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className="text-xs text-gray-300">{faq.category}</span>
                                    {isExpanded
                                      ? <ChevronDown size={16} className="text-emerald-500" />
                                      : <ChevronRight size={16} className="text-gray-300" />
                                    }
                                  </div>
                                </button>
                                {isExpanded && (
                                  <div className="px-5 pb-4 border-t border-gray-50">
                                    <div className="bg-emerald-50/50 rounded-lg p-4 mt-3">
                                      <div className="text-sm text-gray-700 leading-relaxed markdown-body">
                                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                          ...mdComponents,
                                          img: ({ src, alt }: any) => (
                                            <a href={src} target="_blank" rel="noopener noreferrer" className="block my-3 border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition max-w-lg">
                                              <img src={src} alt={alt || 'FAQ 이미지'} className="w-full h-auto" loading="lazy" />
                                            </a>
                                          ),
                                          a: ({ href, children }: any) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700 break-all">{children}</a>,
                                        }}>{faq.answer}</ReactMarkdown>
                                      </div>
                                    </div>
                                    <div className="flex justify-end gap-2 mt-3">
                                      <button onClick={() => openFaqForm(faq)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-blue-500 transition">
                                        <Edit2 size={12} /> 수정
                                      </button>
                                      <button onClick={() => deleteFaq(faq.id)} className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition">
                                        <Trash2 size={12} /> 삭제
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </div>

      {/* FAQ 등록/수정 모달 */}
      {showFaqForm && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4" onClick={() => setShowFaqForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">{editingFaq ? 'FAQ 수정' : 'FAQ 등록'}</h3>
              <button onClick={() => setShowFaqForm(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
                  <div className="flex gap-2">
                    <select
                      value={faqCategories.includes(faqForm.category) ? faqForm.category : faqForm.category ? '__custom' : ''}
                      onChange={(e) => {
                        if (e.target.value === '__custom') setFaqForm({ ...faqForm, category: '' })
                        else setFaqForm({ ...faqForm, category: e.target.value })
                      }}
                      className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none"
                    >
                      <option value="">카테고리 선택</option>
                      {faqCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value="__custom">직접 입력</option>
                    </select>
                    {(!faqCategories.includes(faqForm.category)) && (
                      <input type="text" value={faqForm.category} onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                        className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="새 카테고리명" />
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">질문 *</label>
                  <input type="text" value={faqForm.question} onChange={(e) => setFaqForm({ ...faqForm, question: e.target.value })}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="FAQ 제목 / 질문을 입력하세요" />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-gray-700">답변 * <span className="text-xs text-gray-400 font-normal">(마크다운 지원)</span></label>
                  <label className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg text-xs cursor-pointer hover:bg-blue-100 transition ${uploadingImage ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Image size={13} />
                    {uploadingImage ? '업로드 중...' : '이미지 삽입'}
                    <input ref={faqImageInputRef} type="file" accept="image/*" multiple onChange={handleFaqImageUpload} className="hidden" />
                  </label>
                </div>
                <textarea
                  ref={faqAnswerRef}
                  value={faqForm.answer}
                  onChange={(e) => setFaqForm({ ...faqForm, answer: e.target.value })}
                  rows={15}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none resize-y font-mono leading-relaxed"
                  placeholder={"답변 내용을 입력하세요 (마크다운 형식 지원)\n\n예시:\n## 증상\n오류가 발생합니다.\n\n## 해결 방법\n1. 첫 번째 단계\n2. 두 번째 단계\n\n이미지는 커서 위치에 삽입됩니다."}
                />
                <p className="text-xs text-gray-400 mt-1">"이미지 삽입" 버튼을 누르면 답변 내 커서 위치에 이미지가 삽입됩니다. 위치를 바꾸려면 텍스트에서 ![이미지](...) 부분을 이동하세요.</p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowFaqForm(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">취소</button>
              <button onClick={saveFaq} className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium flex items-center justify-center gap-1.5">
                <Save size={15} /> {editingFaq ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
