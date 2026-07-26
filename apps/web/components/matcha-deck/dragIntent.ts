/**
 * MATCHA Deck — drag physics thresholds and the commit decision (PR J1).
 *
 * Pure, so the thresholds are testable exactly. The card's motion is driven by
 * the pointer; this module answers the one question the motion layer asks on
 * release: did that gesture commit, and to what?
 *
 * Thresholds come from the interaction spec and are tuned by real browser
 * testing, not treated as fixed doctrine.
 */

import type { DeckDecision } from './types'

/** px/second. A fast flick commits even when it never travelled far. */
export const COMMIT_VELOCITY = 700

/** Cap the distance threshold so wide desktop cards don't need a huge drag. */
export const MAX_COMMIT_DISTANCE = 120
export const COMMIT_DISTANCE_RATIO = 0.28

export function commitDistanceFor(width: number): number {
  return Math.min(MAX_COMMIT_DISTANCE, width * COMMIT_DISTANCE_RATIO)
}

export interface DragVector {
  x: number
  y: number
}

/** What a released drag resolved to. `null` ⇒ below threshold, card returns. */
export type DragIntent = DeckDecision | 'details' | null

/**
 * Resolve a released drag into an intent.
 *
 * The dominant axis wins (ties go to horizontal, the primary decision axis),
 * and on that axis EITHER distance or velocity can commit — a deliberate drag
 * past the threshold, or a quick flick. Downward drags never commit: there is
 * no downward action, so they return the card.
 */
export function resolveDragIntent(
  offset: DragVector,
  velocity: DragVector,
  cardWidth: number,
): DragIntent {
  const distance = commitDistanceFor(cardWidth)
  const horizontal = Math.abs(offset.x) >= Math.abs(offset.y)

  if (horizontal) {
    if (offset.x > distance || velocity.x > COMMIT_VELOCITY) return 'interested'
    if (offset.x < -distance || velocity.x < -COMMIT_VELOCITY) return 'passed'
    return null
  }

  // Vertical: only upward opens details.
  if (offset.y < -distance || velocity.y < -COMMIT_VELOCITY) return 'details'
  return null
}
