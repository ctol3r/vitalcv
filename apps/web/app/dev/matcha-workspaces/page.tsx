import { notFound } from 'next/navigation'

import { HolderWorkspaceFrame } from '@/components/holder/HolderWorkspaceFrame'
import { InterestedWorkspaceSurface } from '@/components/matcha-deck/InterestedWorkspaceSurface'
import { PassedWorkspaceSurface } from '@/components/matcha-deck/PassedWorkspaceSurface'
import { buildClinicianMobileData } from '@/lib/mobile/clinician-state'
import { loadPreviewWorkspaces } from '@/lib/matcha-deck/previewWorkspaceSource'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'MATCHA Workspaces harness (dev) · VitalCV',
  robots: { index: false, follow: false },
}

/**
 * Developer-only interaction harness for the Interested / Passed workspaces
 * (J4), so those auth-gated surfaces can be exercised in a real browser and by
 * Playwright (J7). Same isolation as the deck harness: fixtures only, gated by
 * the preview flag, denied in canonical production. `?view=passed` renders the
 * Passed history; the default renders the Interested queue.
 */
export default async function MatchaWorkspacesDevHarness({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const workspaces = loadPreviewWorkspaces()
  if (!workspaces) notFound()

  const { view } = await searchParams
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
      {view === 'passed' ? (
        <PassedWorkspaceSurface signedIn={workspaces.signedIn} items={workspaces.passed} />
      ) : (
        <InterestedWorkspaceSurface signedIn={workspaces.signedIn} items={workspaces.interested} />
      )}
    </HolderWorkspaceFrame>
  )
}
