/**
 * MATCHA Discover — discovery modes (PR J6).
 *
 * A mode is an intentional lens over the SAME recommendation set the deck
 * already loaded — a pure re-rank or filter, never a new fabricated ranking and
 * never a fetch. Every mode is explainable and honest:
 *
 *   for_you       — the MATCHA order as loaded (evidence + preference + quality)
 *   ready_sooner  — fewest currently-visible readiness gaps first (NOT a promise
 *                   of faster credentialing — just fewer open items right now)
 *   best_comp     — highest disclosed compensation first; roles with no
 *                   provenanced compensation sort LAST, never as zero
 *   near_me       — roles in the clinician's state first, then remote; needs a
 *                   known location, otherwise the mode is unavailable
 *   remote        — remote / hybrid / multi-site arrangements only
 *   new           — most recently posted or updated first; undated roles last
 *
 * Saved and Passed are their own routes (J4), not deck modes.
 *
 * Pure and deterministic (stable sort, ties keep MATCHA order) so the ordering
 * is testable and replayable.
 */

import type { DeckRecommendation } from '@/components/matcha-deck/types'

export type DiscoveryMode = 'for_you' | 'ready_sooner' | 'best_comp' | 'near_me' | 'remote' | 'new'

export interface DiscoveryModeMeta {
  mode: DiscoveryMode
  label: string
  /** Honest one-line description shown as the mode's subtitle. */
  hint: string
  /** Requires a known clinician location; hidden/disabled otherwise. */
  needsLocation?: boolean
}

export const DISCOVERY_MODES: DiscoveryModeMeta[] = [
  { mode: 'for_you', label: 'For you', hint: 'Matched to your evidence and stated preferences.' },
  {
    mode: 'ready_sooner',
    label: 'Ready sooner',
    hint: 'Fewer currently visible readiness gaps — not a promise of faster credentialing.',
  },
  { mode: 'best_comp', label: 'Best pay', hint: 'Highest disclosed compensation first; undisclosed pay sorts last.' },
  { mode: 'near_me', label: 'Near me', hint: 'Roles in your state first, then remote.', needsLocation: true },
  { mode: 'remote', label: 'Remote', hint: 'Remote, hybrid, and multi-site roles only.' },
  { mode: 'new', label: 'New', hint: 'Most recently posted or updated first.' },
]

const HOURS_PER_YEAR = 2080

/** Annualized comparison value for a role's compensation, or null if unusable. */
function comparableComp(rec: DeckRecommendation): number | null {
  const c = rec.opportunity.compensation
  // Unknown provenance must never be ranked as a number — it sorts last, not zero.
  if (!c || c.provenance === 'unknown') return null
  const top = c.max ?? c.min
  if (top === undefined) return null
  return c.period === 'hour' ? top * HOURS_PER_YEAR : top
}

function readinessGapCount(rec: DeckRecommendation): number {
  return rec.explanation.needsReview.length + rec.explanation.blockers.length
}

function freshnessTime(rec: DeckRecommendation): number | null {
  const f = rec.freshness
  const stamp = f.lastMaterialChangeAt ?? f.postedAt ?? f.ingestedAt
  if (!stamp) return null
  const t = Date.parse(stamp)
  return Number.isFinite(t) ? t : null
}

/**
 * Stable sort by a key: items with a null key are pushed to the end in their
 * original relative order (they are "unknown on this axis", never zero).
 * `compare` orders two non-null keys.
 */
function stableRank<T>(items: T[], key: (item: T) => number | null, compare: (a: number, b: number) => number): T[] {
  return items
    .map((item, index) => ({ item, index, key: key(item) }))
    .sort((a, b) => {
      if (a.key === null && b.key === null) return a.index - b.index
      if (a.key === null) return 1 // a unknown → after b
      if (b.key === null) return -1
      const c = compare(a.key, b.key)
      return c !== 0 ? c : a.index - b.index
    })
    .map((entry) => entry.item)
}

const NEAR_ARRANGEMENTS = new Set(['remote', 'hybrid', 'multi_site'])

export interface DiscoveryContext {
  /** The clinician's home/practice state (2-letter), when known. */
  homeState?: string | null
}

/** Whether a mode can be offered given the available context. */
export function isModeAvailable(mode: DiscoveryMode, ctx: DiscoveryContext): boolean {
  if (mode === 'near_me') return !!ctx.homeState
  return true
}

/**
 * Apply a discovery mode to the loaded recommendations. Returns a new array;
 * the input is never mutated. `for_you` is the identity (MATCHA order).
 */
export function applyDiscoveryMode(
  recs: readonly DeckRecommendation[],
  mode: DiscoveryMode,
  ctx: DiscoveryContext = {},
): DeckRecommendation[] {
  const list = [...recs]
  switch (mode) {
    case 'for_you':
      return list
    case 'ready_sooner':
      return stableRank(list, readinessGapCount, (a, b) => a - b)
    case 'best_comp':
      return stableRank(list, comparableComp, (a, b) => b - a)
    case 'new':
      return stableRank(list, freshnessTime, (a, b) => b - a)
    case 'remote':
      return list.filter((r) => NEAR_ARRANGEMENTS.has(r.opportunity.workArrangement))
    case 'near_me': {
      if (!ctx.homeState) return list
      const home = ctx.homeState.toUpperCase()
      // In-state first, then remote/hybrid (near everywhere), then the rest —
      // each tier keeps MATCHA order within it.
      const rank = (r: DeckRecommendation): number => {
        if (r.opportunity.state?.toUpperCase() === home) return 0
        if (NEAR_ARRANGEMENTS.has(r.opportunity.workArrangement)) return 1
        return 2
      }
      return stableRank(list, rank, (a, b) => a - b)
    }
    default:
      return list
  }
}
