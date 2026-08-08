import { notFound } from 'next/navigation'

import { HolderWorkspaceFrame } from '@/components/holder/HolderWorkspaceFrame'
import { DiscoverSurface } from '@/components/matcha-deck/DiscoverSurface'
import { loadPreviewMatchaDeckPayload } from '@/lib/matcha-deck/previewServerSource'
import { buildClinicianMobileData } from '@/lib/mobile/clinician-state'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'MATCHA Deck harness (dev)',
  robots: { index: false, follow: false },
}

/**
 * Developer-only interaction harness for the MATCHA Deck (PR J1).
 *
 * The real surface lives at /holder/opportunities/discover behind the Clerk
 * gate, which local dev and CI browsers cannot cross (production Clerk keys
 * refuse localhost). This page renders the same fixture-backed surface
 * without auth so drag physics, keyboard, reduced motion, and announcements
 * can be exercised in a real browser and by Playwright.
 *
 * A production-mode local test build also requires MATCHA_DECK_PREVIEW=1.
 * Canonical Railway production denies the harness even if that flag is set.
 */
export default function MatchaDeckDevHarness() {
  const payload = loadPreviewMatchaDeckPayload()
  if (!payload) notFound()

  const initialData = buildClinicianMobileData({
    base: {
      signedIn: true,
      workspace: null,
      trustState: null,
      applications: [],
      opportunities: [],
      missingForHigherMatches: [],
      refreshedAt: '2026-07-16T00:00:00.000Z',
    },
    profileCompleteness: null,
    rawTrustHistory: [],
  })

  return (
    <HolderWorkspaceFrame initialData={initialData} showClerkAccount={false}>
      <DiscoverSurface payload={payload} />
    </HolderWorkspaceFrame>
  )
}
