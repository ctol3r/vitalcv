import type { Metadata } from 'next'

import { InterestedWorkspaceSurface } from '@/components/matcha-deck/InterestedWorkspaceSurface'
import { loadDeckWorkspaces } from '@/lib/matcha-deck/workspaceSource'

export const metadata: Metadata = {
  title: 'Interested — Matches',
  description:
    'The roles you saved from Discover, priority first, with a side-by-side comparison. Applying stays a separate, consented step.',
}

export const dynamic = 'force-dynamic'

/**
 * MATCHA Interested queue (PR J4). The clinician's saved (interested + priority)
 * roles, joined from their own decision log against the live feed. Auth, role
 * gating, and the Calm Wave shell are inherited from the /holder layout.
 */
export default async function InterestedPage() {
  const { signedIn, interested } = await loadDeckWorkspaces()
  return <InterestedWorkspaceSurface signedIn={signedIn} items={interested} />
}
