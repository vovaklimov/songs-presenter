const illegalFileChars = /[\\/:*?"<>|\u0000-\u001f]/g

export function pptxFileName(input: string): string {
  const base = input
    .replace(illegalFileChars, '')
    .trim()
    .replace(/\.pptx$/i, '')
    .replace(/^\.+/, '')
    .replace(/\.+$/, '')
    .trim()
  if (!base) return 'lyrics.pptx'
  return `${base}.pptx`
}
