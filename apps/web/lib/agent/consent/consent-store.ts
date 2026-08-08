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
import {
  isStandingEligibleScope,
  POINT_CONSENT_WINDOW_MINUTES,
  STANDING_CONSENT_MAX_DAYS,
  type AgentConsentState,
  type ConsentEventKind,
  type ConsentKind,
  type ConsentProof,
} from './types';

/** Contention retries. Each retry re-reads the head, so this converges fast. */
const MAX_APPEND_ATTEMPTS = 5;

export interface ConsentWriteInput {
  subjectRef: string;
  /** Server-derived. Never accepted from a client. */
  scope: string;
  actionId?: string;
  planId?: string;
  /** Defaults to `point` — A1's behaviour and the safe default. */
  kind?: ConsentKind;
  /** Injected clock; standing expiry is computed from it. */
  now?: Date;
}

/** Refusals a consent write can produce without persisting anything. */
export type ConsentWriteRefusal = 'standing_scope_not_eligible';

export interface ConsentWriteResult {
  persisted: boolean;
  eventId: string | null;
  /** True when the head state actually changed (idempotent-safe callers). */
  changed: boolean;
  /** Serialized position of the governing event. */
  seq: number | null;
  refusal?: ConsentWriteRefusal;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether a granted head is still usable for minting a proof.
 *
 * Expiry is a READ-TIME PREDICATE. Nothing sweeps the table to mark grants
 * expired — a background writer racing the head is exactly the ambiguity the
 * `seq` design exists to prevent — so this is evaluated against an injected
 * clock every time a proof is asked for.
 */
export function consentLapsed(input: {
  kind: ConsentKind;
  grantedAt: Date;
  expiresAt: Date | null;
  now: Date;
}): boolean {
  if (input.kind === 'standing') {
    // A standing grant with no expiry is a data fault, not permission.
    if (!input.expiresAt) return true;
    return input.now.getTime() >= input.expiresAt.getTime();
  }
  return input.now.getTime() - input.grantedAt.getTime() >= POINT_CONSENT_WINDOW_MINUTES * 60_000;
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
  const consentKind: ConsentKind = input.kind ?? 'point';
  const now = input.now ?? new Date();

  // Structural: a disclosing scope can never be held standing, whatever the
  // caller asks for. An allowlist, so a new scope is non-standing until
  // someone deliberately adds it — the safe direction for a list whose
  // failure mode is "the agent shared something in the background".
  if (kind === 'granted' && consentKind === 'standing' && !isStandingEligibleScope(input.scope)) {
    return {
      persisted: false,
      eventId: null,
      changed: false,
      seq: null,
      refusal: 'standing_scope_not_eligible',
    };
  }

  const expiresAt =
    kind === 'granted' && consentKind === 'standing'
      ? new Date(now.getTime() + STANDING_CONSENT_MAX_DAYS * DAY_MS)
      : null;

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
          consentKind,
          expiresAt: expiresAt?.toISOString() ?? null,
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
              consentKind,
              ...(expiresAt ? { expiresAt: expiresAt.toISOString() } : {}),
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
            consentKind,
            expiresAt,
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
  const now = new Date();
  return [...heads.values()]
    .map((event) => {
      const kind = (event.consentKind === 'standing' ? 'standing' : 'point') as ConsentKind;
      const granted = event.kind === 'granted';
      return {
        scope: event.scope,
        granted,
        kind,
        ...(event.expiresAt ? { expiresAt: event.expiresAt.toISOString() } : {}),
        // `lapsed` is distinct from `granted: false`. The clinician DID
        // approve; the approval simply is not usable now. The honest surface
        // is "renew", not "you never agreed".
        lapsed:
          granted &&
          consentLapsed({ kind, grantedAt: event.createdAt, expiresAt: event.expiresAt, now }),
        eventRef: event.id,
        seq: event.seq,
        at: event.createdAt.toISOString(),
      };
    })
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

  // Freshness is evaluated HERE, at proof time, against the injected clock —
  // never by a sweeper that would race the head. A point consent past its
  // window and a standing grant past its expiry both stop minting proofs
  // while their ledger rows stay exactly where they are.
  const kind = (head.consentKind === 'standing' ? 'standing' : 'point') as ConsentKind;
  if (
    consentLapsed({
      kind,
      grantedAt: head.createdAt,
      expiresAt: head.expiresAt,
      now: new Date(now),
    })
  ) {
    return null;
  }

  return {
    consentId: head.id,
    subjectRef,
    scope,
    kind,
    grantedAt: head.createdAt.toISOString(),
    ...(head.expiresAt ? { expiresAt: head.expiresAt.toISOString() } : {}),
    verifiedAt: now,
  };
}
