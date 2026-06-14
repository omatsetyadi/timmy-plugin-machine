import { describe, it, expect } from 'vitest'
import plugin, { safeMediaUri } from './index'

describe('timmy-plugin-machine', () => {
  it('declares 5 tools with correct risk tiers', () => {
    expect(plugin.name).toBe('machine')
    const tiers = Object.fromEntries(plugin.tools.map((t) => [t.name, t.riskLevel]))
    expect(tiers).toEqual({
      openApp: 'safe', playMedia: 'safe', listDirectory: 'safe',
      deleteFile: 'confirm', killProcess: 'confirm',
    })
  })
  it('tools expose a JSON-schema parameters object and an execute function', () => {
    const tool = plugin.tools.find((t) => t.name === 'listDirectory')!
    expect(tool.parameters).toMatchObject({ type: 'object' })
    expect(typeof tool.execute).toBe('function')
  })
})

describe('safeMediaUri (playMedia hardening — `open <uri>` injection guard)', () => {
  it('allows http/https/spotify media URIs unchanged', () => {
    expect(safeMediaUri('https://open.spotify.com/track/abc')).toBe(
      'https://open.spotify.com/track/abc',
    )
    expect(safeMediaUri('spotify:track:abc')).toBe('spotify:track:abc')
    expect(safeMediaUri('http://example.com/song.mp3')).toBe('http://example.com/song.mp3')
  })

  it('rejects file:/data:/javascript: and arbitrary custom schemes', () => {
    expect(() => safeMediaUri('file:///etc/passwd')).toThrow(/refused media URI scheme/)
    expect(() => safeMediaUri('javascript:alert(1)')).toThrow(/refused media URI scheme/)
    expect(() => safeMediaUri('data:text/html,x')).toThrow(/refused media URI scheme/)
    expect(() => safeMediaUri('someapp://do-a-thing')).toThrow(/refused media URI scheme/)
  })

  it('rejects a bare path (no scheme)', () => {
    expect(() => safeMediaUri('/Users/me/secret')).toThrow(/invalid media URI/)
  })

  it('playMedia tool returns {ok:false} for an unsafe URI without touching the OS', async () => {
    const playMedia = plugin.tools.find((t) => t.name === 'playMedia')!
    const ctx = { credentials: { get: async () => null }, signal: new AbortController().signal }
    const r = await playMedia.execute({ uri: 'file:///etc/passwd' }, ctx)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/refused media URI scheme/)
  })
})
