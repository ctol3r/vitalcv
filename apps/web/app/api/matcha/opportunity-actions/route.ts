/**
 * GET /api/matcha/opportunity-actions — Wave K.
 *
 * The authenticated clinician's current opportunity decisions, derived from
 * the append-only OpportunityAction log: latest decision per opportunityId
 * wins (a 'cleared' row means the opportunity is back to "new"). Used to
 * hydrate the Save / Connect / Decline state across devices; localStorage
 * remains the client's optimistic cache.
 *
 * PR J2 — MATCHA Discover writes deck decisions (interested / priority /
 * passed / restored) and telemetry (viewed / details_opened) to this same log.
 * The board reads them through the shared board lens in
 * lib/matcha/opportunitySignals: deck interest is a save, a pass is a decline,
 * and telemetry decides nothing. Casting `action` raw here would feed the
 * board's Save/Connect/Decline buckets words they cannot represent.
 *
 * Deploy-order safe: if the table does not exist yet (migration not deployed)
 * or the DB hiccups, degrades to an empty map so the client silently falls
 * back to its local cache — never a 500 in the signed-in experience.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { boardStatuses } from '@/lib/matcha/opportunitySignals';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    // Newest-first; boardStatuses takes the first decision row it sees per
    // opportunity, so this ordering IS the "latest wins" rule.
    const rows = await prisma.opportunityAction.findMany({
      where: { clerkUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
      select: { opportunityId: true, action: true, createdAt: true },
    });

    return NextResponse.json({ actions: boardStatuses(rows) });
  } catch (err) {
    console.error('[matcha/opportunity-actions GET]', err);
    // Degrade to empty — the client keeps its local cache as the fallback.
    return NextResponse.json({ actions: {} });
  }
}
