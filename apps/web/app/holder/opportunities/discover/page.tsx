import type { Metadata } from 'next'

import { DiscoverSurface } from '@/components/matcha-deck/DiscoverSurface'
import { loadHolderMatchaDeckPayload } from '@/lib/matcha-deck/serverSource'

export const metadata: Metadata = {
  title: 'Discover — Matches',
  description:
    'Swipe through opportunities matched to your evidence and preferences. Save the ones worth a closer look — applying stays a separate, consented step.',
}

/**
 * MATCHA Discover (PR J1) — the deck-first opportunity experience for
 * signed-in clinicians. Auth, role gating, and the Calm Wave shell are
 * inherited from the /holder layout. The server selects the source mode;
 * unavailable live data renders an honest empty state, never preview roles.
 */
export default async function DiscoverPage() {
  const payload = await loadHolderMatchaDeckPayload()
  return <DiscoverSurface payload={payload} />
}
