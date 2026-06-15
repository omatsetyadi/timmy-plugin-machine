import type {
  RiskClassifierContext,
  RiskDecision,
  TimmyPlugin,
  Tool,
  ToolResult,
} from 'timmy-sdk'
import { PLUGIN_API_VERSION } from 'timmy-sdk'
import { makeMachine, MachineOp, type MachineAdapter } from 'tool-call-machine'
import { classifyAppleScript } from './applescript-risk'
import { mapTccError } from './tcc'
import { listScripts, resolveScript } from './scripts'
import { homedir } from 'node:os'
import { resolve, sep } from 'node:path'

// Lazy so any platform issue surfaces inside a tool's catchable execute() rather than at load.
let _machine: MachineAdapter | undefined
const machine = (): MachineAdapter => (_machine ??= makeMachine())
/** True when the running OS's adapter advertises this op (so we only expose real tools). */
const supports = (op: MachineOp): boolean => {
  try {
    return machine().capabilities().has(op)
  } catch {
    return false
  }
}

const HOME = homedir()
const ok = (data?: unknown): ToolResult => ({ ok: true, data })
// Strip the user's home-dir prefix from error text so resolved OS paths don't leak to the model.
const fail = (e: unknown): ToolResult => {
  const msg = e instanceof Error ? e.message : String(e)
  return { ok: false, error: HOME ? msg.split(HOME).join('~') : msg }
}

// `playMedia` shells `open <uri>` — a raw URI is a prompt-injection sink. Allow only web + Spotify
// media URIs; reject file:/data:/javascript:, arbitrary schemes, and bare paths.
const MEDIA_SCHEMES = new Set(['http:', 'https:', 'spotify:'])
export const safeMediaUri = (raw: string): string => {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error(`invalid media URI: ${raw}`)
  }
  if (!MEDIA_SCHEMES.has(url.protocol)) {
    throw new Error(`refused media URI scheme '${url.protocol}' — allowed: http, https, spotify`)
  }
  return raw
}

// listDirectory returns filenames to the model; refuse well-known secret dirs.
const SENSITIVE_DIRS = ['.ssh', '.aws', '.gnupg', '.kube', 'Library/Keychains'].map((d) =>
  resolve(HOME, d),
)
export const safeListPath = (raw: string): string => {
  const abs = resolve(raw.replace(/^~(?=$|[/\\])/, HOME))
  if (SENSITIVE_DIRS.some((d) => abs === d || abs.startsWith(d + sep))) {
    throw new Error(`refused: '${raw}' is a sensitive directory`)
  }
  return abs
}

const tool = (
  name: string,
  description: string,
  riskLevel: Tool['riskLevel'],
  parameters: Record<string, unknown>,
  run: (args: Record<string, unknown>) => Promise<unknown>,
  classify?: (args: Record<string, unknown>, ctx: RiskClassifierContext) => RiskDecision,
): Tool => ({
  name,
  description,
  riskLevel,
  parameters,
  classify,
  execute: async (args, _ctx) => {
    try {
      return ok(await run(args))
    } catch (e) {
      return fail(e)
    }
  },
})

const strParam = (key: string, desc: string) => ({
  type: 'object',
  properties: { [key]: { type: 'string', description: desc } },
  required: [key],
})
const noParams = { type: 'object', properties: {} }

// Base OS ops (getRunningProcesses is intentionally a library-only capability, not a tool).
const baseTools: Tool[] = [
  tool('openApp', 'Open an application by name', 'safe', strParam('name', 'app name'), (a) =>
    machine().openApp(String(a.name)),
  ),
  tool(
    'playMedia',
    'Play media by a web or Spotify URI (http/https/spotify)',
    'safe',
    strParam('uri', 'media uri (http/https/spotify)'),
    (a) => machine().playMedia(safeMediaUri(String(a.uri))),
  ),
  tool('listDirectory', 'List entries in a directory', 'safe', strParam('path', 'dir path'), (a) =>
    machine().listDirectory(safeListPath(String(a.path))),
  ),
  tool('deleteFile', 'Delete a file', 'confirm', strParam('path', 'file path'), (a) =>
    machine().deleteFile(String(a.path)),
  ),
  tool(
    'killProcess',
    'Kill a process by pid',
    'confirm',
    { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] },
    (a) => machine().killProcess(Number(a.pid)),
  ),
]

// App-control (Tier-1 native scripting) — only exposed when the adapter advertises the op.
const appControlTools: Tool[] = []
if (supports(MachineOp.RUN_APPLESCRIPT)) {
  appControlTools.push(
    tool(
      'runAppleScript',
      'Run an AppleScript (or JXA) to control/read macOS apps. Prefer app-dictionary commands ' +
        '(e.g. `tell application "Spotify" to playpause`). For GUI actions (keystrokes / clicking ' +
        'buttons) you MUST activate the app, wait, THEN send the key: ' +
        '`tell application "Photo Booth" to activate` → `delay 1` → ' +
        '`tell application "System Events" to keystroke return`. Use the app\'s real shortcut ' +
        "(don't guess keys), and trust the returned result instead of assuming success. " +
        'For a known repeated action, prefer a saved script via runScript.',
      'confirm',
      {
        type: 'object',
        properties: {
          script: {
            type: 'string',
            description: 'the AppleScript (or JavaScript-for-Automation) source',
          },
          language: {
            type: 'string',
            enum: ['AppleScript', 'JavaScript'],
            description: "script language (default 'AppleScript')",
          },
        },
        required: ['script'],
      },
      async (a) => {
        const language = a.language === 'JavaScript' ? 'JavaScript' : undefined
        const r = await machine().runAppleScript!(
          String(a.script ?? ''),
          language ? { language } : {},
        )
        if (r.timedOut) throw new Error('AppleScript timed out (the app may be showing a dialog)')
        if (r.code !== 0)
          throw new Error(mapTccError(r.stderr) || r.stderr.trim() || `osascript exited ${r.code}`)
        return { stdout: r.stdout }
      },
      (a) => classifyAppleScript(String(a.script ?? '')),
    ),
  )
  // Script library: saved, pre-vetted scripts run by name — reliable, no key/timing guessing,
  // and `safe`-tier (you vetted them by saving), so no per-call confirm.
  appControlTools.push(
    tool(
      'listScripts',
      'List your saved AppleScripts (in ~/.timmy/scripts/) that runScript can run by name.',
      'safe',
      noParams,
      async () => listScripts(),
    ),
    tool(
      'runScript',
      'Run a SAVED AppleScript by name (from ~/.timmy/scripts/) — reliable + pre-vetted, no key/timing guessing. Use listScripts to see options; prefer this over runAppleScript for known repeated actions.',
      'safe',
      strParam('name', 'saved script name, e.g. "photobooth-photo"'),
      async (a) => {
        const script = resolveScript(String(a.name))
        const r = await machine().runAppleScript!(script, {})
        if (r.timedOut) throw new Error('script timed out (the app may be showing a dialog)')
        if (r.code !== 0)
          throw new Error(mapTccError(r.stderr) || r.stderr.trim() || `osascript exited ${r.code}`)
        return { stdout: r.stdout }
      },
    ),
  )
}
if (supports(MachineOp.LIST_RUNNING_APPS)) {
  appControlTools.push(
    tool(
      'listRunningApps',
      'List the visible running apps and which is frontmost (read-only).',
      'safe',
      noParams,
      () => machine().listRunningApps!(),
    ),
  )
}
if (supports(MachineOp.CHECK_PERMISSIONS)) {
  appControlTools.push(
    tool(
      'appControlDoctor',
      'Check whether macOS has granted Timmy the Automation + Accessibility permissions app-control needs, and how to grant them.',
      'safe',
      noParams,
      async () => {
        const status = await machine().checkPermissions!()
        return {
          ...status,
          grant:
            'Grant the process that RUNS Timmy (the node/daemon binary now, or the packaged Timmy.app later) ' +
            'in System Settings → Privacy & Security → Automation + Accessibility. ' +
            'Granting only Terminal is not enough — TCC is per-binary, and the daemon may run as a different process.',
        }
      },
    ),
  )
}

const plugin: TimmyPlugin = {
  apiVersion: PLUGIN_API_VERSION,
  name: 'machine',
  version: '0.1.0',
  tools: [...baseTools, ...appControlTools],
}
export default plugin
