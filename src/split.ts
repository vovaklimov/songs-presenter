export type BlockView = {
  lines: string[]
  tooManyLines: boolean
  extra: boolean
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

export function hasIssue(block: BlockView | null): boolean {
  return block != null && (block.tooManyLines || block.extra)
}
