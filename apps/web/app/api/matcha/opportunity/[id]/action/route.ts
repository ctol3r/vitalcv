/**
 * POST /api/matcha/opportunity/[id]/action — Wave K.
 *
 * Server-persists a clinician's Save / Connect / Decline decision on a MATCHA
 * opportunity. Append-only: every action — including clearing one back to
 * "new" (`action: 'cleared'`) — inserts a NEW OpportunityAction row, paired
 * with an AuditEvent in the same transaction (audit-first rule). Rows are the
 * clinician's own workflow decisions — never credentials, never verification
 * state, never inputs to trust-state/CRS.
 *
 * Auth-scoped to the authenticated Clerk user (identity from auth(), NOT a
 * caller-supplied header). Deploy-order safe: until the OpportunityAction
 * migration deploys (or if the DB hiccups) the route degrades to
 * `persisted: false` so the client silently keeps its localStorage cache —
 * never a 500 in the signed-in experience (same pattern as MatchaPreference).
 */
import { createHash, randomUUID } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isOpportunityActionValue } from '@/lib/matcha/opportunityActions';

export const runtime = 'nodejs';

const NPI_RE = /^\d{10}$/;
// Opportunity ids are opaque string keys (DB uuids or registry slugs) —
// bound the length and reject whitespace/control characters.
const OPPORTUNITY_ID_RE = /^[\x21-\x7e]{1,128}$/;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  const { id: opportunityId } = await context.params;
  if (!OPPORTUNITY_ID_RE.test(opportunityId)) {
    return NextResponse.json({ error: 'invalid opportunity id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const action = (body as { action?: unknown })?.action;
  if (!isOpportunityActionValue(action)) {
    return NextResponse.json(
      { error: 'action must be one of saved | connected | declined | cleared' },
      { status: 400 },
    );
  }

  const rawNpi = (body as { npi?: unknown })?.npi;
  const npi = typeof rawNpi === 'string' && NPI_RE.test(rawNpi) ? rawNpi : null;

  const recordedAt = new Date().toISOString();
  const actionId = randomUUID();
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        action,
        actionId,
        clerkUserId: userId,
        npi,
        opportunityId,
        recordedAt,
      }),
    )
    .digest('hex');

  try {
    await prisma.$transaction([
      prisma.opportunityAction.create({
        data: {
          id: actionId,
          clerkUserId: userId,
          npi,
          opportunityId,
          action,
          source: 'web',
        },
      }),
      prisma.auditEvent.create({
        data: {
          id: randomUUID(),
          type: 'matcha.opportunity_action',
          hash,
          referenceId: opportunityId,
          clinicianId: npi,
          metadata: {
            action,
            actionId,
            // Actor attribution — the authenticated Clerk user, from auth().
            clerkUserId: userId,
            opportunityId,
            recordedAt,
            source: 'web',
          },
        },
      }),
    ]);
    return NextResponse.json({ ok: true, persisted: true, action });
  } catch (err) {
    console.error('[matcha/opportunity action POST]', err);
    // Best-effort: never break the client; localStorage remains the fallback.
    return NextResponse.json({ ok: false, persisted: false, action }, { status: 200 });
  }
}
