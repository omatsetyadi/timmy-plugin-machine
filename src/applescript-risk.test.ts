import { describe, it, expect } from 'vitest'
import { classifyAppleScript } from './applescript-risk'

describe('classifyAppleScript', () => {
  it('allows read-only scripts', () => {
    expect(classifyAppleScript('tell application "Spotify" to get player state')).toBe('allow')
    expect(
      classifyAppleScript('tell application "System Events" to return name of first process'),
    ).toBe('allow')
  })

  it('asks on mutating verbs', () => {
    const mutating = [
      'tell application "Finder" to delete file x',
      'tell application "Spotify" to quit',
      'tell application "Spotify" to set sound volume to 50',
      'tell application "Notes" to make new note',
      'tell application "System Events" to keystroke "a"',
      'tell application "System Events" to key code 36',
      'tell application "System Events" to click menu item "New"',
      'tell application "System Events" to shut down',
    ]
    for (const s of mutating) expect(classifyAppleScript(s)).toBe('ask')
  })

  it('asks on `do shell script` even when wrapped in a read', () => {
    expect(classifyAppleScript('do shell script "rm -rf /"')).toBe('ask')
    expect(classifyAppleScript('return (do shell script "whoami")')).toBe('ask')
  })

  it('asks on an empty/blank script', () => {
    expect(classifyAppleScript('   ')).toBe('ask')
  })

  it('does not treat substrings as verbs (e.g. "settings")', () => {
    expect(classifyAppleScript('tell application "X" to get settings')).toBe('allow')
  })
})
