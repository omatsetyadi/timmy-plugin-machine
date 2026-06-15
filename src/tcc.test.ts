import { describe, it, expect } from 'vitest'
import { mapTccError } from './tcc'

describe('mapTccError', () => {
  it('maps an Automation (-1743) error to an actionable message', () => {
    const m = mapTccError('execution error: Not authorized to send Apple events (-1743)')
    expect(m).toMatch(/Automation/)
    expect(m).toMatch(/System Settings/)
  })

  it('maps an Accessibility (assistive access) error', () => {
    const m = mapTccError('osascript is not allowed assistive access (-25211)')
    expect(m).toMatch(/Accessibility/)
  })

  it('returns undefined for an unrelated error', () => {
    expect(mapTccError('syntax error: expected end of line but found identifier')).toBeUndefined()
  })
})
