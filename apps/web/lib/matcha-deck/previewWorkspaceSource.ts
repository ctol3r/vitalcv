import 'server-only'

import { FIXTURE_RECOMMENDATIONS } from '@/components/matcha-deck/fixtures'
import { isMatchaDeckPreviewAllowed } from '@/components/matcha-deck/sourceBoundary'
import { buildDeckWorkspaces, type DeckWorkspaces } from './workspace'
import type { DeckDecisionDetail } from '@/lib/matcha/opportunitySignals'

/**
 * Fixture Interested/Passed workspaces for the dev harness (J7). Mirrors
 * loadPreviewMatchaDeckPayload: isolated from the authenticated workspace
 * source, gated by the same preview flag, and built ONLY from the visibly
 * test-only fixtures so no real decision data is ever fabricated.
 *
 * The decision set is chosen to exercise every workspace state the real
 * surface must render: a priority role (sorts first), an active interested
 * role, an interested role whose version changed since it was saved, an
 * interested role no longer in the feed (unavailable history), and passed
 * roles restorable to the deck.
 */
const PREVIEW_DETAILS: DeckDecisionDetail[] = [
  // priority — must sort to the top of Interested
  { opportunityId: 'fx-opp-002', decision: 'priority', opportunityVersion: 'fx-v1', decidedAt: '2026-07-16T10:00:00.000Z' },
  // active interested (version matches the fixture's current version)
  { opportunityId: 'fx-opp-001', decision: 'interested', opportunityVersion: 'fx-v1', decidedAt: '2026-07-16T11:00:00.000Z' },
  // interested but the listing changed since it was saved (fx-rec-004 is fx-v2)
  { opportunityId: 'fx-opp-004', decision: 'interested', opportunityVersion: 'fx-v1', decidedAt: '2026-07-16T09:00:00.000Z' },
  // interested with missing fields (remote, no city/state, no compensation) so
  // the compare view exercises "unknown renders as unknown"
  { opportunityId: 'fx-opp-003', decision: 'interested', opportunityVersion: 'fx-v1', decidedAt: '2026-07-16T08:00:00.000Z' },
  // interested but no longer in the live feed → unavailable history shell
  { opportunityId: 'fx-opp-410', decision: 'interested', opportunityVersion: 'fx-v1', decidedAt: '2026-07-15T09:00:00.000Z' },
  // passed — restorable to the deck
  { opportunityId: 'fx-opp-005', decision: 'passed', opportunityVersion: 'fx-v1', decidedAt: '2026-07-16T07:00:00.000Z' },
  { opportunityId: 'fx-opp-006', decision: 'passed', opportunityVersion: 'fx-v1', decidedAt: '2026-07-16T06:00:00.000Z' },
]

export interface PreviewWorkspaces extends DeckWorkspaces {
  signedIn: boolean
}

export function loadPreviewWorkspaces(): PreviewWorkspaces | null {
  if (!isMatchaDeckPreviewAllowed(process.env)) return null
  const { interested, passed } = buildDeckWorkspaces(PREVIEW_DETAILS, FIXTURE_RECOMMENDATIONS)
  return { signedIn: true, interested, passed }
}
