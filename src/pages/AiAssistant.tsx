import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Send, Bot, User, Trash2, Sparkles, Plus, MessageSquare, HelpCircle, Menu } from 'lucide-react'
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

const QUICK_PROMPTS = [
  '이번 달 신규 고객 몇 명이야?',
  '개설 안 된 고객 목록 보여줘',
  '내 담당 고객 현황 알려줘',
  '신규 고객 환영 이메일 작성해줘',
  'SQL 쿼리 정리해줘',
  '보고서 양식 만들어줘',
]

// FAQ 데이터 (추후 사용자가 수정 가능)
const FAQ_ITEMS = [
  {
    category: 'CMS 시스템',
    items: [
      { q: '고객 등록은 어떻게 하나요?', a: '고객정보관리 메뉴에서 "고객 등록" 버튼을 클릭하여 필수 정보(고객명, 사업자번호, 고객번호, 담당자, 신규접수일, 개설상태)를 입력하면 됩니다.' },
      { q: '일괄등록은 어떻게 하나요?', a: '"일괄등록 양식 다운로드" 버튼으로 Excel 양식을 다운받아 작성 후, "일괄등록" 버튼으로 업로드하면 됩니다. 1행은 헤더이므로 2행부터 데이터를 입력해주세요.' },
      { q: '고객 정보 수정은 어떻게 하나요?', a: '고객정보관리에서 고객명을 클릭하면 상세 페이지로 이동합니다. "수정" 버튼을 눌러 정보를 수정하고 "저장"하면 변경 이력이 자동 기록됩니다.' },
      { q: '사업자번호 조회는 어떻게 하나요?', a: '고객정보관리 목록에서 사업자번호를 클릭하면 bizno.net에서 자동 검색됩니다. 모바일에서는 "BIZNO.NET 검색" 버튼을 이용하세요.' },
    ],
  },
  {
    category: '캘린더',
    items: [
      { q: '일정 등록은 어떻게 하나요?', a: '캘린더 메뉴에서 원하는 날짜를 클릭하면 해당 날짜의 일정 목록이 보입니다. "+ 일정 추가" 버튼을 눌러 제목, 시간, 설명을 입력하세요.' },
      { q: '일정 완료 처리는 어떻게 하나요?', a: '날짜를 클릭하여 일정 목록을 열면 각 일정 옆에 체크 버튼이 있습니다. 클릭하면 완료 처리됩니다. 종료 시간이 지나면 자동 완료 처리됩니다.' },
    ],
  },
  {
    category: 'AI 어시스턴트',
    items: [
      { q: 'AI에게 어떤 질문을 할 수 있나요?', a: 'CMS 고객 데이터 조회, 현황 분석은 물론 이메일 작성, SQL 정리, 보고서 작성, 코드 리뷰 등 모든 업무 질문이 가능합니다.' },
      { q: '대화 내역은 저장되나요?', a: '네, 모든 대화는 자동 저장됩니다. 좌측 사이드바에서 이전 대화를 확인하고 이어서 대화할 수 있습니다.' },
    ],
  },
  {
    category: '계정 관리',
    items: [
      { q: '비밀번호를 잊어버렸어요.', a: '로그인 화면에서 "비밀번호를 잊으셨나요?" 링크를 클릭하면 이메일로 재설정 링크가 발송됩니다.' },
      { q: '프로필 정보를 변경하고 싶어요.', a: '좌측 메뉴의 "정보수정"에서 이름, 전화번호를 변경할 수 있습니다.' },
    ],
  },
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
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)

  useEffect(() => {
    loadConversations()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

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
    setSidebarOpen(false)
  }

  const startNewChat = () => {
    setCurrentConvId(null)
    setMessages([])
    setSidebarOpen(false)
    inputRef.current?.focus()
  }

  const deleteConversation = async (convId: string) => {
    await supabase.from('ai_conversations').delete().eq('id', convId)
    if (currentConvId === convId) {
      setCurrentConvId(null)
      setMessages([])
    }
    loadConversations()
  }

  const handleSend = useCallback(async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    const userMsg: Message = { role: 'user', content: msg, created_at: new Date().toISOString() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // 대화방이 없으면 새로 생성
      let convId = currentConvId
      if (!convId) {
        const title = msg.length > 30 ? msg.substring(0, 30) + '...' : msg
        const { data: newConv } = await supabase.from('ai_conversations')
          .insert([{ user_id: user.id, title }])
          .select('id')
          .single()
        if (newConv) {
          convId = newConv.id
          setCurrentConvId(convId)
        }
      }

      // 유저 메시지 DB 저장
      if (convId) {
        await supabase.from('ai_messages').insert([{
          conversation_id: convId,
          role: 'user',
          content: msg,
        }])
      }

      // AI 호출
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      // 고객 데이터 (CMS 관련 질문 대응)
      const { data: customers } = await supabase
        .from('customers')
        .select('customer_name, opening_status, manager, reception_date, connection_status, erp_company, business_number, customer_number')
        .range(0, 9999)

      const today = new Date().toISOString().split('T')[0]
      const { data: schedules } = await supabase
        .from('schedules')
        .select('title, description, start_date')
        .gte('start_date', today)
        .order('start_date')
        .limit(20)

      // 필터링
      const userMsgLower = msg.toLowerCase()
      const allCustomers = customers || []
      let filteredCustomers = allCustomers

      if (userMsgLower.includes('개설 안') || userMsgLower.includes('미개설') || userMsgLower.includes('개설되지') || userMsgLower.includes('아직') || userMsgLower.includes('개설전')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status !== '개설완료' && c.opening_status !== '이행완료')
      } else if (userMsgLower.includes('개설완료') || userMsgLower.includes('완료된')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료')
      } else if (userMsgLower.includes('취소')) {
        filteredCustomers = allCustomers.filter((c) => c.opening_status === '개설취소')
      }

      if (userMsgLower.includes('내 담당') || userMsgLower.includes('내가 담당')) {
        filteredCustomers = filteredCustomers.filter((c) => c.manager === (profile?.name || ''))
      }

      const stats = {
        total: allCustomers.length,
        opened: allCustomers.filter((c) => c.opening_status === '개설완료' || c.opening_status === '이행완료').length,
        waiting: allCustomers.filter((c) => c.opening_status === '개설대기').length,
        progress: allCustomers.filter((c) => c.opening_status === '개설진행').length,
        canceled: allCustomers.filter((c) => c.opening_status === '개설취소').length,
        thisMonthNew: allCustomers.filter((c) => c.reception_date?.startsWith(today.substring(0, 7))).length,
        myCustomers: allCustomers.filter((c) => c.manager === (profile?.name || '')).length,
      }

      const chatHistory = newMessages.slice(-10).map((m) => ({ role: m.role, content: m.content }))

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          messages: chatHistory,
          filteredCustomers: filteredCustomers.slice(0, 100),
          filteredCount: filteredCustomers.length,
          stats,
          scheduleData: schedules || [],
          managerName: profile?.name || '',
          date: today,
        }),
      })

      const responseText = await res.text()
      let reply = '오류가 발생했습니다. 관리자에게 문의해주세요.'
      if (res.ok) {
        const data = JSON.parse(responseText)
        reply = data?.reply || reply
      }

      const assistantMsg: Message = { role: 'assistant', content: reply, created_at: new Date().toISOString() }
      setMessages((prev) => [...prev, assistantMsg])

      // AI 답변 DB 저장 + 대화방 업데이트
      if (convId) {
        await supabase.from('ai_messages').insert([{
          conversation_id: convId,
          role: 'assistant',
          content: reply,
        }])
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // 고객명 링크 변환
  const customerLinkRenderer = {
    td: ({ children }: any) => {
      return <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-50 whitespace-nowrap">{children}</td>
    },
    p: ({ children }: any) => <p className="mb-2 last:mb-0 text-gray-700">{children}</p>,
    h1: ({ children }: any) => <h1 className="text-lg font-bold text-gray-800 mt-3 mb-2 first:mt-0">{children}</h1>,
    h2: ({ children }: any) => <h2 className="text-base font-bold text-gray-800 mt-3 mb-1.5 first:mt-0">{children}</h2>,
    h3: ({ children }: any) => <h3 className="text-sm font-bold text-gray-700 mt-2 mb-1 first:mt-0">{children}</h3>,
    ul: ({ children }: any) => <ul className="mb-2 ml-4 space-y-0.5 list-disc text-gray-700">{children}</ul>,
    ol: ({ children }: any) => <ol className="mb-2 ml-4 space-y-0.5 list-decimal text-gray-700">{children}</ol>,
    li: ({ children }: any) => <li className="text-sm">{children}</li>,
    strong: ({ children }: any) => <strong className="font-semibold text-gray-800">{children}</strong>,
    code: ({ children, className }: any) => {
      if (className?.includes('language-')) {
        return <code className="block bg-gray-800 text-emerald-300 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre">{children}</code>
      }
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
      {/* 모바일 오버레이 */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 좌측 사이드바 - 대화 이력 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-72 bg-gray-50 border-r border-gray-200 flex flex-col transform transition-transform duration-200 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`} style={{ top: 'auto', height: 'calc(100vh - 8rem)' }}>
        <div className="p-3 border-b border-gray-200">
          <button onClick={startNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium">
            <Plus size={16} /> 새 대화
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b border-gray-200">
          <button onClick={() => setActiveTab('chat')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
              activeTab === 'chat' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <MessageSquare size={14} /> 대화
          </button>
          <button onClick={() => setActiveTab('faq')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition ${
              activeTab === 'faq' ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-400 hover:text-gray-600'
            }`}>
            <HelpCircle size={14} /> FAQ
          </button>
        </div>

        {/* 대화 이력 목록 */}
        {activeTab === 'chat' && (
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {conversations.length === 0 ? (
              <p className="text-center py-8 text-gray-300 text-xs">대화 이력이 없습니다.</p>
            ) : (
              conversations.map((conv) => (
                <div key={conv.id}
                  onClick={() => loadMessages(conv.id)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition ${
                    currentConvId === conv.id ? 'bg-emerald-100 text-emerald-800' : 'hover:bg-gray-100 text-gray-600'
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
        )}

        {/* FAQ */}
        {activeTab === 'faq' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {FAQ_ITEMS.map((cat) => (
              <div key={cat.category}>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1.5">{cat.category}</p>
                <div className="space-y-1">
                  {cat.items.map((item) => {
                    const key = `${cat.category}-${item.q}`
                    return (
                      <div key={key}>
                        <button onClick={() => setExpandedFaq(expandedFaq === key ? null : key)}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-emerald-50 rounded-lg transition">
                          {item.q}
                        </button>
                        {expandedFaq === key && (
                          <div className="px-3 py-2 mx-2 mb-1 bg-white rounded-lg border border-gray-100 text-xs text-gray-600 leading-relaxed">
                            {item.a}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* 메인 채팅 영역 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 헤더 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-1.5 hover:bg-gray-100 rounded-lg">
            <Menu size={20} className="text-gray-500" />
          </button>
          <div className="bg-emerald-100 p-2 rounded-lg">
            <Bot size={18} className="text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-gray-800 text-sm">AI 어시스턴트</h2>
            <p className="text-xs text-gray-400 truncate">
              {currentConvId ? conversations.find((c) => c.id === currentConvId)?.title || '대화 중' : 'Claude API 연동 · 모든 질문 가능'}
            </p>
          </div>
        </div>

        {/* 대화 영역 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="bg-emerald-50 p-4 rounded-2xl mb-4">
                <Sparkles size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">무엇을 도와드릴까요?</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">
                어떤 질문이든 물어보세요.<br />
                고객 데이터 조회, 이메일 작성, SQL 정리 등 모든 업무를 지원합니다.
              </p>
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
                  {msg.role === 'assistant' && (
                    <div className="bg-emerald-100 p-1.5 rounded-lg h-fit mt-0.5 shrink-0">
                      <Bot size={16} className="text-emerald-600" />
                    </div>
                  )}
                  <div className={`max-w-[90%] sm:max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-md'
                      : 'bg-white text-gray-800 rounded-2xl rounded-tl-md border border-gray-100 shadow-sm'
                  } px-4 py-3`}>
                    {msg.role === 'assistant' ? (
                      <div className="markdown-body text-sm leading-relaxed">
                        <ReactMarkdown remarkPlugins={[remarkGfm]} components={customerLinkRenderer}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-emerald-200' : 'text-gray-300'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  {msg.role === 'user' && (
                    <div className="bg-gray-200 p-1.5 rounded-lg h-fit mt-0.5 shrink-0">
                      <User size={16} className="text-gray-500" />
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 justify-start">
                  <div className="bg-emerald-100 p-1.5 rounded-lg h-fit mt-0.5 shrink-0">
                    <Bot size={16} className="text-emerald-600" />
                  </div>
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

        {/* 입력 영역 */}
        <div className="border-t border-gray-100 bg-white p-3">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
              className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm resize-none placeholder-gray-300 disabled:opacity-50 max-h-32"
              placeholder="메시지를 입력하세요... (Shift+Enter로 줄바꿈)"
              style={{ minHeight: '42px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement
                target.style.height = '42px'
                target.style.height = Math.min(target.scrollHeight, 128) + 'px'
              }}
            />
            <button onClick={() => handleSend()} disabled={loading || !input.trim()}
              className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition shrink-0">
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
