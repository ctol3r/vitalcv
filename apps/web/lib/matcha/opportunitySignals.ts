/**
 * Clinician opportunity signals — the canonical decision vocabulary (PR J2).
 *
 * MATCHA Discover (the deck) and the opportunities board are two surfaces over
 * ONE append-only log (`OpportunityAction`). A role the clinician saved on the
 * board is the same role the deck shows as decided — there is no second
 * "saved roles" list to drift. This module owns that unification:
 *
 *   - the full action vocabulary (board decisions, deck decisions, telemetry)
 *   - which actions are DECISIONS (they change current state) vs TELEMETRY
 *     (viewed / details_opened — recorded, but never a decision)
 *   - `deriveDecisions`: latest decision row per opportunity wins
 *   - two lenses over the same decision: `boardStatusFor` / `deckDecisionFor`
 *
 * Read the log through this module. Casting `action` at a call site is how the
 * board ends up rendering a bucket it has no word for.
 *
 * PRIVACY: these are the clinician's own private workflow decisions. They are
 * never credentials, never verification state, never inputs to trust-state or
 * CRS, and no employer-facing read path may expose them.
 *
 * Pure + SSR-safe.
 */

/** Board vocabulary (Wave K) — what the Save / Connect / Decline surface writes. */
export const BOARD_DECISION_ACTIONS = ['saved', 'connected', 'declined', 'cleared'] as const
export type BoardDecisionAction = (typeof BOARD_DECISION_ACTIONS)[number]

/** Deck vocabulary (PR J1/J2) — what MATCHA Discover writes. */
export const DECK_DECISION_ACTIONS = ['interested', 'priority', 'passed', 'restored'] as const
export type DeckDecisionAction = (typeof DECK_DECISION_ACTIONS)[number]

/**
 * Telemetry — recorded for ranking and replay, never a decision. A card being
 * rendered or expanded must never change what the clinician has decided.
 */
export const TELEMETRY_ACTIONS = ['viewed', 'details_opened'] as const
export type TelemetryAction = (typeof TELEMETRY_ACTIONS)[number]

/** Apply-funnel actions (PR J5) — recorded, and not deck/board decisions. */
export const FUNNEL_ACTIONS = ['application_started', 'application_submitted'] as const
export type FunnelAction = (typeof FUNNEL_ACTIONS)[number]

export type DecisionAction = BoardDecisionAction | DeckDecisionAction
export type SignalAction = DecisionAction | TelemetryAction | FunnelAction

export const DECISION_ACTIONS: readonly DecisionAction[] = [
  ...BOARD_DECISION_ACTIONS,
  ...DECK_DECISION_ACTIONS,
]

export const SIGNAL_ACTIONS: readonly SignalAction[] = [
  ...DECISION_ACTIONS,
  ...TELEMETRY_ACTIONS,
  ...FUNNEL_ACTIONS,
]

/** The surface a signal came from. Discriminates the log without splitting it. */
export const SIGNAL_SURFACES = ['board', 'deck'] as const
export type SignalSurface = (typeof SIGNAL_SURFACES)[number]

export function isSignalAction(value: unknown): value is SignalAction {
  return typeof value === 'string' && (SIGNAL_ACTIONS as readonly string[]).includes(value)
}

export function isDecisionAction(value: unknown): value is DecisionAction {
  return typeof value === 'string' && (DECISION_ACTIONS as readonly string[]).includes(value)
}

export function isSignalSurface(value: unknown): value is SignalSurface {
  return typeof value === 'string' && (SIGNAL_SURFACES as readonly string[]).includes(value)
}

/**
 * Actions that clear a decision, returning the opportunity to "not yet
 * decided": the board's explicit un-toggle and the deck's undo.
 */
const CLEARING_ACTIONS: readonly DecisionAction[] = ['cleared', 'restored']

export function isClearingAction(action: DecisionAction): boolean {
  return CLEARING_ACTIONS.includes(action)
}

export interface SignalRow {
  opportunityId: string
  action: string
  createdAt?: Date | string
  /** The opportunity version the clinician saw when deciding (J2). */
  opportunityVersion?: string | null
  /** The recommendation the decision responded to (J2). */
  recommendationId?: string | null
}

/**
 * The latest decision on one opportunity, with the provenance the workspaces
 * (J4) need: what the clinician saw, and when. `decision` is the raw canonical
 * action; lens it with `deckDecisionFor` / `boardStatusFor` at the call site.
 */
export interface DeckDecisionDetail {
  opportunityId: string
  decision: 'interested' | 'priority' | 'passed'
  opportunityVersion?: string | null
  recommendationId?: string | null
  decidedAt?: string | null
}

function toIso(value: Date | string | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

/**
 * Collapses the append-only log: newest-first rows in, the latest DECISION per
 * opportunity out. Telemetry and funnel rows are skipped entirely — they never
 * decide anything.
 *
 * Clearing actions are RETAINED here rather than swallowed. "The clinician
 * un-saved this" and "the clinician never touched this" are different facts,
 * and callers need to tell them apart: the board's client deletes its local
 * cache entry when the server reports `cleared`, so dropping it would strand a
 * stale save on every other device. Each lens decides how to express it.
 *
 * Rows MUST arrive newest-first; callers order by createdAt desc, and that
 * ordering IS the "latest wins" rule.
 */
export function latestDecisions(rows: readonly SignalRow[]): Record<string, DecisionAction> {
  const decisions: Record<string, DecisionAction> = {}
  for (const row of rows) {
    if (!isDecisionAction(row.action)) continue // telemetry / funnel / unknown
    if (row.opportunityId in decisions) continue // a newer row already won
    decisions[row.opportunityId] = row.action
  }
  return decisions
}

/* ------------------------------------------------------------------ */
/* Lenses — the same decision, read in each surface's own vocabulary    */
/* ------------------------------------------------------------------ */

/** How the board reads a decision. Deck interest is a save; a pass is a decline. */
export function boardStatusFor(decision: DecisionAction): 'saved' | 'connected' | 'declined' | null {
  switch (decision) {
    case 'saved':
    case 'interested':
    case 'priority':
      return 'saved'
    case 'connected':
      return 'connected'
    case 'declined':
    case 'passed':
      return 'declined'
    default:
      return null
  }
}

/**
 * How the deck reads a decision. A role saved or connected on the board is
 * already interested; a declined role is already passed. `priority` survives
 * as itself — it is a stronger save the board has no word for.
 */
export function deckDecisionFor(
  decision: DecisionAction,
): 'interested' | 'priority' | 'passed' | null {
  switch (decision) {
    case 'interested':
    case 'saved':
    case 'connected':
      return 'interested'
    case 'priority':
      return 'priority'
    case 'passed':
    case 'declined':
      return 'passed'
    default:
      return null
  }
}

/**
 * Deck-lens current state: every opportunity the clinician has already decided.
 * A cleared or undone role is omitted — it is undecided again, so the deck is
 * free to show it.
 */
export function deckDecisions(
  rows: readonly SignalRow[],
): Record<string, 'interested' | 'priority' | 'passed'> {
  const out: Record<string, 'interested' | 'priority' | 'passed'> = {}
  for (const [opportunityId, decision] of Object.entries(latestDecisions(rows))) {
    const lensed = deckDecisionFor(decision)
    if (lensed) out[opportunityId] = lensed
  }
  return out
}

/**
 * Board-lens current state, in the board's own vocabulary.
 *
 * A cleared or undone role reports `cleared` rather than being omitted: the
 * board's client treats that as the instruction to drop its local cache entry
 * (see mergeServerActions), which is how un-saving propagates across devices.
 * Omitting it would leave a stale "saved" on every other device.
 */
export function boardStatuses(
  rows: readonly SignalRow[],
): Record<string, 'saved' | 'connected' | 'declined' | 'cleared'> {
  const out: Record<string, 'saved' | 'connected' | 'declined' | 'cleared'> = {}
  for (const [opportunityId, decision] of Object.entries(latestDecisions(rows))) {
    if (isClearingAction(decision)) {
      out[opportunityId] = 'cleared'
      continue
    }
    const lensed = boardStatusFor(decision)
    if (lensed) out[opportunityId] = lensed
  }
  return out
}

/**
 * Deck-lens current decisions WITH provenance, newest-first — the source for
 * the Interested and Passed workspaces (J4). Latest decision per opportunity
 * wins; cleared/undone roles are omitted (undecided again). The relative order
 * of the input (newest-first) is preserved, so callers get a recency-ordered
 * list for free.
 */
export function deckDecisionDetails(rows: readonly SignalRow[]): DeckDecisionDetail[] {
  const seen = new Set<string>()
  const details: DeckDecisionDetail[] = []
  for (const row of rows) {
    if (!isDecisionAction(row.action)) continue // telemetry / funnel / unknown
    if (seen.has(row.opportunityId)) continue // a newer row already won
    seen.add(row.opportunityId)
    const lensed = deckDecisionFor(row.action)
    if (!lensed) continue // the latest decision was a clear/undo → undecided
    details.push({
      opportunityId: row.opportunityId,
      decision: lensed,
      opportunityVersion: row.opportunityVersion ?? null,
      recommendationId: row.recommendationId ?? null,
      decidedAt: toIso(row.createdAt),
    })
  }
  return details
}

/**
 * Decisions are audited — they are mutations of the clinician's own state.
 * Telemetry is not: a rendered card is not an auditable event, and one audit
 * row per card view would be ledger noise with no compliance value.
 */
export function shouldAudit(action: SignalAction): boolean {
  return isDecisionAction(action) || (FUNNEL_ACTIONS as readonly string[]).includes(action)
}
