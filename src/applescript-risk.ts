/**
 * Read-vs-mutate classification for the `runAppleScript` tool — the plugin's permission policy
 * (mirrors timmy-core's command-risk classifier in shape). Returns `'allow' | 'ask'` only; it
 * never blocks (config / riskLevel own blocking). Wired into the tool via the SDK `Tool.classify`
 * hook, so the host gates each call by its actual script.
 */

/** A per-call risk decision (matches timmy-sdk's `RiskDecision` structurally). */
export type AppleScriptRisk = 'allow' | 'ask'

/** `do shell script` is an escape hatch from AppleScript into arbitrary shell — it must always
 *  ask, regardless of how read-only the rest of the script looks. */
const DO_SHELL = /do\s+shell\s+script/i

/** Verbs that change state (apps, files, UI). Whole-word matches (so "settings" isn't "set").
 *  Multi-word verbs (`key code`, `shut down`, `log out`) tolerate any internal whitespace. */
const MUTATING =
  /\b(?:delete|quit|close|make|move|duplicate|set|empty|keystroke|click|restart|key\s+code|shut\s+down|log\s+out)\b/i

export function classifyAppleScript(script: string): AppleScriptRisk {
  const s = script.trim()
  if (s === '') return 'ask' // nothing to auto-allow
  if (DO_SHELL.test(s)) return 'ask'
  if (MUTATING.test(s)) return 'ask'
  return 'allow' // read-only (get / return / count / exists / whose / name of / …)
}
