import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

/**
 * DOM 요소의 oklch 색상을 rgb로 변환하는 전처리
 * TailwindCSS v4가 oklch를 사용하는데, html2canvas가 이를 지원하지 않음
 */
function convertOklchToRgb(element: HTMLElement) {
  const colorProps = ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'outlineColor']

  const allElements = element.querySelectorAll<HTMLElement>('*')
  const elements = [element, ...Array.from(allElements)]

  elements.forEach((el) => {
    const computed = getComputedStyle(el)
    colorProps.forEach((prop) => {
      const value = computed.getPropertyValue(
        prop.replace(/([A-Z])/g, '-$1').toLowerCase()
      )
      if (value && value.includes('oklch')) {
        // 브라우저의 computedStyle은 이미 rgb로 변환되어 있어야 하지만
        // 만약 oklch가 남아있다면 투명으로 대체
        el.style.setProperty(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase(),
          'transparent'
        )
      }
    })
  })
}

/**
 * 웹 미리보기 화면을 그대로 캡처하여 PDF로 변환
 */
export async function generatePdfFromElement(element: HTMLElement): Promise<Blob> {
  // 1. 클론 생성 (원본 손상 방지)
  const clone = element.cloneNode(true) as HTMLElement
  clone.style.position = 'absolute'
  clone.style.left = '-9999px'
  clone.style.top = '0'
  clone.style.width = `${element.offsetWidth}px`
  clone.style.background = '#f9fafb'
  document.body.appendChild(clone)

  // 2. 스크롤 영역 펼치기
  clone.querySelectorAll<HTMLElement>('[class*="overflow"]').forEach((el) => {
    el.style.overflow = 'visible'
    el.style.maxHeight = 'none'
  })

  // 3. oklch 색상 변환
  convertOklchToRgb(clone)

  // 4. 모든 요소에 computedStyle 기반 인라인 스타일 적용
  const applyInlineStyles = (el: HTMLElement) => {
    const computed = getComputedStyle(el)
    const importantProps = [
      'color', 'background-color', 'border-color',
      'border-top-color', 'border-bottom-color', 'border-left-color', 'border-right-color',
    ]
    importantProps.forEach((prop) => {
      const val = computed.getPropertyValue(prop)
      if (val && val !== 'rgba(0, 0, 0, 0)' && !val.includes('oklch')) {
        el.style.setProperty(prop, val)
      }
    })
  }

  clone.querySelectorAll<HTMLElement>('*').forEach(applyInlineStyles)
  applyInlineStyles(clone)

  try {
    // 5. html2canvas로 캡처
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#f9fafb',
      width: clone.scrollWidth,
      height: clone.scrollHeight,
      onclone: (doc) => {
        // 클론된 문서에서 oklch 관련 CSS 변수 제거
        const style = doc.createElement('style')
        style.textContent = `
          * {
            --tw-ring-color: transparent !important;
            --tw-shadow-color: transparent !important;
          }
        `
        doc.head.appendChild(style)
      },
    })

    // 6. PDF 생성 (A4 페이지 분할)
    const pdfWidth = 210
    const pdfHeight = 297
    const margin = 8
    const contentWidth = pdfWidth - margin * 2
    const ratio = contentWidth / canvas.width
    const scaledHeight = canvas.height * ratio
    const pageContentHeight = pdfHeight - margin * 2

    const pdf = new jsPDF('p', 'mm', 'a4')
    let yOffset = 0
    let pageNum = 1

    while (yOffset < scaledHeight) {
      if (pageNum > 1) pdf.addPage()

      const sourceY = yOffset / ratio
      const sourceHeight = Math.min(pageContentHeight / ratio, canvas.height - sourceY)
      const destHeight = sourceHeight * ratio

      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = Math.ceil(sourceHeight)
      const ctx = tempCanvas.getContext('2d')!
      ctx.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight)

      const pageImg = tempCanvas.toDataURL('image/png')
      pdf.addImage(pageImg, 'PNG', margin, margin, contentWidth, destHeight)

      // 페이지 번호 + 워터마크
      pdf.setFontSize(7)
      pdf.setTextColor(180, 180, 180)
      pdf.text(`${pageNum}`, pdfWidth / 2, pdfHeight - 5, { align: 'center' })
      pdf.text('DB Branch - Confidential', margin, pdfHeight - 5)

      yOffset += pageContentHeight
      pageNum++
    }

    return pdf.output('blob')
  } finally {
    // 7. 클론 제거
    document.body.removeChild(clone)
  }
}

// 호환용
export async function generatePdfReport(): Promise<Blob> {
  throw new Error('generatePdfFromElement()을 사용하세요')
}
