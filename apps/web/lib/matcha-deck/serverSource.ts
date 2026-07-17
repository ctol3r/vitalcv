import 'server-only'

import { createDeckSourcePayload } from '@/components/matcha-deck/sourceBoundary'
import type { DeckSourcePayload } from '@/components/matcha-deck/types'
import { loadLiveFeed } from './liveFeed'

/**
 * The deck payload for /holder/opportunities/discover. Live recommendations
 * when the clinician has an NPI-bound feed with active matches; otherwise the
 * explicit empty state — authenticated clinicians never fall through to the
 * preview fixture deck.
 */
export async function loadHolderMatchaDeckPayload(): Promise<DeckSourcePayload> {
  try {
    const feed = await loadLiveFeed()
    if (feed && feed.recommendations.length > 0) {
      return createDeckSourcePayload({
        mode: 'live',
        sourceLabel: 'Live MATCHA recommendations',
        recommendations: feed.recommendations,
      })
    }
  } catch {
    // The holder route fails honestly below; fixtures are never a fallback.
  }

  return createDeckSourcePayload({
    mode: 'empty',
    sourceLabel: 'Live MATCHA feed unavailable',
    recommendations: [],
    emptyMessage:
      'Live MATCHA recommendations are not available right now. No sample roles have been substituted.',
  })
}
