import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Send, Bot, User, Trash2, Sparkles } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const QUICK_PROMPTS = [
  '이번 달 신규 고객 몇 명이야?',
  '개설 안 된 고객 목록 보여줘',
  '내 담당 고객 현황 알려줘',
  '신규 고객 환영 이메일 초안 작성해줘',
  '이번 주 일정 알려줘',
  'CMS 시스템 사용법 알려줘',
]

export default function AiAssistant() {
  const { profile } = useAuth()
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = sessionStorage.getItem('ai_chat_messages')
    if (saved) {
      return JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }))
    }
    return []
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (messages.length > 0) {
      sessionStorage.setItem('ai_chat_messages', JSON.stringify(messages))
    }
  }, [messages])

  const handleSend = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return

    const userMessage: Message = { role: 'user', content: msg, timestamp: new Date() }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
      const { data: { session } } = await supabase.auth.getSession()

      const { data: customers } = await supabase
        .from('customers')
        .select('customer_name, opening_status, manager, reception_date, connection_status, erp_company, business_number')
        .range(0, 9999)

      const today = new Date().toISOString().split('T')[0]
      const { data: schedules } = await supabase
        .from('schedules')
        .select('title, description, start_date')
        .gte('start_date', today)
        .order('start_date')
        .limit(20)

      const chatHistory = newMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          messages: chatHistory,
          customerData: customers || [],
          scheduleData: schedules || [],
          managerName: profile?.name || '',
          date: today,
        }),
      })

      const responseText = await res.text()
      if (!res.ok) {
        console.error(`[AI Chat 에러 ${res.status}]`, responseText)
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: '오류가 발생했습니다. 관리자에게 문의해주세요.',
          timestamp: new Date(),
        }])
      } else {
        const data = JSON.parse(responseText)
        setMessages((prev) => [...prev, {
          role: 'assistant',
          content: data?.reply || '응답을 생성할 수 없습니다.',
          timestamp: new Date(),
        }])
      }
    } catch (err) {
      console.error('[AI Chat 에러]', err)
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: '오류가 발생했습니다. 관리자에게 문의해주세요.',
        timestamp: new Date(),
      }])
    }
    setLoading(false)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const clearChat = () => {
    setMessages([])
    sessionStorage.removeItem('ai_chat_messages')
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-2.5 rounded-xl">
            <Bot size={22} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">AI 어시스턴트</h2>
            <p className="text-xs text-gray-400">CMS팀 전용 · Claude API 연동</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="flex items-center gap-1.5 px-3 py-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition text-sm"
          >
            <Trash2 size={14} />
            대화 초기화
          </button>
        )}
      </div>

      {/* 대화 영역 */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="bg-emerald-50 p-4 rounded-2xl mb-4">
                <Sparkles size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-700 mb-2">무엇을 도와드릴까요?</h3>
              <p className="text-sm text-gray-400 mb-6 max-w-sm">
                고객 데이터 조회, 현황 분석, 이메일/제안서 초안 작성,<br />
                SQL 쿼리 정리 등 업무에 관한 모든 것을 물어보세요.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="text-left px-4 py-3 bg-gray-50 hover:bg-emerald-50 hover:text-emerald-700 border border-gray-100 hover:border-emerald-200 rounded-xl text-sm text-gray-600 transition"
                  >
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
                  <div className={`max-w-[85%] sm:max-w-[75%] ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-2xl rounded-tr-md'
                      : 'bg-gray-50 text-gray-800 rounded-2xl rounded-tl-md border border-gray-100'
                  } px-4 py-3`}>
                    {msg.role === 'assistant' ? (
                      <div className="markdown-body text-sm leading-relaxed">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => <h1 className="text-lg font-bold text-gray-800 mt-3 mb-2 first:mt-0">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-base font-bold text-gray-800 mt-3 mb-1.5 first:mt-0">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-sm font-bold text-gray-700 mt-2 mb-1 first:mt-0">{children}</h3>,
                            p: ({ children }) => <p className="mb-2 last:mb-0 text-gray-700">{children}</p>,
                            ul: ({ children }) => <ul className="mb-2 ml-4 space-y-0.5 list-disc text-gray-700">{children}</ul>,
                            ol: ({ children }) => <ol className="mb-2 ml-4 space-y-0.5 list-decimal text-gray-700">{children}</ol>,
                            li: ({ children }) => <li className="text-sm">{children}</li>,
                            strong: ({ children }) => <strong className="font-semibold text-gray-800">{children}</strong>,
                            em: ({ children }) => <em className="text-gray-600 italic">{children}</em>,
                            code: ({ children, className }) => {
                              const isBlock = className?.includes('language-')
                              if (isBlock) {
                                return (
                                  <code className="block bg-gray-800 text-emerald-300 rounded-lg p-3 my-2 text-xs font-mono overflow-x-auto whitespace-pre">
                                    {children}
                                  </code>
                                )
                              }
                              return <code className="bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                            },
                            pre: ({ children }) => <div className="my-2">{children}</div>,
                            table: ({ children }) => (
                              <div className="overflow-x-auto my-2 rounded-lg border border-gray-200">
                                <table className="w-full text-sm">{children}</table>
                              </div>
                            ),
                            thead: ({ children }) => <thead className="bg-emerald-50">{children}</thead>,
                            th: ({ children }) => <th className="px-3 py-2 text-left text-xs font-semibold text-emerald-700 border-b border-gray-200">{children}</th>,
                            td: ({ children }) => <td className="px-3 py-2 text-xs text-gray-700 border-b border-gray-50">{children}</td>,
                            tr: ({ children }) => <tr className="hover:bg-gray-50">{children}</tr>,
                            hr: () => <hr className="my-3 border-gray-200" />,
                            blockquote: ({ children }) => (
                              <blockquote className="border-l-3 border-emerald-400 bg-emerald-50/50 pl-3 py-1 my-2 text-sm text-gray-600 rounded-r-lg">
                                {children}
                              </blockquote>
                            ),
                            a: ({ href, children }) => (
                              <a href={href} target="_blank" rel="noopener noreferrer" className="text-emerald-600 underline hover:text-emerald-700">
                                {children}
                              </a>
                            ),
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    )}
                    <p className={`text-[10px] mt-1.5 ${msg.role === 'user' ? 'text-emerald-200' : 'text-gray-300'}`}>
                      {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
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
                  <div className="bg-gray-50 rounded-2xl rounded-tl-md border border-gray-100 px-4 py-3">
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
        <div className="border-t border-gray-100 p-3">
          <div className="flex items-end gap-2">
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
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="p-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition shrink-0"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
