/**
 * Map a raw `osascript` TCC permission error into an actionable, user-facing message. macOS
 * gates inter-app control (Automation) and GUI scripting (Accessibility); until granted, every
 * call fails with one of these signatures. Turning the raw `-1743` into a "go grant it here"
 * message is the plugin's job (AI/UX policy), not the pure library's.
 */

/** Accessibility (GUI scripting) denial — assistive-access signatures. Checked first because it's
 *  more specific than the generic Automation "not authorized". */
const ACCESSIBILITY = /-25211|-1719|not allowed assistive access|assistive access/i

/** Automation (inter-app Apple events) denial. */
const AUTOMATION = /-1743|not authorized to send Apple events|not authorized/i

/** Returns an actionable message if `stderr` is a TCC permission error, else `undefined`. */
export function mapTccError(stderr: string): string | undefined {
  if (ACCESSIBILITY.test(stderr)) {
    return 'GUI scripting needs Accessibility access. Grant Timmy (or your terminal) in System Settings → Privacy & Security → Accessibility, then retry.'
  }
  if (AUTOMATION.test(stderr)) {
    return "Timmy isn't allowed to control this app yet. Grant it in System Settings → Privacy & Security → Automation, then retry."
  }
  return undefined
}
