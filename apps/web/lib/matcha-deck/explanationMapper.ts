/**
 * MATCHA engine → deck explanation mapper (PR J3).
 *
 * The engine emits a flat `MatchExplanation` (fitReasons[], blockers[], band,
 * score). The deck card renders a five-group taxonomy that tells the clinician
 * WHERE each reason comes from:
 *
 *   confirmed   — source-backed fit: a named source actually checked it
 *   preferences — matches a clinician-stated preference
 *   needsReview — a real claim/requirement whose evidence needs action
 *   unknown     — the listing or the profile does not say
 *   blockers    — a known, hard obstacle for this clinician
 *
 * This is a pure classification of what the engine already said; it invents no
 * certainty. The #712/#714 truth fix means the engine's own labels carry their
 * coverage ("checked" vs "on file, not source-checked" vs "not checked"), and
 * the mapper routes on that wording rather than re-asserting it. Critically:
 *
 *   - `confirmed` holds ONLY source-checked positives. A claim that is merely
 *     "on file" (inferred, no source confirmation) routes to `needsReview` —
 *     the same place the J1 fixtures put "license needs source access" — so the
 *     "confirmed" group never contains anything a source did not confirm.
 *
 * Framework-free and deterministic so it is unit-testable and replayable.
 */

import type {
  DeckExplanation,
  DeckOverallLabel,
  MatchReason,
  MatchReasonKind,
} from '@/components/matcha-deck/types'

/** The engine's per-reason shape (subset the deck consumes). */
export interface EngineFitReason {
  dimension: string
  label: string
  positive: boolean
}

/** The engine's per-blocker shape (subset the deck consumes). */
export interface EngineBlocker {
  label: string
  /** severity is 'hard' | 'soft' in the engine; optional here for resilience. */
  severity?: string
  actionLabel?: string
}

export interface EngineExplanation {
  matchBand: string
  matchScore: number
  fitReasons: EngineFitReason[]
  blockers: EngineBlocker[]
}

/**
 * Wording the truth-fixed engine uses to signal source coverage. A positive
 * reason is only source-backed when it says it was actually checked; "on file,
 * not source-checked" is a claim we hold but no source confirmed, so it is
 * inferred and routes to needs-review, never to confirmed.
 */
const CHECKED_PATTERN = /\bchecked\b/i
const NOT_CHECKED_PATTERN = /not (?:source-)?checked|requirements not checked/i

/** Dimensions that express a clinician-stated preference rather than evidence. */
const PREFERENCE_DIMENSIONS = new Set(['schedule', 'location', 'pay', 'intent', 'employer'])

const OVERALL_LABEL_BY_BAND: Record<string, DeckOverallLabel> = {
  CLEAR: 'strong',
  NEAR_CLEAR: 'promising',
  PARTIAL: 'possible',
  INELIGIBLE: 'limited',
}

export function overallLabelForBand(band: string): DeckOverallLabel {
  return OVERALL_LABEL_BY_BAND[band] ?? 'possible'
}

/** Short provenance line shown when a reason is inspected. */
function originFor(kind: MatchReasonKind, dimension: string): string {
  switch (kind) {
    case 'source_backed':
      return dimension === 'credentials' || dimension === 'state' ? 'Source check' : 'Evidence on file'
    case 'preference':
      return 'Your stated preferences'
    case 'inferred':
      return 'On file — not source-checked'
    case 'needs_review':
      return 'Readiness snapshot'
    case 'blocker':
      return 'Readiness snapshot'
    case 'unknown':
      return 'Not provided'
    default:
      return ''
  }
}

function reason(id: string, kind: MatchReasonKind, label: string, dimension: string): MatchReason {
  return { id, kind, label, origin: originFor(kind, dimension) }
}

/**
 * Classify one engine fit reason into a deck reason kind.
 *
 * - preference dimensions → preference (positive) / needs_review (negative)
 * - evidence dimensions, positive:
 *     says "checked"                → source_backed  → confirmed group
 *     otherwise ("on file" / claim) → inferred       → needsReview group
 * - evidence dimensions, negative:
 *     says "not checked" / unknown  → unknown        → unknown group
 *     otherwise                     → needs_review   → needsReview group
 */
export function classifyFitReason(fit: EngineFitReason): MatchReasonKind {
  const dimension = fit.dimension.toLowerCase()

  if (PREFERENCE_DIMENSIONS.has(dimension)) {
    return fit.positive ? 'preference' : 'needs_review'
  }

  if (fit.positive) {
    // "not source-checked" contains the substring "checked" — a claim is only
    // source-backed when it says checked AND does not say not-checked. This
    // ordering is the guard against an unverified claim reaching `confirmed`.
    const saysChecked = CHECKED_PATTERN.test(fit.label) && !NOT_CHECKED_PATTERN.test(fit.label)
    return saysChecked ? 'source_backed' : 'inferred'
  }
  return NOT_CHECKED_PATTERN.test(fit.label) ? 'unknown' : 'needs_review'
}

/** The group a reason kind is rendered under. Every group name stays truthful. */
function groupForKind(kind: MatchReasonKind): keyof Omit<DeckExplanation, 'overallLabel'> {
  switch (kind) {
    case 'source_backed':
      return 'confirmed'
    case 'preference':
      return 'preferences'
    case 'inferred':
    case 'needs_review':
      return 'needsReview'
    case 'unknown':
      return 'unknown'
    case 'blocker':
      return 'blockers'
    default:
      return 'needsReview'
  }
}

/** Map a full engine explanation into the deck's grouped taxonomy. */
export function mapEngineExplanation(engine: EngineExplanation, keyPrefix = 'r'): DeckExplanation {
  const explanation: DeckExplanation = {
    overallLabel: overallLabelForBand(engine.matchBand),
    confirmed: [],
    preferences: [],
    needsReview: [],
    unknown: [],
    blockers: [],
  }

  engine.fitReasons.forEach((fit, i) => {
    const kind = classifyFitReason(fit)
    explanation[groupForKind(kind)].push(reason(`${keyPrefix}-fit-${i}`, kind, fit.label, fit.dimension))
  })

  engine.blockers.forEach((b, i) => {
    // Hard blockers are true obstacles; soft blockers are gaps that still need
    // action but do not make the role impossible. Both surface, weighted by kind.
    const kind: MatchReasonKind = b.severity === 'hard' ? 'blocker' : 'needs_review'
    explanation[groupForKind(kind)].push({
      id: `${keyPrefix}-blk-${i}`,
      kind,
      label: b.label,
      origin: b.actionLabel ? `Action: ${b.actionLabel}` : 'Readiness snapshot',
    })
  })

  return explanation
}
