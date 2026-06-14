import { describe, it, expect, vi } from 'vitest'
import plugin from './index'

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
