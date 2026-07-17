/**
 * MATCHA Deck formatters — pure, honest presentation helpers.
 *
 * Unknown data is always rendered as unknown: these helpers return null when
 * the listing does not provide a value, and the card renders an explicit
 * "not provided" label instead of inventing one.
 */

import type {
  CompensationRange,
  DeckRecommendation,
  MatchReason,
  OpportunityCardData,
  WorkArrangement,
} from './types'

const ARRANGEMENT_LABEL: Record<Exclude<WorkArrangement, 'unknown'>, string> = {
  onsite: 'Onsite',
  remote: 'Remote',
  hybrid: 'Hybrid',
  multi_site: 'Multi-site',
}

export function arrangementLabel(arrangement: WorkArrangement): string | null {
  if (arrangement === 'unknown') return null
  return ARRANGEMENT_LABEL[arrangement]
}

function money(amount: number, period: CompensationRange['period']): string {
  if (period === 'hour') return `$${amount.toLocaleString('en-US')}/hr`
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`
  return `$${amount.toLocaleString('en-US')}`
}

/** "\$310K–\$345K" | "From \$310K" | "Up to \$345K" | null when not provided. */
export function formatCompensation(compensation?: CompensationRange): string | null {
  if (!compensation) return null
  const { min, max, period } = compensation
  if (typeof min === 'number' && typeof max === 'number') {
    if (min === max) return money(min, period)
    return `${money(min, period)}–${money(max, period)}`
  }
  if (typeof min === 'number') return `From ${money(min, period)}`
  if (typeof max === 'number') return `Up to ${money(max, period)}`
  return null
}

/** "Mountain View, CA" | "CA" | "Remote" | null when nothing is known. */
export function locationText(opportunity: OpportunityCardData): string | null {
  const { city, state } = opportunity
  if (city && state) return `${city}, ${state}`
  if (state) return state
  if (city) return city
  if (opportunity.workArrangement === 'remote') return 'Remote'
  return null
}

export interface CardFaceReasons {
  /** Top fits, confirmed first then stated preferences (max 3). */
  fits: MatchReason[]
  /** The single most important gap or unknown, if any. */
  gap: MatchReason | null
}

/**
 * Layer-1 selection: enough to make a meaningful first decision — the top
 * three fits plus one major gap/unknown, exactly as the card face shows them.
 */
export function cardFaceReasons(rec: DeckRecommendation): CardFaceReasons {
  const fits = [...rec.explanation.confirmed, ...rec.explanation.preferences].slice(0, 3)
  const gap =
    rec.explanation.blockers[0] ?? rec.explanation.needsReview[0] ?? rec.explanation.unknown[0] ?? null
  return { fits, gap }
}

export function reasonToneClass(reason: MatchReason): string {
  switch (reason.kind) {
    case 'source_backed':
      return 'mdk-reason--confirmed'
    case 'preference':
      return 'mdk-reason--preference'
    case 'needs_review':
      return 'mdk-reason--review'
    case 'blocker':
      return 'mdk-reason--blocker'
    default:
      return 'mdk-reason--unknown'
  }
}

export function reasonMark(reason: MatchReason): string {
  switch (reason.kind) {
    case 'source_backed':
    case 'preference':
      return '✓'
    case 'needs_review':
    case 'blocker':
      return '△'
    default:
      return '?'
  }
}

const SPONSORSHIP_LABEL: Record<NonNullable<OpportunityCardData['sponsorship']>, string> = {
  available: 'Visa sponsorship available',
  not_available: 'No visa sponsorship',
  unknown: 'Sponsorship not specified',
}

export function sponsorshipLabel(opportunity: OpportunityCardData): string {
  return SPONSORSHIP_LABEL[opportunity.sponsorship ?? 'unknown']
}
