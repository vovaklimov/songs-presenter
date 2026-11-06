import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'
import { buildLyricsPptx } from './pptx'
import { loadSampleUrk, referenceSampleBlocks } from './sample-urk'
import { exportSlides, splitLyrics, type ExportSlide } from './split'

type LyricShape = {
  name: string
  paragraphs: string[]
}

describe('buildLyricsPptx', () => {
  it('builds the sample as Ukrainian-only slides named URK', async () => {
    const sample = loadSampleUrk()
    const expected = referenceSampleBlocks(sample)
    const slides = exportSlides(splitLyrics(sample, ''))
    expect(slides).toEqual(expected.map((lines) => ({ urk: lines, eng: null })))

    if (!slides) throw new Error('Sample produced no slides')
    const bytes = await buildLyricsPptx(slides)
    const deck = await readDeck(bytes)

    expect(deck.slides).toHaveLength(expected.length)
    expect(deck.slideSize.cx / deck.slideSize.cy).toBeCloseTo(16 / 9, 2)
    expect(deck.slides.every((shapes) => shapes.length === 1 && shapes[0]?.name === 'URK')).toBe(true)

    deck.slides.forEach((shapes, index) => {
      expect(shapes[0]?.paragraphs).toEqual(expected[index])
      expect(shapes.some((shape) => shape.name === 'ENG')).toBe(false)
    })
    expect(expected.flat().some((line) => line.includes('ятmий'))).toBe(true)
  })

  it('writes both languages as named shapes and keeps each line as its own paragraph', async () => {
    const slides: ExportSlide[] = [
      { urk: ['a  b'], eng: ['Tom & Jerry', 'x < y > z'] },
      { urk: ['другий'], eng: ['second'] },
    ]
    const deck = await readDeck(await buildLyricsPptx(slides))

    expect(deck.slides).toEqual([
      [
        { name: 'URK', paragraphs: ['a  b'] },
        { name: 'ENG', paragraphs: ['Tom & Jerry', 'x < y > z'] },
      ],
      [
        { name: 'URK', paragraphs: ['другий'] },
        { name: 'ENG', paragraphs: ['second'] },
      ],
    ])
  })

  it('omits the URK shape when only English was pasted', async () => {
    const deck = await readDeck(await buildLyricsPptx([{ urk: null, eng: ['only english'] }]))
    expect(deck.slides).toEqual([[{ name: 'ENG', paragraphs: ['only english'] }]])
  })

  it('refuses an empty deck, a third line, a line break, or mixed languages', async () => {
    await expect(buildLyricsPptx([])).rejects.toThrow('No slides')
    await expect(buildLyricsPptx([{ urk: ['a', 'b', 'c'], eng: null }])).rejects.toThrow('1 or 2 lines')
    await expect(buildLyricsPptx([{ urk: ['a\nb'], eng: null }])).rejects.toThrow('line break')
    await expect(
      buildLyricsPptx([
        { urk: ['a'], eng: ['b'] },
        { urk: ['c'], eng: null },
      ]),
    ).rejects.toThrow('same languages')
  })
})

async function readDeck(bytes: Uint8Array): Promise<{ slides: LyricShape[][]; slideSize: { cx: number; cy: number } }> {
  const zip = await JSZip.loadAsync(bytes)
  const presentation = await zip.file('ppt/presentation.xml')?.async('string')
  if (!presentation) throw new Error('Missing presentation.xml')

  const cx = Number(presentation.match(/<p:sldSz\b[^>]*\bcx="(\d+)"/)?.[1])
  const cy = Number(presentation.match(/<p:sldSz\b[^>]*\bcy="(\d+)"/)?.[1])
  const paths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => Number(a.match(/slide(\d+)/)?.[1]) - Number(b.match(/slide(\d+)/)?.[1]))

  const slides: LyricShape[][] = []
  for (const path of paths) {
    const xml = await zip.file(path)?.async('string')
    if (!xml) throw new Error(`Missing ${path}`)
    expect(xml).toContain('sz="4000"')
    expect(xml).toContain('typeface="Arial"')
    slides.push(lyricShapes(xml))
  }

  return { slides, slideSize: { cx, cy } }
}

function lyricShapes(xml: string): LyricShape[] {
  const shapes: LyricShape[] = []
  for (const match of xml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/g)) {
    const shape = match[0]
    const name = shape.match(/<p:cNvPr\b[^>]*\bname="([^"]*)"/)?.[1]
    if (!name) continue
    const body = shape.match(/<p:txBody>([\s\S]*?)<\/p:txBody>/)?.[1] ?? ''
    const paragraphs: string[] = []
    for (const paragraph of body.matchAll(/<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g)) {
      const inner = paragraph[1] ?? ''
      const text = [...inner.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)]
        .map((part) => decodeXml(part[1] ?? ''))
        .join('')
      paragraphs.push(text)
    }
    shapes.push({ name, paragraphs })
  }
  return shapes
}

function decodeXml(text: string): string {
  return text.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&')
}
