/// <reference types="node" />
import { readFileSync } from 'node:fs'

export function loadSampleUrk(): string {
  const findings = readFileSync(new URL('../findings.md', import.meta.url), 'utf8')
  const match = findings.match(/```text\n([\s\S]*?)\n```/)
  const sample = match?.[1]?.replace(/\r\n/g, '\n')
  if (!sample) throw new Error('Sample paste not found in findings.md')
  return sample
}

/** The sample is pairs of lyric lines separated by a blank line. */
export function referenceSampleBlocks(sample: string): string[][] {
  const physical = sample.split('\n')
  const blocks: string[][] = []
  let index = 0

  while (index < physical.length) {
    const first = physical[index]
    const second = physical[index + 1]
    if (first === undefined || first.trim() === '') {
      throw new Error(`Unexpected blank line at ${index + 1}`)
    }
    if (second === undefined || second.trim() === '') {
      throw new Error(`Block at line ${index + 1} does not have two lines`)
    }
    blocks.push([first.trim(), second.trim()])

    const separator = physical[index + 2]
    if (separator === undefined) break
    if (separator.trim() !== '') {
      throw new Error(`Expected a blank line after block ${blocks.length}`)
    }
    index += 3
  }

  return blocks
}
