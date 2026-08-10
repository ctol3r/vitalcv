import type { Metadata } from 'next'

import { PassedWorkspaceSurface } from '@/components/matcha-deck/PassedWorkspaceSurface'
import { loadDeckWorkspaces } from '@/lib/matcha-deck/workspaceSource'

export const metadata: Metadata = {
  title: 'Passed — Matches',
  description:
    'Roles you passed on in Discover, kept as history so a pass is never a dead end. Restore any of them to the deck.',
}

export const dynamic = 'force-dynamic'

/**
 * MATCHA Passed history (PR J4). The clinician's passed roles, restorable to
 * the deck. Auth, role gating, and the Calm Wave shell are inherited from the
 * /holder layout.
 */
export default async function PassedPage() {
  const { signedIn, passed } = await loadDeckWorkspaces()
  return <PassedWorkspaceSurface signedIn={signedIn} items={passed} />
}
