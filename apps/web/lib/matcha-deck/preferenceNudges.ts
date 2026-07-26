/**
 * MATCHA Discover — progressive preference suggestions (PR J6c).
 *
 * After a clear pattern of passes, the deck may OFFER to adjust a preference —
 * "you've passed several onsite roles; prefer remote?" The clinician always
 * confirms; nothing changes silently.
 *
 * The honesty rule that shapes this file: a nudge may only offer to change a
 * preference the MATCHA engine ACTUALLY ranks on (ENGINE_BACKED_FIELDS in
 * lib/matcha/preferences). Most preference fields are captured for the
 * clinician's profile but do not feed the engine — offering to change one of
 * those would promise a re-rank that never happens. So the deck ships ONE clean
 * mapping (arrangement → remoteInterest) rather than a spread of impressive but
 * inert suggestions. More can be added only when they map to a backed field.
 *
 * A nudge is an OFFER, not an inference asserted as fact: the copy asks a
 * question, and applying it requires explicit confirmation. Pure and
 * framework-free so the trigger is testable exactly.
 */

/** The engine-backed preference field a nudge would change, and its new value. */
export interface PreferenceNudge {
  id: 'prefer_remote'
  /** Question shown to the clinician — never an assertion about what they want. */
  message: string
  /** Engine-backed field (see ENGINE_BACKED_FIELDS) this offer would set. */
  field: 'remoteInterest'
  value: 'high'
  /** Honest note about what confirming actually does. */
  effect: string
}

/** One passed role, reduced to what a nudge reasons about. */
export interface SessionPass {
  workArrangement: string
}

/** Passes of this arrangement count toward the "prefer remote" pattern. */
const ONSITE_ARRANGEMENTS = new Set(['onsite'])

/** How many onsite passes in a session before offering the remote nudge. */
export const REMOTE_NUDGE_THRESHOLD = 3

/**
 * Detect a preference nudge from this session's passes, or null.
 *
 * `dismissed` holds nudge ids the clinician already declined or applied this
 * session, so a nudge is offered at most once. Today the only pattern is a run
 * of onsite passes → offer to prefer remote (remoteInterest is engine-backed,
 * so confirming genuinely re-ranks).
 */
export function detectPreferenceNudge(
  passes: readonly SessionPass[],
  dismissed: ReadonlySet<string>,
): PreferenceNudge | null {
  if (dismissed.has('prefer_remote')) return null
  const onsite = passes.filter((p) => ONSITE_ARRANGEMENTS.has(p.workArrangement)).length
  if (onsite < REMOTE_NUDGE_THRESHOLD) return null
  return {
    id: 'prefer_remote',
    message: `You've passed ${onsite} onsite roles. Prefer remote and hybrid roles?`,
    field: 'remoteInterest',
    value: 'high',
    effect: 'MATCHA will rank remote and hybrid roles higher for you. You can change this anytime in preferences.',
  }
}
