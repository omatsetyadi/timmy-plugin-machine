import type { TimmyPlugin, Tool, ToolResult } from 'timmy-sdk'
import { createMachine } from '@agent-tool-calls/machine'
import { homedir } from 'node:os'

// Lazy so an unsupported-platform throw from createMachine() surfaces inside a
// tool's catchable execute() (as {ok:false,error}) instead of crashing module load.
let _machine: ReturnType<typeof createMachine> | undefined
const machine = () => (_machine ??= createMachine())

const HOME = homedir()
const ok = (data?: unknown): ToolResult => ({ ok: true, data })
// Strip the user's home-dir prefix from error text so resolved OS paths (symlink
// targets, full home paths) don't leak back to the model.
const fail = (e: unknown): ToolResult => {
  const msg = e instanceof Error ? e.message : String(e)
  return { ok: false, error: HOME ? msg.split(HOME).join('~') : msg }
}

// `playMedia` shells `open <uri>`, which can launch apps, trigger custom scheme handlers,
// or open local files — so a raw URI is a prompt-injection sink. Allow only web + Spotify
// media URIs; reject file:/data:/javascript:, arbitrary custom schemes, and bare paths
// (which fail to parse). Keeps the tool 'safe'/frictionless without the passthrough hole.
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

const tool = (
  name: string,
  description: string,
  riskLevel: Tool['riskLevel'],
  parameters: Record<string, unknown>,
  run: (args: Record<string, unknown>) => Promise<unknown>,
): Tool => ({
  name, description, riskLevel, parameters,
  execute: async (args, _ctx) => {
    try {
      return ok(await run(args))
    } catch (e) {
      return fail(e)
    }
  },
})

const strParam = (key: string, desc: string) => ({
  type: 'object', properties: { [key]: { type: 'string', description: desc } }, required: [key],
})

// Exposes 5 of the MachineAdapter's 6 operations as tools. `getRunningProcesses` is
// intentionally NOT a tool yet (it's a library capability for future use, e.g. a process
// picker UI) — exposing process enumeration to the LLM isn't needed for Phase 3b.
const plugin: TimmyPlugin = {
  name: 'machine',
  version: '0.0.0',
  tools: [
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
      machine().listDirectory(String(a.path)),
    ),
    tool('deleteFile', 'Delete a file', 'confirm', strParam('path', 'file path'), (a) =>
      machine().deleteFile(String(a.path)),
    ),
    tool('killProcess', 'Kill a process by pid', 'confirm',
      { type: 'object', properties: { pid: { type: 'number' } }, required: ['pid'] },
      (a) => machine().killProcess(Number(a.pid)),
    ),
  ],
}
export default plugin
