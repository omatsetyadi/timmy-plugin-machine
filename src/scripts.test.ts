import { describe, it, expect } from 'vitest'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { listScripts, resolveScript } from './scripts'

const dirWith = (files: Record<string, string>): string => {
  const d = mkdtempSync(join(tmpdir(), 'scripts-'))
  for (const [name, content] of Object.entries(files)) writeFileSync(join(d, name), content)
  return d
}

describe('listScripts', () => {
  it('lists .applescript/.scpt files and ignores others', () => {
    const d = dirWith({ 'a.applescript': 'x', 'b.scpt': 'y', 'readme.txt': 'z' })
    expect(listScripts(d).sort()).toEqual(['a.applescript', 'b.scpt'])
  })

  it('returns [] for a missing directory', () => {
    expect(listScripts(join(tmpdir(), 'definitely-no-such-dir-xyz'))).toEqual([])
  })
})

describe('resolveScript', () => {
  it('reads a script by full filename', () => {
    const d = dirWith({ 'photo.applescript': 'tell app "X"' })
    expect(resolveScript('photo.applescript', d)).toBe('tell app "X"')
  })

  it('resolves a bare name to .applescript', () => {
    const d = dirWith({ 'photo.applescript': 'CONTENT' })
    expect(resolveScript('photo', d)).toBe('CONTENT')
  })

  it('rejects path traversal / separators', () => {
    const d = dirWith({})
    expect(() => resolveScript('../secret', d)).toThrow(/invalid script name/)
    expect(() => resolveScript('sub/x', d)).toThrow(/invalid script name/)
  })

  it('throws on a missing script', () => {
    expect(() => resolveScript('nope', dirWith({}))).toThrow(/no saved script/)
  })
})
