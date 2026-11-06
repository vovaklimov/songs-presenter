import { useEffect, useState } from 'react'
import { Button, Input, Label, TextArea, TextField } from 'react-aria-components'
import { pptxFileName } from './file-name'
import { exportSlides, hasIssue, splitLyrics, type BlockView, type SlideRow } from './split'

const previewColumns = 'sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)]'
const storageKey = {
  urk: 'lyrics-urk',
  eng: 'lyrics-eng',
  fileName: 'lyrics-file-name',
} as const

export function App() {
  const [urk, setUrk] = useState(() => stored(storageKey.urk))
  const [eng, setEng] = useState(() => stored(storageKey.eng))
  const [fileName, setFileName] = useState(() => stored(storageKey.fileName))
  const [building, setBuilding] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const model = splitLyrics(urk, eng)
  const notes = issueNotes(model.rows)
  const downloadName = pptxFileName(fileName)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey.urk, urk)
      localStorage.setItem(storageKey.eng, eng)
      localStorage.setItem(storageKey.fileName, fileName)
    } catch {
      // Private browsing can reject storage. The paste still works for this visit.
    }
  }, [urk, eng, fileName])

  async function onDownload() {
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
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
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
              isDisabled={!model.canDownload || building}
              onPress={() => {
                void onDownload()
              }}
              className="shrink-0 rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white outline-none hover:bg-neutral-800 focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-100 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 disabled:hover:bg-neutral-300"
            >
              Download
            </Button>
          </div>
        </div>
        {notes.length > 0 || downloadError ? (
          <div className="mx-auto flex max-w-6xl flex-wrap gap-x-3 gap-y-1 px-4 pb-3 sm:px-6" role="status">
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

      <main className="mx-auto grid max-w-6xl gap-8 px-4 py-6 sm:px-6 xl:grid-cols-2 xl:items-start">
        <div className="flex flex-col gap-4">
          <p className="text-sm leading-5 text-neutral-600">
            Paste Ukrainian, English, or both. A blank line separates slides. Each slide is one or two lines. Import
            the file into ProPresenter with objects and text.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1">
            <PasteField label="URK" lang="uk" value={urk} onChange={setUrk} count={blockCount(model.rows, 'urk')} />
            <PasteField label="ENG" lang="en" value={eng} onChange={setEng} count={blockCount(model.rows, 'eng')} />
          </div>
        </div>

        <section
          aria-label="Preview"
          className="flex flex-col gap-3 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-semibold tracking-tight">Preview</h2>
            {model.rows.length > 0 ? (
              <p className="text-sm text-neutral-500">
                {model.rows.length} {model.rows.length === 1 ? 'slide' : 'slides'}
              </p>
            ) : null}
          </div>

          {model.rows.length === 0 ? (
            <p className="text-sm text-neutral-500">Paste a song to preview slides.</p>
          ) : (
            <>
              <div
                className={`hidden ${previewColumns} gap-3 px-1 text-xs font-semibold tracking-wide text-neutral-500 sm:grid`}
              >
                <span />
                <span>URK</span>
                <span>ENG</span>
              </div>
              <ol className="flex flex-col gap-2">
                {model.rows.map((row) => (
                  <li
                    key={row.number}
                    id={`slide-${row.number}`}
                    className={`grid scroll-mt-28 grid-cols-1 gap-2 ${previewColumns} sm:gap-3`}
                  >
                    <span aria-hidden="true" className="pt-2 text-sm text-neutral-500 tabular-nums sm:text-center">
                      {row.number}
                    </span>
                    <LyricCell label="URK" block={row.urk} />
                    <LyricCell label="ENG" block={row.eng} />
                  </li>
                ))}
              </ol>
            </>
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
  lang: string
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
        className="min-h-72 w-full resize-y rounded-lg border border-neutral-300 bg-white px-3 py-2 text-base leading-normal outline-none focus-visible:border-neutral-900 focus-visible:ring-2 focus-visible:ring-neutral-900/15"
      />
    </TextField>
  )
}

function LyricCell({ label, block }: { label: string; block: BlockView | null }) {
  const issue = hasIssue(block)
  return (
    <div
      aria-invalid={issue || undefined}
      className={`min-h-12 rounded-md px-3 py-2 ${issue ? 'bg-red-50 ring-1 ring-red-300 ring-inset' : 'bg-white'}`}
    >
      <span className="mb-1 block text-xs font-semibold tracking-wide text-neutral-500 sm:sr-only">
        {label}
      </span>
      {block ? (
        <>
          <p className="text-base leading-snug whitespace-pre-wrap">{block.lines.join('\n')}</p>
          {block.tooManyLines ? <p className="mt-2 text-xs font-medium text-red-700">Use 1 or 2 lines</p> : null}
          {block.extra ? <p className="mt-2 text-xs font-medium text-red-700">No matching slide</p> : null}
        </>
      ) : null}
    </div>
  )
}

function blockCount(rows: SlideRow[], language: 'urk' | 'eng'): number {
  return rows.reduce((count, row) => count + (row[language] ? 1 : 0), 0)
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
  const details = [block.tooManyLines ? `${block.lines.length} lines` : null, block.extra ? 'no match' : null].filter(
    (detail) => detail != null,
  )
  notes.push({ slideId: `slide-${number}`, label: `${lang} ${number}, ${details.join(', ')}` })
}

function stored(key: string): string {
  try {
    return localStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
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
