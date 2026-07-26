import 'server-only'

import { auth } from '@clerk/nextjs/server'

import { prisma } from '@/lib/db'
import { deckDecisionDetails, type SignalRow } from '@/lib/matcha/opportunitySignals'
import { loadLiveFeed } from './liveFeed'
import { buildDeckWorkspaces, type DeckWorkspaces } from './workspace'

/**
 * Load the Interested and Passed workspaces for the signed-in clinician (J4).
 *
 * Joins the clinician's OWN decision log (the append-only OpportunityAction
 * rows, read via deckDecisionDetails) against their live MATCHA feed. Scoped to
 * the authenticated Clerk user — a clinician only ever sees their own
 * decisions, and no employer-facing path reads this.
 *
 * Degrades honestly: a signed-out user or a DB/feed hiccup yields empty
 * workspaces rather than a 500. `signedIn` distinguishes "nothing saved yet"
 * from "not signed in" for the surface's empty state.
 */
export interface DeckWorkspacesResult extends DeckWorkspaces {
  signedIn: boolean
}

export async function loadDeckWorkspaces(): Promise<DeckWorkspacesResult> {
  const { userId } = await auth()
  if (!userId) {
    return { signedIn: false, interested: [], passed: [] }
  }

  const [rows, feed] = await Promise.all([
    loadDecisionRows(userId),
    loadLiveFeed().catch(() => null),
  ])

  const details = deckDecisionDetails(rows)
  const { interested, passed } = buildDeckWorkspaces(details, feed?.recommendations ?? [])
  return { signedIn: true, interested, passed }
}

async function loadDecisionRows(userId: string): Promise<SignalRow[]> {
  try {
    const rows = await prisma.opportunityAction.findMany({
      where: { clerkUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: {
        opportunityId: true,
        action: true,
        createdAt: true,
        opportunityVersion: true,
        recommendationId: true,
      },
    })
    return rows as SignalRow[]
  } catch {
    // Columns/table not deployed yet, or a DB hiccup — empty is honest here.
    return []
  }
}
