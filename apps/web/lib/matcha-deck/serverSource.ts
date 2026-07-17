import 'server-only'

import { createDeckSourcePayload } from '@/components/matcha-deck/sourceBoundary'
import type { DeckRecommendation, DeckSourcePayload } from '@/components/matcha-deck/types'

async function loadLiveRecommendations(): Promise<DeckRecommendation[] | null> {
  // Wave 1 connects the existing MATCHA recommendation service here. Until
  // then, absence is explicit; authenticated clinicians never fall through
  // to the preview fixture deck.
  return null
}

export async function loadHolderMatchaDeckPayload(): Promise<DeckSourcePayload> {
  try {
    const recommendations = await loadLiveRecommendations()
    if (recommendations) {
      return createDeckSourcePayload({
        mode: 'live',
        sourceLabel: 'Live MATCHA recommendations',
        recommendations,
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
