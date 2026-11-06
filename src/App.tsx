import { useEffect, useState } from 'react'
import { Button, Input, Label, TextArea, TextField } from 'react-aria-components'
import { pptxFileName } from './file-name'
import {
  composeSlides,
  englishFieldsFromPaste,
  exportSlides,
  hasIssue,
  parseBlocks,
  placeEnglishFields,
  type BlockView,
  type SlideRow,
} from './split'

const storageKey = {
  urk: 'lyrics-urk',
  eng: 'lyrics-eng',
  engSlides: 'lyrics-eng-slides',
  fileName: 'lyrics-file-name',
} as const

export function App() {
  const [urk, setUrk] = useState(() => stored(storageKey.urk))
  const [engPaste, setEngPaste] = useState('')
  const [engBySlide, setEngBySlide] = useState(loadEngSlides)
  const [fileName, setFileName] = useState(() => stored(storageKey.fileName))
  const [building, setBuilding] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const slideCount = parseBlocks(urk).length
  const pasteActive = engPaste.trim() !== ''
  const placedEng = placeEnglishFields(slideCount, engPaste)
  const extraEng = pasteActive ? placedEng.extra : []
  const pasteCount = pasteActive ? englishFieldsFromPaste(engPaste).length : 0
  const engFields = Array.from({ length: slideCount }, (_, index) => engBySlide[index] ?? '')
  const model = composeSlides(urk, engFields)
  const notes = [
    ...issueNotes(model.rows),
    ...extraEng.map((_, index) => ({
      slideId: `slide-${slideCount + index + 1}`,
      label: `ENG ${slideCount + index + 1}, no match`,
    })),
  ]
  const countsDiffer = pasteActive && pasteCount !== slideCount
  const showCountNote = countsDiffer && (extraEng.length > 0 || !model.canDownload)
  const downloadName = pptxFileName(fileName)
  const storedEng = JSON.stringify(engFields)
  const canDownload = model.canDownload && extraEng.length === 0
  const visibleSlides = model.rows.length + extraEng.length

  useEffect(() => {
    setEngBySlide((prev) => (prev.length > slideCount ? prev.slice(0, slideCount) : prev))
  }, [slideCount])

  useEffect(() => {
    try {
      localStorage.setItem(storageKey.urk, urk)
      localStorage.setItem(storageKey.engSlides, storedEng)
      localStorage.setItem(storageKey.fileName, fileName)
    } catch {
      // Private browsing can reject storage. The paste still works for this visit.
    }
  }, [urk, storedEng, fileName])

  function setEngAt(index: number, value: string) {
    setEngBySlide((prev) => {
      const next = Array.from({ length: slideCount }, (_, field) => prev[field] ?? '')
      next[index] = value
      return next
    })
  }

  function onUrkChange(value: string) {
    const nextCount = parseBlocks(value).length
    setUrk(value)
    if (engPaste.trim() === '' || nextCount === slideCount) return
    const pasted = placeEnglishFields(nextCount, engPaste).fields
    setEngBySlide((prev) =>
      Array.from({ length: nextCount }, (_, index) =>
        index < slideCount ? (prev[index] ?? '') : (pasted[index] ?? ''),
      ),
    )
  }

  function onEngPaste(value: string) {
    setEngPaste(value)
    if (value.trim() === '') return
    setEngBySlide(placeEnglishFields(slideCount, value).fields)
  }

  async function onDownload() {
    if (extraEng.length > 0) return
    const slides = exportSlides(model)
    if (!slides) return
    setBuilding(true)
    setDownloadError(null)
    try {
      const { buildLyricsPptx } = await import('./pptx')
      const bytes = await buildLyricsPptx(slides)
      savePptx(bytes, downloadName)
    } catch {
      setDownloadError(`Could not build ${downloadName}.`)
    } finally {
      setBuilding(false)
    }
  }

  return (
    <div className="min-h-screen bg-stone-100 text-neutral-900">
      <header className="sticky top-0 z-10 border-b border-stone-200 bg-stone-100">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight">Lyrics</h1>
          <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
            <TextField value={fileName} onChange={setFileName} className="min-w-0 sm:w-52">
              <Label className="sr-only">File name</Label>
              <Input
                placeholder="lyrics"
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/15"
              />
            </TextField>
            <Button
              isDisabled={!canDownload || building}
              onPress={() => {
                void onDownload()
              }}
              className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:hover:bg-neutral-300"
            >
              Download
            </Button>
          </div>
        </div>
        {notes.length > 0 || downloadError || showCountNote ? (
          <div className="mx-auto flex max-w-5xl flex-wrap gap-x-3 gap-y-1 px-4 pb-3 sm:px-6" role="status">
            {showCountNote ? (
              <p className="text-sm text-red-700">
                English has {slideCountPhrase(pasteCount)}, Ukrainian has {slideCountPhrase(slideCount)}.
              </p>
            ) : null}
            {notes.map((note) => (
              <button
                key={note.label}
                type="button"
                className="text-left text-sm text-red-700 underline-offset-2 hover:underline"
                onClick={() => document.getElementById(note.slideId)?.scrollIntoView({ block: 'center' })}
              >
                {note.label}
              </button>
            ))}
            {downloadError ? <p className="text-sm text-red-700">{downloadError}</p> : null}
          </div>
        ) : null}
      </header>

      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6">
        <div className="flex flex-col gap-4">
          <p className="max-w-2xl text-sm leading-5 text-neutral-600">
            Paste Ukrainian alone, or paste English as well. A blank line starts a new slide, and English fills those
            slides in order. Each slide is one or two lines. English is optional only if every slide is left blank.
            Import the file into ProPresenter with objects and text.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <PasteField label="URK" lang="uk" value={urk} onChange={onUrkChange} count={slideCount} />
            <PasteField
              label="ENG"
              lang="en"
              value={engPaste}
              onChange={onEngPaste}
              count={pasteCount}
            />
          </div>
        </div>

        <section aria-label="Slides" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Slides</h2>
            {visibleSlides > 0 ? (
              <p className="text-sm text-neutral-500">
                {visibleSlides} {visibleSlides === 1 ? 'slide' : 'slides'}
              </p>
            ) : null}
          </div>

          {visibleSlides === 0 ? (
            <p className="text-sm text-neutral-500">Paste Ukrainian to start.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {model.rows.map((row, index) => (
                <li
                  key={row.number}
                  id={`slide-${row.number}`}
                  className="scroll-mt-28 overflow-hidden rounded-xl border border-stone-200 bg-white"
                >
                  <div className="grid sm:grid-cols-2">
                    <UrkHalf row={row} />
                    <EngHalf
                      row={row}
                      value={engFields[index] ?? ''}
                      onChange={(value) => setEngAt(index, value)}
                    />
                  </div>
                </li>
              ))}
              {extraEng.map((text, index) => (
                <UnmatchedEng key={`extra-${index}`} number={slideCount + index + 1} text={text} />
              ))}
            </ol>
          )}
        </section>
      </main>
    </div>
  )
}

function PasteField({
  label,
  lang,
  value,
  count,
  onChange,
}: {
  label: string
  lang: 'uk' | 'en'
  value: string
  count: number
  onChange: (value: string) => void
}) {
  return (
    <TextField value={value} onChange={onChange} className="flex min-w-0 flex-col gap-2">
      <Label className="text-xs font-semibold tracking-wide text-neutral-500">
        {count > 0 ? `${label} · ${count}` : label}
      </Label>
      <TextArea
        lang={lang}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        className="min-h-48 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base leading-normal outline-none focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/15"
      />
    </TextField>
  )
}

function UrkHalf({ row }: { row: SlideRow }) {
  const block = row.urk
  const issue = hasIssue(block)
  return (
    <div
      aria-invalid={issue || undefined}
      className={`min-w-0 border-b px-4 py-3 sm:border-r sm:border-b-0 ${issue ? 'border-red-200 bg-red-50' : 'border-stone-200'}`}
    >
      <div className="flex h-6 items-center gap-3">
        <span className="text-xs font-semibold tracking-wide text-neutral-500">URK</span>
        <span className="ml-auto text-xs text-neutral-400 tabular-nums">{row.number}</span>
      </div>
      {block ? <p className="mt-1 text-base leading-snug whitespace-pre-wrap">{block.lines.join('\n')}</p> : null}
      {block?.tooManyLines ? <p className="mt-2 text-xs font-medium text-red-700">Use 1 or 2 lines</p> : null}
    </div>
  )
}

function EngHalf({
  row,
  value,
  onChange,
}: {
  row: SlideRow
  value: string
  onChange: (value: string) => void
}) {
  const block = row.eng
  const issue = hasIssue(block)
  return (
    <TextField
      value={value}
      onChange={onChange}
      isInvalid={issue}
      className={`flex min-w-0 flex-col px-4 py-3 ${issue ? 'bg-red-50' : ''}`}
    >
      <Label className="flex h-6 items-center text-xs font-semibold tracking-wide text-neutral-500">
        ENG
        <span className="sr-only"> for slide {row.number}</span>
      </Label>
      <TextArea
        lang="en"
        rows={2}
        placeholder="English"
        className="mt-1 w-full resize-none border-0 bg-transparent p-0 text-base leading-snug outline-none placeholder:text-neutral-400 focus-visible:ring-2 focus-visible:ring-neutral-900/15"
      />
      {block?.missing ? <p className="mt-2 text-xs font-medium text-red-700">Add English</p> : null}
      {block?.tooManyLines ? <p className="mt-2 text-xs font-medium text-red-700">Use 1 or 2 lines</p> : null}
    </TextField>
  )
}

function UnmatchedEng({ number, text }: { number: number; text: string }) {
  const tooManyLines = text.split('\n').length > 2
  return (
    <li id={`slide-${number}`} className="scroll-mt-28 overflow-hidden rounded-xl border border-red-200 bg-white">
      <div className="grid sm:grid-cols-2">
        <div className="min-w-0 border-b border-red-200 bg-red-50 px-4 py-3 sm:border-r sm:border-b-0">
          <div className="flex h-6 items-center gap-3">
            <span className="text-xs font-semibold tracking-wide text-neutral-500">URK</span>
            <span className="ml-auto text-xs text-neutral-400 tabular-nums">{number}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-red-700">No matching slide</p>
        </div>
        <div className="min-w-0 bg-red-50 px-4 py-3">
          <div className="flex h-6 items-center text-xs font-semibold tracking-wide text-neutral-500">ENG</div>
          <p className="mt-1 text-base leading-snug whitespace-pre-wrap">{text}</p>
          {tooManyLines ? <p className="mt-2 text-xs font-medium text-red-700">Use 1 or 2 lines</p> : null}
        </div>
      </div>
    </li>
  )
}

function issueNotes(rows: SlideRow[]): { slideId: string; label: string }[] {
  const notes: { slideId: string; label: string }[] = []
  for (const row of rows) {
    pushNote(notes, 'URK', row.number, row.urk)
    pushNote(notes, 'ENG', row.number, row.eng)
  }
  return notes
}

function pushNote(
  notes: { slideId: string; label: string }[],
  lang: 'URK' | 'ENG',
  number: number,
  block: BlockView | null,
) {
  if (!block || !hasIssue(block)) return
  const details = [
    block.tooManyLines ? `${block.lines.length} lines` : null,
    block.extra ? 'no match' : null,
    block.missing ? 'add English' : null,
  ].filter((detail) => detail != null)
  notes.push({ slideId: `slide-${number}`, label: `${lang} ${number}, ${details.join(', ')}` })
}

function slideCountPhrase(count: number): string {
  return `${count} ${count === 1 ? 'slide' : 'slides'}`
}

function stored(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function loadEngSlides(): string[] {
  try {
    const raw = localStorage.getItem(storageKey.engSlides)
    if (raw != null) return parseStoredSlides(raw) ?? []
    const legacy = localStorage.getItem(storageKey.eng)
    if (!legacy) return []
    return parseBlocks(legacy).map((lines) => lines.join('\n'))
  } catch {
    return []
  }
}

function parseStoredSlides(raw: string): string[] | null {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) return null
  return parsed
}

function savePptx(bytes: Uint8Array, fileName: string) {
  const copy = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(copy).set(bytes)
  const blob = new Blob([copy], {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
