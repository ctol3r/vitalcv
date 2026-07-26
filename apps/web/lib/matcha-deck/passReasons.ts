/**
 * MATCHA Discover — optional, progressive pass reasons (PR J6b).
 *
 * After SELECTED left swipes the deck offers a quick, optional reason. The
 * directive's rules, encoded here as pure logic:
 *   - never interrupt every swipe,
 *   - ask after the first few passes, then only occasionally,
 *   - never require an answer,
 *   - allow "don't ask again".
 *
 * A pass reason is PRIVATE clinician preference data. It is recorded against the
 * clinician's own decision log and is never exposed to employers.
 *
 * The prompt decision and the reason vocabulary are pure and framework-free so
 * they are testable exactly; the non-blocking UI lives in PassReasonBar.tsx.
 */

export interface PassReasonOption {
  id: string
  label: string
}

/** The offered reasons. `other` is a catch-all; none are required. */
export const PASS_REASONS: PassReasonOption[] = [
  { id: 'too_far', label: 'Too far' },
  { id: 'compensation', label: 'Compensation' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'employer', label: 'Employer' },
  { id: 'specialty', label: 'Specialty mismatch' },
  { id: 'not_enough_info', label: 'Not enough information' },
  { id: 'license', label: 'License requirement' },
  { id: 'setting', label: 'Not this setting' },
  { id: 'already_seen', label: 'Already seen' },
  { id: 'other', label: 'Other' },
]

const PASS_REASON_IDS = new Set(PASS_REASONS.map((r) => r.id))

export function isPassReasonId(value: unknown): value is string {
  return typeof value === 'string' && PASS_REASON_IDS.has(value)
}

/**
 * Should the clinician be asked WHY they passed, given how many passes they have
 * made this session (1-indexed) and whether they have opted out?
 *
 * The very first pass is never interrupted. The 2nd and 3rd are asked (the
 * "first few"), then only every 5th pass after that — sparse enough to never
 * feel like a toll on swiping, frequent enough early to learn preferences.
 */
export function shouldPromptForReason(passCount: number, suppressed: boolean): boolean {
  if (suppressed || passCount < 2) return false
  if (passCount <= 3) return true
  return passCount % 5 === 0
}

/* ------------------------------------------------------------------ */
/* "Don't ask again" — a private, client-side preference                */
/* ------------------------------------------------------------------ */

export const PASS_REASON_SUPPRESSED_KEY = 'vitalcv.matcha.pass-reason.suppressed'

function safeLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadPassReasonSuppressed(): boolean {
  return safeLocalStorage()?.getItem(PASS_REASON_SUPPRESSED_KEY) === '1'
}

export function persistPassReasonSuppressed(suppressed: boolean): void {
  const ls = safeLocalStorage()
  if (!ls) return
  try {
    if (suppressed) ls.setItem(PASS_REASON_SUPPRESSED_KEY, '1')
    else ls.removeItem(PASS_REASON_SUPPRESSED_KEY)
  } catch {
    /* no-op */
  }
}
