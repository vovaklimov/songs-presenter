import JSZip from 'jszip'
import PptxGenJS from 'pptxgenjs'
import type { ExportSlide } from './split'

type BoxName = 'URK' | 'ENG'

type Box = {
  name: BoxName
  lines: readonly string[]
}

const SLIDE_WIDTH = 13.333
const SLIDE_HEIGHT = 7.5

export async function buildLyricsPptx(slides: readonly ExportSlide[]): Promise<Uint8Array> {
  assertExportable(slides)

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'LYRIC_16x9', width: SLIDE_WIDTH, height: SLIDE_HEIGHT })
  pptx.layout = 'LYRIC_16x9'
  pptx.title = ''

  for (const slide of slides) {
    const page = pptx.addSlide()
    const boxes = boxesOf(slide)
    boxes.forEach((box, index) => {
      page.addText(box.lines.join('\n'), {
        ...geometry(boxes.length, index),
        objectName: box.name,
      })
    })
  }

  const raw = await pptx.write({ outputType: 'uint8array' })
  if (!(raw instanceof Uint8Array)) throw new Error('Expected PPTX bytes')
  return normalizeLyricXml(raw, slides)
}

function assertExportable(slides: readonly ExportSlide[]): void {
  if (slides.length === 0) throw new Error('No slides to generate')

  const languages = languageKey(slides[0])
  if (languages === '') throw new Error('Slide has no lyrics')

  for (const slide of slides) {
    if (languageKey(slide) !== languages) {
      throw new Error('Every slide must include the same languages')
    }
    for (const lines of [slide.urk, slide.eng]) {
      if (lines == null) continue
      if (lines.length < 1 || lines.length > 2) {
        throw new Error('Each box must contain 1 or 2 lines')
      }
      if (lines.some((line) => line.includes('\n') || line.includes('\r'))) {
        throw new Error('A lyric line cannot contain a line break')
      }
    }
  }
}

function languageKey(slide: ExportSlide | undefined): string {
  if (!slide) return ''
  return `${slide.urk ? 'URK' : ''}${slide.eng ? 'ENG' : ''}`
}

function boxesOf(slide: ExportSlide): Box[] {
  const boxes: Box[] = []
  if (slide.urk) boxes.push({ name: 'URK', lines: slide.urk })
  if (slide.eng) boxes.push({ name: 'ENG', lines: slide.eng })
  return boxes
}

function geometry(count: number, index: number): { x: number; y: number; w: number; h: number } {
  const margin = 0.5
  const gap = count > 1 ? 0.25 : 0
  const height = (SLIDE_HEIGHT - margin * 2 - gap * (count - 1)) / count
  return {
    x: margin,
    y: margin + index * (height + gap),
    w: SLIDE_WIDTH - margin * 2,
    h: height,
  }
}

async function normalizeLyricXml(bytes: Uint8Array, slides: readonly ExportSlide[]): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes)
  const paths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b))

  if (paths.length !== slides.length) {
    throw new Error(`Expected ${slides.length} slides, found ${paths.length}`)
  }

  for (let index = 0; index < slides.length; index++) {
    const path = paths[index]
    const slide = slides[index]
    if (!path || !slide) throw new Error(`Missing slide ${index + 1}`)
    const file = zip.file(path)
    if (!file) throw new Error(`Missing ${path}`)
    const xml = await file.async('string')
    zip.file(path, rewriteSlide(xml, boxesOf(slide)))
  }

  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
}

function slideNumber(path: string): number {
  return Number(path.match(/slide(\d+)\.xml$/)?.[1] ?? 0)
}

function rewriteSlide(xml: string, boxes: readonly Box[]): string {
  let seen = 0
  const updated = xml.replace(/<p:sp\b[\s\S]*?<\/p:sp>/g, (shape) => {
    const box = boxes[seen]
    seen += 1
    if (!box) return shape
    return withParagraphs(withName(shape, box.name), box.lines)
  })

  if (seen !== boxes.length) {
    throw new Error(`Slide has ${seen} text boxes, expected ${boxes.length}`)
  }
  return updated
}

function withName(shapeXml: string, name: BoxName): string {
  if (!/<p:cNvPr\b[^>]*\bname="[^"]*"/.test(shapeXml)) {
    throw new Error(`Could not set shape name to ${name}`)
  }
  return shapeXml.replace(/(<p:cNvPr\b[^>]*\bname=")[^"]*(")/, `$1${name}$2`)
}

function withParagraphs(shapeXml: string, lines: readonly string[]): string {
  const paragraphs = lines.map(paragraphXml).join('')
  const txBody = `<p:txBody><a:bodyPr wrap="square" lIns="91440" tIns="45720" rIns="91440" bIns="45720" anchor="ctr"/><a:lstStyle/>${paragraphs}</p:txBody>`
  if (!/<p:txBody>[\s\S]*?<\/p:txBody>/.test(shapeXml)) {
    throw new Error('Text box has no body')
  }
  return shapeXml.replace(/<p:txBody>[\s\S]*?<\/p:txBody>/, txBody)
}

function paragraphXml(line: string): string {
  return `<a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="en-US" sz="4000" dirty="0"><a:solidFill><a:srgbClr val="1A1A1A"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t xml:space="preserve">${escapeXml(line)}</a:t></a:r></a:p>`
}

function escapeXml(text: string): string {
  return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}
