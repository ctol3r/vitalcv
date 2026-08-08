/**
 * Agent consent ledger — Prisma-backed store over `agent_consent_events`.
 *
 * Append-only granted/revoked events. Current state is the highest-`seq`
 * event for a (subjectRef, scope).
 *
 * ## Serialization
 *
 * Ordering is NOT decided by `created_at` (millisecond resolution, ties are
 * real) or by uuid tiebreak (random, so a "latest" chosen that way is
 * arbitrary). Each event carries a per-(subjectRef, scope) monotonic `seq`
 * under a DB unique constraint `(subject_ref, scope, seq)`. Appending reads
 * the current head and inserts at `head.seq + 1` inside one interactive
 * transaction; two concurrent appends therefore compute the same `seq` and
 * exactly one survives — the loser takes a unique violation, rolls back
 * whole (audit row included), and retries against the new head.
 *
 * The consequences that matter:
 *  - concurrent grants cannot produce ambiguous state — the retry re-reads
 *    the head, sees `granted`, and returns a no-change idempotent result;
 *  - grant-vs-revoke and revoke-vs-re-grant always land in a definite order
 *    with both events recorded and a single unambiguous head;
 *  - `verifyAgentConsent` reads that head, so it can never mint a proof from
 *    a stale or arbitrarily-ordered row.
 *
 * ## Atomicity
 *
 * Every write pairs an AuditEvent in the SAME transaction, audit-first
 * (mirroring `createConsentGrantInTransaction`). If either insert fails,
 * neither lands: no authorization without its audit row, and no audit row
 * implying an authorization that does not exist.
 *
 * ## Strictness
 *
 * Unlike telemetry, consent writes never degrade to ok. A write that does
 * not persist returns `persisted: false` and the route answers 503.
 *
 * This ledger is the authorization layer ("may the agent run this?"). The
 * immutable disclosure record for an exercised share remains the canonical
 * capability's own record; execution events reference those ids in metadata.
 * Revoking a scope gates FUTURE agent execution only — it never recalls a
 * share that already ran.
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { stableStringify } from '../ids';
import type { AgentConsentState, ConsentEventKind, ConsentProof } from './types';

/** Contention retries. Each retry re-reads the head, so this converges fast. */
const MAX_APPEND_ATTEMPTS = 5;

export interface ConsentWriteInput {
  subjectRef: string;
  /** Server-derived. Never accepted from a client. */
  scope: string;
  actionId?: string;
  planId?: string;
}

export interface ConsentWriteResult {
  persisted: boolean;
  eventId: string | null;
  /** True when the head state actually changed (idempotent-safe callers). */
  changed: boolean;
  /** Serialized position of the governing event. */
  seq: number | null;
}

function eventHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'P2002';
}

/**
 * Append one transition, or return a no-change result when the head already
 * holds the desired state. The head read and the insert share a transaction,
 * so the idempotency decision cannot be made against a stale head.
 */
async function appendTransition(
  kind: ConsentEventKind,
  input: ConsentWriteInput,
): Promise<ConsentWriteResult> {
  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const head = await tx.agentConsentEvent.findFirst({
          where: { subjectRef: input.subjectRef, scope: input.scope },
          orderBy: { seq: 'desc' },
        });

        const currentlyGranted = head?.kind === 'granted';
        const wantGranted = kind === 'granted';
        if (currentlyGranted === wantGranted) {
          // Already in the desired state. Revoking an unknown scope is also
          // a no-op here (head is null → not granted → nothing to revoke).
          return {
            persisted: true,
            eventId: head?.id ?? null,
            changed: false,
            seq: head?.seq ?? null,
          };
        }

        const id = randomUUID();
        const seq = (head?.seq ?? 0) + 1;
        const hash = eventHash({
          id,
          seq,
          subjectRef: input.subjectRef,
          scope: input.scope,
          kind,
          actionId: input.actionId ?? null,
          planId: input.planId ?? null,
        });

        await tx.auditEvent.create({
          data: {
            id: randomUUID(),
            type: kind === 'granted' ? 'agent.consent_granted' : 'agent.consent_revoked',
            hash,
            referenceId: id,
            metadata: {
              scope: input.scope,
              seq,
              ...(input.actionId ? { actionId: input.actionId } : {}),
              ...(input.planId ? { planId: input.planId } : {}),
            },
          },
        });

        await tx.agentConsentEvent.create({
          data: {
            id,
            subjectRef: input.subjectRef,
            scope: input.scope,
            kind,
            seq,
            eventHash: hash,
            actionId: input.actionId ?? null,
            planId: input.planId ?? null,
          },
        });

        return { persisted: true, eventId: id, changed: true, seq };
      });
    } catch (error) {
      // Lost the race for this seq — the whole transaction (audit row
      // included) rolled back. Re-read the head and try again.
      if (isUniqueViolation(error) && attempt < MAX_APPEND_ATTEMPTS - 1) continue;
      return { persisted: false, eventId: null, changed: false, seq: null };
    }
  }
  return { persisted: false, eventId: null, changed: false, seq: null };
}

/** Record a grant. Idempotent over an already-granted scope. */
export async function grantAgentConsent(input: ConsentWriteInput): Promise<ConsentWriteResult> {
  return appendTransition('granted', input);
}

/** Record a revocation. No-op when the scope is not currently granted. */
export async function revokeAgentConsent(input: ConsentWriteInput): Promise<ConsentWriteResult> {
  return appendTransition('revoked', input);
}

/** Fold the ledger into current per-scope states for a subject. */
export async function readAgentConsentStates(subjectRef: string): Promise<AgentConsentState[]> {
  const events = await prisma.agentConsentEvent.findMany({
    where: { subjectRef },
    orderBy: { seq: 'asc' },
  });
  const heads = new Map<string, (typeof events)[number]>();
  for (const event of events) heads.set(event.scope, event);
  return [...heads.values()]
    .map((event) => ({
      scope: event.scope,
      granted: event.kind === 'granted',
      eventRef: event.id,
      seq: event.seq,
      at: event.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
}

/**
 * Resolve a server-issued consent reference (the `eventRef` handed out by
 * the read surface) back to its scope, scoped to the subject. Returns null
 * for an unknown ref or one belonging to another subject — the revoke path
 * uses this so a client can never introduce a scope string of its own.
 */
export async function resolveConsentScopeByRef(
  subjectRef: string,
  eventRef: string,
): Promise<string | null> {
  const row = await prisma.agentConsentEvent.findFirst({
    where: { id: eventRef, subjectRef },
    select: { scope: true },
  });
  return row?.scope ?? null;
}

/**
 * Re-read the head and mint a ConsentProof — the ONLY constructor of proofs.
 * Returns null unless the CURRENT head for the scope is `granted`, so a
 * revocation landing between plan generation and execution is honored.
 */
export async function verifyAgentConsent(
  subjectRef: string,
  scope: string,
  now: string,
): Promise<ConsentProof | null> {
  const head = await prisma.agentConsentEvent.findFirst({
    where: { subjectRef, scope },
    orderBy: { seq: 'desc' },
  });
  if (!head || head.kind !== 'granted') return null;
  return {
    consentId: head.id,
    subjectRef,
    scope,
    grantedAt: head.createdAt.toISOString(),
    verifiedAt: now,
  };
}
