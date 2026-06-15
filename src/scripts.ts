import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'

/** Where saved scripts live. The model runs these by name (reliable, pre-vetted) via `runScript`,
 *  instead of writing freeform AppleScript and guessing keys/timing. */
export const SCRIPTS_DIR = join(homedir(), '.timmy', 'scripts')

const SCRIPT_EXT = /\.(applescript|scpt|js)$/i

/** Names of saved scripts in `dir` (`.applescript` / `.scpt` / `.js`). `[]` if the dir is absent. */
export function listScripts(dir: string = SCRIPTS_DIR): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter((f) => SCRIPT_EXT.test(f))
}

/** Read a saved script's source by name — a full filename or a bare name (resolved to
 *  `.applescript`/`.scpt`). Rejects any path separators (no traversal). Throws if not found. */
export function resolveScript(name: string, dir: string = SCRIPTS_DIR): string {
  if (basename(name) !== name) throw new Error(`invalid script name: ${name}`)
  const candidates = SCRIPT_EXT.test(name) ? [name] : [`${name}.applescript`, `${name}.scpt`]
  for (const c of candidates) {
    const p = join(dir, c)
    if (existsSync(p)) return readFileSync(p, 'utf8')
  }
  throw new Error(`no saved script '${name}' in ${dir} — see listScripts`)
}
