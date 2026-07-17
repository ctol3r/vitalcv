import type { Metadata } from 'next'

import { DiscoverSurface } from '@/components/matcha-deck/DiscoverSurface'

export const metadata: Metadata = {
  title: 'Discover — MATCHA · VitalCV',
  description:
    'Swipe through opportunities matched to your evidence and preferences. Save the ones worth a closer look — applying stays a separate, consented step.',
}

/**
 * MATCHA Discover (PR J1) — the deck-first opportunity experience for
 * signed-in clinicians. Auth, role gating, and the Calm Wave shell are
 * inherited from the /holder layout. Runs on visibly-labeled fixture data
 * until the live recommendation source lands (PR J3).
 */
export default function DiscoverPage() {
  return <DiscoverSurface />
}
