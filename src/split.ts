export type BlockView = {
  lines: string[]
  tooManyLines: boolean
  extra: boolean
  missing?: boolean
}

export type SlideRow = {
  number: number
  urk: BlockView | null
  eng: BlockView | null
}

export type SplitModel = {
  rows: SlideRow[]
  canDownload: boolean
}

export type ExportSlide = {
  urk: string[] | null
  eng: string[] | null
}

export function parseBlocks(text: string): string[][] {
  const blocks: string[][] = []
  let current: string[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (line === '') {
      if (current.length > 0) {
        blocks.push(current)
        current = []
      }
      continue
    }
    current.push(line)
  }

  if (current.length > 0) blocks.push(current)
  return blocks
}

/** One English field per blank-line block, ready to pair with a Ukrainian slide. */
export function englishFieldsFromPaste(text: string): string[] {
  return parseBlocks(text).map((lines) => lines.join('\n'))
}

/** Pair pasted English with the slides that exist. Later blocks stay visible as extras. */
export function placeEnglishFields(
  slideCount: number,
  engText: string,
): { fields: string[]; extra: string[] } {
  const fields = englishFieldsFromPaste(engText)
  const count = Math.max(0, slideCount)
  return { fields: fields.slice(0, count), extra: fields.slice(count) }
}

export function splitLyrics(urkText: string, engText: string): SplitModel {
  const urkBlocks = parseBlocks(urkText)
  const engBlocks = parseBlocks(engText)

  if (urkBlocks.length === 0 && engBlocks.length === 0) {
    return { rows: [], canDownload: false }
  }

  const urkOmitted = urkBlocks.length === 0
  const engOmitted = engBlocks.length === 0
  const mismatch = !urkOmitted && !engOmitted && urkBlocks.length !== engBlocks.length
  const shared = Math.min(urkBlocks.length, engBlocks.length)
  const rowCount = Math.max(urkBlocks.length, engBlocks.length)
  const rows: SlideRow[] = []

  for (let index = 0; index < rowCount; index++) {
    const extra = mismatch && index >= shared
    rows.push({
      number: index + 1,
      urk: urkOmitted ? null : blockView(urkBlocks[index], extra),
      eng: engOmitted ? null : blockView(engBlocks[index], extra),
    })
  }

  const canDownload = rows.every((row) => !hasIssue(row.urk) && !hasIssue(row.eng))
  return { rows, canDownload }
}

/** Pairs each Ukrainian block with the English field at the same index. */
export function composeSlides(urkText: string, engFields: readonly string[]): SplitModel {
  const urkBlocks = parseBlocks(urkText)
  if (urkBlocks.length === 0) return { rows: [], canDownload: false }

  const engLineGroups = urkBlocks.map((_, index) => fieldLines(engFields[index] ?? ''))
  const anyEng = engLineGroups.some((lines) => lines.length > 0)
  const rows: SlideRow[] = urkBlocks.map((lines, index) => ({
    number: index + 1,
    urk: { lines, tooManyLines: lines.length > 2, extra: false },
    eng: anyEng ? engFieldView(engLineGroups[index] ?? []) : null,
  }))

  const canDownload = rows.every((row) => !hasIssue(row.urk) && !hasIssue(row.eng))
  return { rows, canDownload }
}

export function exportSlides(model: SplitModel): ExportSlide[] | null {
  if (!model.canDownload) return null
  return model.rows.map((row) => ({
    urk: row.urk ? row.urk.lines : null,
    eng: row.eng ? row.eng.lines : null,
  }))
}

function blockView(lines: string[] | undefined, extra: boolean): BlockView | null {
  if (!lines) return null
  return { lines, tooManyLines: lines.length > 2, extra }
}

function fieldLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '')
}

function engFieldView(lines: string[]): BlockView {
  return {
    lines,
    tooManyLines: lines.length > 2,
    extra: false,
    missing: lines.length === 0,
  }
}

export function hasIssue(block: BlockView | null): boolean {
  return block != null && (block.tooManyLines || block.extra || block.missing === true)
}
