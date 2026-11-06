import { describe, expect, it } from 'vitest'
import { pptxFileName } from './file-name'

describe('pptxFileName', () => {
  it('uses lyrics.pptx when the name is empty', () => {
    expect(pptxFileName('')).toBe('lyrics.pptx')
    expect(pptxFileName('   ')).toBe('lyrics.pptx')
    expect(pptxFileName('.pptx')).toBe('lyrics.pptx')
  })

  it('appends the extension and keeps spaces', () => {
    expect(pptxFileName('Amazing Grace')).toBe('Amazing Grace.pptx')
    expect(pptxFileName('song.pptx')).toBe('song.pptx')
    expect(pptxFileName('song.PPTX')).toBe('song.pptx')
    expect(pptxFileName('song.v2')).toBe('song.v2.pptx')
  })

  it('strips characters a file name cannot contain', () => {
    expect(pptxFileName('a/b:c*')).toBe('abc.pptx')
  })
})
