import { describe, it, expect } from 'vitest'
import { homedir } from 'node:os'
import { join } from 'node:path'
import plugin, { safeMediaUri, safeListPath } from './index'

const ctx = {
  credentials: { get: async () => null },
  signal: new AbortController().signal,
  platform: 'mac' as const,
}

describe('timmy-plugin-machine', () => {
  it('declares the base + app-control tools with correct risk tiers (on macOS)', () => {
    expect(plugin.name).toBe('machine')
    expect(plugin.apiVersion).toBeGreaterThanOrEqual(1)
    const tiers = Object.fromEntries(plugin.tools.map((t) => [t.name, t.riskLevel]))
    expect(tiers).toMatchObject({
      openApp: 'safe',
      playMedia: 'safe',
      listDirectory: 'safe',
      deleteFile: 'confirm',
      killProcess: 'confirm',
      runAppleScript: 'confirm',
      listRunningApps: 'safe',
      appControlDoctor: 'safe',
      listScripts: 'safe',
      runScript: 'safe',
    })
  })

  it('runAppleScript gates read vs mutate via its classify hook', () => {
    const t = plugin.tools.find((t) => t.name === 'runAppleScript')!
    expect(typeof t.classify).toBe('function')
    const cctx = { allowlist: [] as string[] }
    expect(t.classify!({ script: 'tell application "Spotify" to get player state' }, cctx)).toBe(
      'allow',
    )
    expect(t.classify!({ script: 'tell application "Spotify" to quit' }, cctx)).toBe('ask')
  })

  it('tools expose a JSON-schema parameters object and an execute function', () => {
    const t = plugin.tools.find((t) => t.name === 'listDirectory')!
    expect(t.parameters).toMatchObject({ type: 'object' })
    expect(typeof t.execute).toBe('function')
  })
})

describe('safeMediaUri (playMedia hardening — `open <uri>` injection guard)', () => {
  it('allows http/https/spotify media URIs unchanged', () => {
    expect(safeMediaUri('https://open.spotify.com/track/abc')).toBe(
      'https://open.spotify.com/track/abc',
    )
    expect(safeMediaUri('spotify:track:abc')).toBe('spotify:track:abc')
  })

  it('rejects file:/data:/javascript: and arbitrary custom schemes', () => {
    expect(() => safeMediaUri('file:///etc/passwd')).toThrow(/refused media URI scheme/)
    expect(() => safeMediaUri('javascript:alert(1)')).toThrow(/refused media URI scheme/)
    expect(() => safeMediaUri('someapp://do-a-thing')).toThrow(/refused media URI scheme/)
  })

  it('playMedia tool returns {ok:false} for an unsafe URI without touching the OS', async () => {
    const playMedia = plugin.tools.find((t) => t.name === 'playMedia')!
    const r = await playMedia.execute({ uri: 'file:///etc/passwd' }, ctx)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/refused media URI scheme/)
  })
})

describe('safeListPath (listDirectory hardening — secret-dir enumeration guard)', () => {
  it('refuses well-known secret directories (and paths under them)', () => {
    expect(() => safeListPath(join(homedir(), '.ssh'))).toThrow(/sensitive directory/)
    expect(() => safeListPath('~/.aws')).toThrow(/sensitive directory/)
  })

  it('allows ordinary directories (returns the resolved absolute path)', () => {
    expect(safeListPath('/tmp')).toBe('/tmp')
  })

  it('listDirectory tool returns {ok:false} for a secret dir without reading it', async () => {
    const listDirectory = plugin.tools.find((t) => t.name === 'listDirectory')!
    const r = await listDirectory.execute({ path: '~/.ssh' }, ctx)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/sensitive directory/)
  })
})
