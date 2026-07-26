/**
 * POST /api/matcha/deck/signal — MATCHA Discover decision persistence (PR J2).
 *
 * Records one clinician deck signal (interested / priority / passed / restored,
 * plus viewed / details_opened telemetry) into the canonical append-only
 * OpportunityAction log — the same log the Save/Connect/Decline board uses, so
 * there is never a second competing "saved roles" list.
 *
 * Contract:
 * - Append-only. Undo appends a `restored` row; nothing is ever updated.
 * - Idempotent on `clientSignalId`: a retried or replayed emit of the SAME
 *   user intent collapses onto the existing row (duplicate: true) rather than
 *   duplicating the event.
 * - Decisions are audited in the same transaction (audit-first mutation rule).
 *   Telemetry is not — a rendered card is not an auditable event, and one
 *   audit row per card view would be ledger noise with no compliance value.
 * - Identity comes from Clerk auth(), never a caller-supplied header, so a
 *   clinician can only ever write their own signals.
 *
 * PRIVACY: deck decisions are the clinician's own private workflow. No
 * employer-facing route reads them — pinned by the contract test in
 * apps/web/__tests__/matcha-deck-signal-privacy.test.ts.
 *
 * Deploy-order safe: until the migration deploys (or if the DB hiccups) the
 * route degrades to `persisted: false` so the deck keeps working from its
 * in-memory state — never a 500 in the signed-in experience (the same pattern
 * as MatchaPreference and the board's action route).
 */
import { createHash, randomUUID } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import type { Prisma } from '@/lib/generated/prisma';
import { isSignalAction, shouldAudit } from '@/lib/matcha/opportunitySignals';

export const runtime = 'nodejs';

const NPI_RE = /^\d{10}$/;
// Opportunity ids are opaque string keys (DB uuids or registry slugs) — bound
// the length and reject whitespace/control characters.
const OPAQUE_ID_RE = /^[\x21-\x7e]{1,128}$/;
const REASON_MAX = 200;

function optionalOpaque(value: unknown): string | null {
  return typeof value === 'string' && OPAQUE_ID_RE.test(value) ? value : null;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;

  const action = payload.action;
  if (!isSignalAction(action)) {
    return NextResponse.json({ error: 'unknown action' }, { status: 400 });
  }

  const opportunityId = optionalOpaque(payload.opportunityId);
  if (!opportunityId) {
    return NextResponse.json({ error: 'invalid opportunity id' }, { status: 400 });
  }

  const clientSignalId = optionalOpaque(payload.clientSignalId);
  if (!clientSignalId) {
    return NextResponse.json({ error: 'clientSignalId required' }, { status: 400 });
  }

  const rawNpi = payload.npi;
  const npi = typeof rawNpi === 'string' && NPI_RE.test(rawNpi) ? rawNpi : null;
  const opportunityVersion = optionalOpaque(payload.opportunityVersion);
  const recommendationId = optionalOpaque(payload.recommendationId);
  const sessionId = optionalOpaque(payload.sessionId);
  const reason =
    typeof payload.reason === 'string' && payload.reason.trim().length > 0
      ? payload.reason.trim().slice(0, REASON_MAX)
      : null;

  const recordedAt = new Date().toISOString();
  const actionId = randomUUID();
  const hash = createHash('sha256')
    .update(
      JSON.stringify({
        action,
        actionId,
        clerkUserId: userId,
        clientSignalId,
        npi,
        opportunityId,
        opportunityVersion,
        recommendationId,
        recordedAt,
      }),
    )
    .digest('hex');

  try {
    // Idempotency: the unique index on clientSignalId is the real guard (it
    // holds under concurrent retries). This read just avoids the common-case
    // write attempt and lets us answer with the original row's action.
    const existing = await prisma.opportunityAction.findUnique({
      where: { clientSignalId },
      select: { action: true, clerkUserId: true },
    });
    if (existing) {
      // clientSignalId is client-generated, so a hostile caller could send one
      // that collides with another user's. Never confirm another user's signal
      // and never overwrite it.
      if (existing.clerkUserId !== userId) {
        return NextResponse.json({ error: 'invalid clientSignalId' }, { status: 409 });
      }
      return NextResponse.json({
        ok: true,
        persisted: true,
        duplicate: true,
        action: existing.action,
      });
    }

    // The row and (for decisions) its audit event land together or not at all.
    const writes: Prisma.PrismaPromise<unknown>[] = [
      prisma.opportunityAction.create({
        data: {
          id: actionId,
          clerkUserId: userId,
          npi,
          opportunityId,
          action,
          source: 'web',
          surface: 'deck',
          opportunityVersion,
          recommendationId,
          sessionId,
          reason,
          clientSignalId,
        },
      }),
    ];

    if (shouldAudit(action)) {
      writes.push(
        prisma.auditEvent.create({
          data: {
            id: randomUUID(),
            type: 'matcha.deck_signal',
            hash,
            referenceId: opportunityId,
            clinicianId: npi,
            metadata: {
              action,
              actionId,
              // Actor attribution — the authenticated Clerk user, from auth().
              clerkUserId: userId,
              clientSignalId,
              opportunityId,
              opportunityVersion,
              recommendationId,
              recordedAt,
              sessionId,
              source: 'web',
              surface: 'deck',
            },
          },
        }),
      );
    }

    await prisma.$transaction(writes);
    return NextResponse.json({ ok: true, persisted: true, duplicate: false, action });
  } catch (err) {
    // A unique-constraint violation here means a concurrent retry won the race
    // — the intent IS recorded, which is exactly what idempotency promises.
    if ((err as { code?: string })?.code === 'P2002') {
      return NextResponse.json({ ok: true, persisted: true, duplicate: true, action });
    }
    console.error('[matcha/deck/signal POST]', err);
    // Best-effort: never break the deck. The client keeps its in-memory state
    // and retries; the response says plainly that nothing was saved.
    return NextResponse.json({ ok: false, persisted: false, action }, { status: 200 });
  }
}
