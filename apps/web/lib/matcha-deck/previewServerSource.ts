import 'server-only'

import { FIXTURE_RECOMMENDATIONS, FIXTURE_SOURCE_LABEL } from '@/components/matcha-deck/fixtures'
import {
  createDeckSourcePayload,
  isMatchaDeckPreviewAllowed,
} from '@/components/matcha-deck/sourceBoundary'
import type { DeckSourcePayload } from '@/components/matcha-deck/types'

/** Preview fixtures are isolated from the authenticated holder source module. */
export function loadPreviewMatchaDeckPayload(): DeckSourcePayload | null {
  if (!isMatchaDeckPreviewAllowed(process.env)) return null

  return createDeckSourcePayload({
    mode: 'preview_fixture',
    sourceLabel: FIXTURE_SOURCE_LABEL,
    recommendations: FIXTURE_RECOMMENDATIONS,
  })
}
