import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadAllVoc, deleteVoc, vocTone, VOC_TYPES, type BranchQVoc } from '../lib/branchq'
import { MessageSquareText, RefreshCw, Search, FileDown, Download, ChevronRight, Trash2, AlertTriangle } from 'lucide-react'
import * as XLSX from 'xlsx-js-style'
import html2canvas from 'html2canvas-pro'
import jsPDF from 'jspdf'

const pad = (n: number) => String(n).padStart(2, '0')
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }

export default function BranchQVoc() {
  const navigate = useNavigate()
  const [voc, setVoc] = useState<BranchQVoc[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('전체')
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<BranchQVoc | null>(null)
  const [deleting, setDeleting] = useState(false)
  const tableRef = useRef<HTMLDivElement>(null)

  const reload = async () => setVoc(await loadAllVoc())
  useEffect(() => { (async () => { await reload(); setLoading(false) })() }, [])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteVoc(deleteTarget.id)
      await reload()
      setDeleteTarget(null)
    } finally { setDeleting(false) }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return voc
      .filter((v) => typeFilter === '전체' || v.voc_type === typeFilter)
      .filter((v) => !q || v.customer_name?.toLowerCase().includes(q) || v.content?.toLowerCase().includes(q) || String(v.customer_number).includes(q))
      .sort((a, b) => (a.voc_date < b.voc_date ? 1 : -1))
  }, [voc, typeFilter, search])

  const counts = useMemo(() => {
    const c: Record<string, number> = { 전체: voc.length }
    VOC_TYPES.forEach((t) => { c[t] = voc.filter((v) => v.voc_type === t).length })
    return c
  }, [voc])

  const exportExcel = () => {
    if (filtered.length === 0) { alert('내보낼 VOC가 없습니다.'); return }
    const data: any[][] = [
      ['브랜치Q POC - VOC 모음'],
      [`생성일: ${todayStr()} · 총 ${filtered.length}건${typeFilter !== '전체' ? ` · 유형:${typeFilter}` : ''}`],
      [],
      ['날짜', '고객명', '고객번호', '유형', 'VOC 내용', '작성자'],
      ...filtered.map((v) => [v.voc_date, v.customer_name || '-', v.customer_number, v.voc_type, v.content, v.author || '-']),
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const maxCols = 6
    ws['!cols'] = [{ wch: 13 }, { wch: 22 }, { wch: 14 }, { wch: 8 }, { wch: 60 }, { wch: 12 }]
    ws['!rows'] = data.map((_, ri) => (ri === 0 ? { hpt: 28 } : { hpt: 18 }))
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: maxCols - 1 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: maxCols - 1 } }]
    const thin = { style: 'thin', color: { rgb: 'D1D5DB' } }
    const border = { top: thin, bottom: thin, left: thin, right: thin }
    data.forEach((_row, ri) => {
      for (let ci = 0; ci < maxCols; ci++) {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci })
        if (!ws[addr]) ws[addr] = { t: 's', v: '' }
        const cell = ws[addr]
        if (ri === 0) cell.s = { font: { bold: true, sz: 15, color: { rgb: 'FFFFFF' }, name: '맑은 고딕' }, fill: { patternType: 'solid', fgColor: { rgb: '1E293B' } }, alignment: { horizontal: 'center', vertical: 'center' }, border }
        else if (ri === 1) cell.s = { font: { sz: 9, italic: true, color: { rgb: '6B7280' }, name: '맑은 고딕' }, alignment: { horizontal: 'right' } }
        else if (ri === 3) cell.s = { font: { bold: true, sz: 10, color: { rgb: 'FFFFFF' }, name: '맑은 고딕' }, fill: { patternType: 'solid', fgColor: { rgb: '059669' } }, alignment: { horizontal: 'center', vertical: 'center' }, border }
        else if (ri > 3) cell.s = { font: { sz: 10, color: { rgb: '111827' }, name: '맑은 고딕' }, alignment: { horizontal: ci === 4 ? 'left' : 'center', vertical: 'center', wrapText: ci === 4 }, fill: ri % 2 === 1 ? { patternType: 'solid', fgColor: { rgb: 'F9FAFB' } } : undefined, border }
      }
    })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'VOC')
    XLSX.writeFile(wb, `브랜치Q_VOC_${todayStr()}.xlsx`)
  }

  const exportPdf = async () => {
    if (!tableRef.current || filtered.length === 0) { if (filtered.length === 0) alert('내보낼 VOC가 없습니다.'); return }
    setExporting(true)
    try {
      const canvas = await html2canvas(tableRef.current, { scale: 2, backgroundColor: '#ffffff', logging: false, useCORS: true })
      const img = canvas.toDataURL('image/png')
      const pdf = new jsPDF('p', 'mm', 'a4')
      const margin = 10, pageW = 210, pageH = 297
      const w = pageW - margin * 2
      const h = (canvas.height * w) / canvas.width
      const printable = pageH - margin * 2
      if (h <= printable) pdf.addImage(img, 'PNG', margin, margin, w, h)
      else {
        let left = h, pos = margin
        pdf.addImage(img, 'PNG', margin, pos, w, h); left -= printable
        while (left > 0) { pos = margin - (h - left); pdf.addPage(); pdf.addImage(img, 'PNG', margin, pos, w, h); left -= printable }
      }
      pdf.save(`브랜치Q_VOC_${todayStr()}.pdf`)
    } catch (e) { alert('PDF 생성 실패: ' + String((e as any)?.message || e)) }
    finally { setExporting(false) }
  }

  if (loading) return <div className="flex items-center justify-center py-20"><RefreshCw size={24} className="animate-spin text-emerald-500" /></div>

  return (
    <div>
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-50 grid place-items-center"><MessageSquareText size={17} className="text-blue-600" /></span>
            <h2 className="text-2xl font-bold text-gray-800">VOC 확인</h2>
          </div>
          <p className="text-sm text-gray-400 mt-1">브랜치Q POC 대상고객의 전체 VOC를 한눈에 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportPdf} disabled={exporting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100 text-sm disabled:opacity-50"><FileDown size={14} /> {exporting ? '생성 중…' : 'PDF'}</button>
          <button onClick={exportExcel} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 text-sm"><Download size={14} /> Excel</button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 flex-wrap mb-3">
        {['전체', ...VOC_TYPES].map((t) => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${typeFilter === t ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
            {t} <span className={typeFilter === t ? 'text-gray-300' : 'text-gray-400'}>{counts[t] ?? 0}</span>
          </button>
        ))}
        <div className="relative ml-auto">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="고객명·내용 검색"
            className="pl-8 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
        </div>
      </div>

      {/* 표 (PDF 캡처 영역) */}
      <div ref={tableRef} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                <th className="text-left px-4 py-3 text-xs font-bold w-28">날짜</th>
                <th className="text-left px-4 py-3 text-xs font-bold w-44">고객명</th>
                <th className="text-center px-3 py-3 text-xs font-bold w-20">유형</th>
                <th className="text-left px-4 py-3 text-xs font-bold">VOC 내용</th>
                <th className="text-center px-3 py-3 text-xs font-bold w-24">작성자</th>
                <th className="px-2 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-14 text-gray-400 text-sm">표시할 VOC가 없습니다.</td></tr>
              ) : filtered.map((v) => (
                <tr key={v.id} onClick={() => navigate(`/branchq/customer/${encodeURIComponent(v.customer_number)}`)}
                  className="hover:bg-blue-50/30 cursor-pointer transition group align-top">
                  <td className="px-4 py-3 text-gray-500 tabular-nums whitespace-nowrap">{v.voc_date}</td>
                  <td className="px-4 py-3 font-semibold text-gray-800 group-hover:text-blue-700">{v.customer_name || v.customer_number}</td>
                  <td className="text-center px-3 py-3"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold ${vocTone(v.voc_type)}`}>{v.voc_type}</span></td>
                  <td className="px-4 py-3 text-gray-700 whitespace-pre-wrap leading-relaxed">{v.content}</td>
                  <td className="px-3 py-3 text-center text-gray-500 whitespace-nowrap">{v.author || '-'}</td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setDeleteTarget(v)} className="p-1 text-gray-300 hover:text-red-500" title="VOC 삭제"><Trash2 size={13} /></button>
                      <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-400 mt-3">* 고객명을 클릭하면 해당 고객 상세 화면으로 이동합니다. VOC 입력은 고객 상세 화면에서 가능합니다.</p>

      {/* VOC 삭제 확인 모달 */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-10 h-10 rounded-full bg-red-50 grid place-items-center shrink-0"><AlertTriangle size={20} className="text-red-500" /></span>
              <div>
                <h3 className="text-lg font-bold text-gray-800">VOC 삭제</h3>
                <p className="text-sm text-gray-500 mt-1"><b className="text-gray-700">{deleteTarget.customer_name || deleteTarget.customer_number}</b> · {deleteTarget.voc_date}</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-5">
              <p className="text-sm text-red-700 leading-relaxed">VOC 삭제 진행 시 <b>영구 삭제됩니다.</b> 삭제하시겠습니까?</p>
              <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">“{deleteTarget.content}”</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} disabled={deleting} className="flex-1 py-2.5 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50 text-sm disabled:opacity-50">취소</button>
              <button onClick={confirmDelete} disabled={deleting} className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold disabled:opacity-50">{deleting ? '삭제 중…' : '영구 삭제'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
