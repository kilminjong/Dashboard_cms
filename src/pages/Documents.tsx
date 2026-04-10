import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { Upload, Search, Trash2, Download, FileText, FileSpreadsheet, Presentation, File, X, Plus, FolderOpen } from 'lucide-react'

interface Document {
  id: string
  title: string
  description: string
  category: string
  file_name: string
  file_path: string
  file_size: number
  file_type: string
  uploaded_by_name: string
  created_at: string
}

const FILE_ICONS: Record<string, { icon: any; color: string }> = {
  'pptx': { icon: Presentation, color: 'text-orange-500 bg-orange-50' },
  'ppt': { icon: Presentation, color: 'text-orange-500 bg-orange-50' },
  'xlsx': { icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50' },
  'xls': { icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50' },
  'csv': { icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50' },
  'docx': { icon: FileText, color: 'text-blue-600 bg-blue-50' },
  'doc': { icon: FileText, color: 'text-blue-600 bg-blue-50' },
  'hwp': { icon: FileText, color: 'text-sky-600 bg-sky-50' },
  'hwpx': { icon: FileText, color: 'text-sky-600 bg-sky-50' },
  'pdf': { icon: FileText, color: 'text-red-500 bg-red-50' },
  'txt': { icon: FileText, color: 'text-gray-500 bg-gray-50' },
}

const CATEGORIES = ['일반', '가이드', '양식/템플릿', '매뉴얼', '교육자료', '회의자료', '기타']

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

export default function Documents() {
  const { profile } = useAuth()
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadForm, setUploadForm] = useState({ title: '', description: '', category: '일반' })
  const [uploadFiles, setUploadFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDocuments() }, [])

  const loadDocuments = async () => {
    const { data } = await supabase
      .from('shared_documents')
      .select('*')
      .order('created_at', { ascending: false })
    setDocuments(data || [])
    setLoading(false)
  }

  const handleUpload = async () => {
    if (uploadFiles.length === 0) { alert('파일을 선택해주세요.'); return }
    if (!uploadForm.title.trim()) { alert('문서 제목을 입력해주세요.'); return }

    setUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const userName = profile?.name || user?.user_metadata?.name || '알 수 없음'

    for (const file of uploadFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''
      const safeName = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`

      const { error: uploadError } = await supabase.storage.from('documents').upload(safeName, file, { cacheControl: '3600' })
      if (uploadError) {
        alert(`업로드 실패: ${uploadError.message}`)
        continue
      }

      await supabase.from('shared_documents').insert([{
        title: uploadFiles.length === 1 ? uploadForm.title.trim() : `${uploadForm.title.trim()} - ${file.name}`,
        description: uploadForm.description.trim(),
        category: uploadForm.category,
        file_name: file.name,
        file_path: `documents/${safeName}`,
        file_size: file.size,
        file_type: ext,
        uploaded_by: user?.id,
        uploaded_by_name: userName,
      }])
    }

    setUploading(false)
    setShowUploadModal(false)
    setUploadForm({ title: '', description: '', category: '일반' })
    setUploadFiles([])
    loadDocuments()
  }

  const handleDelete = async (doc: Document) => {
    if (!confirm(`"${doc.title}" 문서를 삭제하시겠습니까?`)) return
    const fileName = doc.file_path.replace('documents/', '')
    await supabase.storage.from('documents').remove([fileName])
    await supabase.from('shared_documents').delete().eq('id', doc.id)
    loadDocuments()
  }

  const handleDownload = (doc: Document) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
    const url = `${supabaseUrl}/storage/v1/object/public/${doc.file_path}`
    const a = document.createElement('a')
    a.href = url
    a.download = doc.file_name
    a.target = '_blank'
    a.click()
  }

  const getFileIcon = (ext: string) => {
    const config = FILE_ICONS[ext] || { icon: File, color: 'text-gray-400 bg-gray-50' }
    return config
  }

  // 필터 + 검색
  const filtered = documents.filter((doc) => {
    const matchSearch = !search || doc.title.toLowerCase().includes(search.toLowerCase()) || doc.file_name.toLowerCase().includes(search.toLowerCase()) || doc.description.toLowerCase().includes(search.toLowerCase())
    const matchCategory = !filterCategory || doc.category === filterCategory
    return matchSearch && matchCategory
  })

  const categories = [...new Set(documents.map((d) => d.category))]

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">공유 문서함</h2>
          <p className="text-sm text-gray-400 mt-0.5">팀 전체가 공유하는 가이드, 양식, 매뉴얼</p>
        </div>
        <button onClick={() => setShowUploadModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm shrink-0">
          <Upload size={16} /> 문서 업로드
        </button>
      </div>

      {/* 검색 + 필터 */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="문서명, 파일명으로 검색..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none text-sm" />
        </div>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
          <option value="">전체 카테고리</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <p className="text-sm text-gray-500 mb-3">총 <strong className="text-gray-700">{filtered.length}</strong>건{filtered.length !== documents.length && ` / 전체 ${documents.length}건`}</p>

      {/* 문서 목록 */}
      {loading ? (
        <p className="text-center py-12 text-gray-400">불러오는 중...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-100 shadow-sm">
          <FolderOpen size={40} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400">{search || filterCategory ? '검색 결과가 없습니다.' : '등록된 문서가 없습니다.'}</p>
          {!search && !filterCategory && (
            <button onClick={() => setShowUploadModal(true)} className="text-emerald-600 text-sm mt-2 hover:underline">첫 문서를 업로드해보세요</button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((doc) => {
            const { icon: FileIcon, color } = getFileIcon(doc.file_type)
            return (
              <div key={doc.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-gray-200 transition">
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-lg shrink-0 ${color}`}>
                    <FileIcon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-medium text-gray-800 text-sm truncate">{doc.title}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-gray-400">{doc.file_name}</span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="text-xs text-gray-400">{formatFileSize(doc.file_size)}</span>
                          <span className="text-xs text-gray-300">·</span>
                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">{doc.category}</span>
                        </div>
                        {doc.description && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{doc.description}</p>}
                        <p className="text-xs text-gray-300 mt-1">{doc.uploaded_by_name} · {new Date(doc.created_at).toLocaleDateString('ko-KR')}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleDownload(doc)}
                          className="p-2 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition" title="다운로드">
                          <Download size={16} />
                        </button>
                        <button onClick={() => handleDelete(doc)}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition" title="삭제">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 업로드 모달 */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowUploadModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-800">문서 업로드</h3>
              <button onClick={() => setShowUploadModal(false)} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">문서 제목 *</label>
                <input type="text" value={uploadForm.title} onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="문서 제목을 입력하세요" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select value={uploadForm.category} onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-emerald-500 outline-none">
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">설명 <span className="text-xs text-gray-400 font-normal">(선택)</span></label>
                <input type="text" value={uploadForm.description} onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none" placeholder="간단한 설명" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">파일 선택 *</label>
                <label className="flex items-center justify-center gap-2 py-8 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-emerald-400 hover:bg-emerald-50/30 transition">
                  <Plus size={20} className="text-gray-400" />
                  <span className="text-sm text-gray-500">파일을 선택하세요 (PPT, Excel, Word, HWP, PDF, TXT 등)</span>
                  <input ref={fileInputRef} type="file" multiple
                    accept=".ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.hwp,.hwpx,.pdf,.txt,.zip,.7z,.rar"
                    onChange={(e) => setUploadFiles(Array.from(e.target.files || []))}
                    className="hidden" />
                </label>
                {uploadFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {uploadFiles.map((file, idx) => {
                      const ext = file.name.split('.').pop()?.toLowerCase() || ''
                      const { icon: FIcon, color: fColor } = getFileIcon(ext)
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2 border border-gray-100">
                          <div className={`p-1 rounded ${fColor}`}><FIcon size={14} /></div>
                          <span className="text-xs text-gray-700 truncate flex-1">{file.name}</span>
                          <span className="text-xs text-gray-400">{formatFileSize(file.size)}</span>
                          <button onClick={() => setUploadFiles(uploadFiles.filter((_, i) => i !== idx))} className="p-0.5 text-gray-300 hover:text-red-500">
                            <X size={14} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowUploadModal(false)} className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium">취소</button>
              <button onClick={handleUpload} disabled={uploading}
                className="flex-1 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition text-sm font-medium flex items-center justify-center gap-1.5">
                <Upload size={15} /> {uploading ? '업로드 중...' : '업로드'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
