/**
 * GET /api/matcha/deck/signals — the clinician's current deck decisions (PR J2).
 *
 * Derived from the canonical append-only OpportunityAction log: latest DECISION
 * per opportunity wins, read through the deck lens (a role saved on the board
 * is already interested here; a declined one is already passed). Telemetry rows
 * — viewed / details_opened — never decide anything and are skipped.
 *
 * Used to keep the deck from re-showing a role the clinician already decided,
 * on any device. Scoped to the authenticated Clerk user: a clinician can only
 * read their OWN decisions, and no employer-facing route reads this data.
 *
 * Deploy-order safe: if the table/columns are not deployed yet or the DB
 * hiccups, degrades to an empty map so the deck still runs — never a 500 in
 * the signed-in experience.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { deckDecisions } from '@/lib/matcha/opportunitySignals';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    // Newest-first; deckDecisions takes the first decision row it sees per
    // opportunity, so this ordering IS the "latest wins" rule.
    const rows = await prisma.opportunityAction.findMany({
      where: { clerkUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: { opportunityId: true, action: true, createdAt: true },
    });

    return NextResponse.json({ decisions: deckDecisions(rows) });
  } catch (err) {
    console.error('[matcha/deck/signals GET]', err);
    return NextResponse.json({ decisions: {} });
  }
}
