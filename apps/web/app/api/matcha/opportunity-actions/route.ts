/**
 * GET /api/matcha/opportunity-actions — Wave K.
 *
 * The authenticated clinician's current opportunity decisions, derived from
 * the append-only OpportunityAction log: latest row per opportunityId wins
 * (a 'cleared' row means the opportunity is back to "new"). Used to hydrate
 * the Save / Connect / Decline state across devices; localStorage remains the
 * client's optimistic cache.
 *
 * Deploy-order safe: if the table does not exist yet (migration not deployed)
 * or the DB hiccups, degrades to an empty map so the client silently falls
 * back to its local cache — never a 500 in the signed-in experience.
 */
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { OpportunityActionValue } from '@/lib/matcha/opportunityActions';

export const runtime = 'nodejs';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  try {
    // Newest-first, then first-seen per opportunityId = the latest decision.
    const rows = await prisma.opportunityAction.findMany({
      where: { clerkUserId: userId },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { opportunityId: true, action: true },
    });

    const actions: Record<string, OpportunityActionValue> = {};
    for (const row of rows) {
      if (!(row.opportunityId in actions)) {
        actions[row.opportunityId] = row.action as OpportunityActionValue;
      }
    }

    return NextResponse.json({ actions });
  } catch (err) {
    console.error('[matcha/opportunity-actions GET]', err);
    // Degrade to empty — the client keeps its local cache as the fallback.
    return NextResponse.json({ actions: {} });
  }
}
