import { describe, expect, it } from 'vitest'
import { loadSampleUrk, referenceSampleBlocks } from './sample-urk'
import {
  composeSlides,
  englishFieldsFromPaste,
  exportSlides,
  parseBlocks,
  placeEnglishFields,
  splitLyrics,
} from './split'

describe('parseBlocks', () => {
  it('trims lines, collapses blank separators, and drops empty edges', () => {
    expect(parseBlocks(' \n  alpha  \n beta \n\n\n\n gamma \n ')).toEqual([
      ['alpha', 'beta'],
      ['gamma'],
    ])
  })

  it('keeps internal spaces and chord brackets', () => {
    expect(parseBlocks('a  b\n[Am] hello')).toEqual([['a  b', '[Am] hello']])
  })

  it('accepts CRLF line endings', () => {
    expect(parseBlocks('a\r\nb\r\n\r\nc')).toEqual([
      ['a', 'b'],
      ['c'],
    ])
  })
})

describe('splitLyrics', () => {
  const sample = loadSampleUrk()

  it('turns the sample paste into one row per block', () => {
    const expected = referenceSampleBlocks(sample)
    expect(expected).toHaveLength(17)
    expect(expected.flat().some((line) => line.includes('ятmий'))).toBe(true)

    const model = splitLyrics(sample, '')
    expect(parseBlocks(sample)).toEqual(expected)
    expect(model.canDownload).toBe(true)
    expect(model.rows).toHaveLength(17)
    expect(model.rows.every((row) => row.eng === null && row.urk?.lines.length === 2)).toBe(true)
    expect(model.rows.every((row) => row.urk?.tooManyLines === false && row.urk.extra === false)).toBe(true)
    expect(exportSlides(model)).toEqual(expected.map((lines) => ({ urk: lines, eng: null })))
  })

  it('pairs block i of URK with block i of ENG', () => {
    const model = splitLyrics('urk1\nurk2\n\nurk3', 'eng1\n\neng2')
    expect(model.canDownload).toBe(true)
    expect(model.rows[0]).toMatchObject({
      number: 1,
      urk: { lines: ['urk1', 'urk2'], tooManyLines: false, extra: false },
      eng: { lines: ['eng1'], tooManyLines: false, extra: false },
    })
    expect(model.rows[1]).toMatchObject({
      number: 2,
      urk: { lines: ['urk3'] },
      eng: { lines: ['eng2'] },
    })
  })

  it('treats a missing language as omitted, including a whitespace-only paste', () => {
    const model = splitLyrics('a\n\nb', ' \n\n ')
    expect(model.canDownload).toBe(true)
    expect(model.rows).toHaveLength(2)
    expect(model.rows.every((row) => row.eng === null && row.urk?.extra === false)).toBe(true)
    expect(exportSlides(model)).toEqual([
      { urk: ['a'], eng: null },
      { urk: ['b'], eng: null },
    ])
  })

  it('leaves both pastes empty with nothing to download', () => {
    expect(splitLyrics('', '')).toEqual({ rows: [], canDownload: false })
    expect(splitLyrics(' \n ', '\n\n')).toEqual({ rows: [], canDownload: false })
  })

  it('highlights a block with 3 or more lines and does not split it', () => {
    const model = splitLyrics('a\nb\nc\nd', 'e\nf')
    expect(model.canDownload).toBe(false)
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]?.urk).toEqual({
      lines: ['a', 'b', 'c', 'd'],
      tooManyLines: true,
      extra: false,
    })
    expect(model.rows[0]?.eng).toEqual({
      lines: ['e', 'f'],
      tooManyLines: false,
      extra: false,
    })
    expect(exportSlides(model)).toBeNull()
  })

  it('highlights only the extra blocks when the counts differ', () => {
    const model = splitLyrics('a\n\nb', 'c\n\nd\n\ne')
    expect(model.canDownload).toBe(false)
    expect(model.rows.map((row) => row.urk?.extra ?? null)).toEqual([false, false, null])
    expect(model.rows.map((row) => row.eng?.extra ?? null)).toEqual([false, false, true])
    expect(model.rows[2]?.urk).toBeNull()
    expect(model.rows[2]?.eng?.lines).toEqual(['e'])
    expect(model.rows[0]?.urk?.tooManyLines).toBe(false)
    expect(exportSlides(model)).toBeNull()
  })

  it('marks a block that is both extra and too long', () => {
    const model = splitLyrics('a', 'b\n\nc\nd\ne')
    expect(model.rows[1]?.eng).toEqual({
      lines: ['c', 'd', 'e'],
      tooManyLines: true,
      extra: true,
    })
    expect(model.canDownload).toBe(false)
  })

  it('accepts one line on a slide', () => {
    const model = splitLyrics('only', 'solo')
    expect(model.canDownload).toBe(true)
    expect(exportSlides(model)).toEqual([{ urk: ['only'], eng: ['solo'] }])
  })
})

describe('composeSlides', () => {
  it('omits English when every field is blank or whitespace', () => {
    const model = composeSlides('a\n\nb', ['', '  \n\t'])
    expect(model.canDownload).toBe(true)
    expect(model.rows.every((row) => row.eng === null)).toBe(true)
    expect(exportSlides(model)).toEqual([
      { urk: ['a'], eng: null },
      { urk: ['b'], eng: null },
    ])
  })

  it('pairs each Ukrainian block with the English field at that index', () => {
    const model = composeSlides('urk1\nurk2\n\nurk3', ['eng1', ' eng2 \n eng3 '])
    expect(model.canDownload).toBe(true)
    expect(exportSlides(model)).toEqual([
      { urk: ['urk1', 'urk2'], eng: ['eng1'] },
      { urk: ['urk3'], eng: ['eng2', 'eng3'] },
    ])
  })

  it('does not turn a blank line inside an English field into another slide', () => {
    const model = composeSlides('a', ['hello\n\nworld'])
    expect(model.rows).toHaveLength(1)
    expect(model.canDownload).toBe(true)
    expect(model.rows[0]?.eng?.lines).toEqual(['hello', 'world'])
  })

  it('marks an empty field as missing once any slide has English', () => {
    const model = composeSlides('a\n\nb', ['hello', ''])
    expect(model.canDownload).toBe(false)
    expect(model.rows[0]?.eng).toEqual({
      lines: ['hello'],
      tooManyLines: false,
      extra: false,
      missing: false,
    })
    expect(model.rows[1]?.eng).toEqual({
      lines: [],
      tooManyLines: false,
      extra: false,
      missing: true,
    })
    expect(exportSlides(model)).toBeNull()
  })

  it('marks an English field with 3 or more lines and does not split it', () => {
    const model = composeSlides('a\n\nb', ['one\ntwo\nthree', 'four'])
    expect(model.canDownload).toBe(false)
    expect(model.rows[0]?.eng).toMatchObject({
      lines: ['one', 'two', 'three'],
      tooManyLines: true,
      missing: false,
    })
    expect(exportSlides(model)).toBeNull()
  })

  it('keeps a Ukrainian block with 3 or more lines as one slide', () => {
    const model = composeSlides('a\nb\nc', ['x'])
    expect(model.canDownload).toBe(false)
    expect(model.rows).toHaveLength(1)
    expect(model.rows[0]?.urk).toEqual({
      lines: ['a', 'b', 'c'],
      tooManyLines: true,
      extra: false,
    })
    expect(model.rows[0]?.eng?.lines).toEqual(['x'])
  })

  it('ignores English fields past the Ukrainian block count', () => {
    const model = composeSlides('a', ['one', 'two'])
    expect(model.rows).toHaveLength(1)
    expect(model.canDownload).toBe(true)
    expect(exportSlides(model)).toEqual([{ urk: ['a'], eng: ['one'] }])
  })

  it('returns nothing when Ukrainian is empty', () => {
    expect(composeSlides(' \n ', ['hello'])).toEqual({ rows: [], canDownload: false })
  })
})

describe('englishFieldsFromPaste', () => {
  it('joins each blank-line block into one field', () => {
    expect(englishFieldsFromPaste('eng1\n\neng2\neng3')).toEqual(['eng1', 'eng2\neng3'])
  })

  it('returns nothing for a whitespace-only paste', () => {
    expect(englishFieldsFromPaste('')).toEqual([])
    expect(englishFieldsFromPaste(' \n\n ')).toEqual([])
  })
})

describe('placeEnglishFields', () => {
  it('fills as many slides as it can and keeps the rest', () => {
    expect(placeEnglishFields(2, 'a\n\nb\n\nc')).toEqual({
      fields: ['a', 'b'],
      extra: ['c'],
    })
  })

  it('returns a short paste without inventing slides', () => {
    expect(placeEnglishFields(3, 'a\nb\n\nc')).toEqual({
      fields: ['a\nb', 'c'],
      extra: [],
    })
  })

  it('treats every block as extra when there are no slides yet', () => {
    expect(placeEnglishFields(0, 'a\n\nb')).toEqual({ fields: [], extra: ['a', 'b'] })
  })

  it('returns nothing for a whitespace-only paste', () => {
    expect(placeEnglishFields(2, ' \n ')).toEqual({ fields: [], extra: [] })
  })
})
