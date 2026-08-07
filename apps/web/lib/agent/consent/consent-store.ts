/**
 * Agent consent ledger — Prisma-backed store over `agent_consent_events`.
 *
 * Append-only granted/revoked events; current state is a fold over the
 * latest event per (subjectRef, scope). Every write pairs an AuditEvent in
 * the SAME transaction (audit-first, mirroring the canonical
 * createConsentGrantInTransaction ordering). Unlike telemetry, consent
 * writes are STRICT: a grant that fails to persist reports failure — there
 * is no degrade-to-ok path for an authorization.
 *
 * This ledger is the authorization layer ("may the agent run this?"). The
 * immutable disclosure record for an exercised share remains the canonical
 * capability's own record (e.g. the apply-share bundle + audit trail);
 * execution events reference those ids in metadata. Revoking a scope here
 * gates FUTURE agent execution only — it never recalls a share that already
 * ran.
 */
import { createHash, randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { stableStringify } from '../ids';
import { CONSENT_EVENT_KINDS, type AgentConsentState, type ConsentProof } from './types';

export interface GrantConsentInput {
  subjectRef: string;
  scope: string;
  actionId?: string;
  planId?: string;
}

export interface ConsentWriteResult {
  persisted: boolean;
  eventId: string | null;
  /** True when the fold state actually changed (idempotent-safe callers). */
  changed: boolean;
}

function eventHash(payload: Record<string, unknown>): string {
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}

async function latestEvent(subjectRef: string, scope: string) {
  return prisma.agentConsentEvent.findFirst({
    where: { subjectRef, scope },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

async function appendConsentEvent(
  kind: (typeof CONSENT_EVENT_KINDS)[number],
  input: GrantConsentInput,
): Promise<ConsentWriteResult> {
  const id = randomUUID();
  const hash = eventHash({
    id,
    subjectRef: input.subjectRef,
    scope: input.scope,
    kind,
    actionId: input.actionId ?? null,
    planId: input.planId ?? null,
  });
  try {
    await prisma.$transaction([
      prisma.auditEvent.create({
        data: {
          id: randomUUID(),
          type: kind === 'granted' ? 'agent.consent_granted' : 'agent.consent_revoked',
          hash,
          referenceId: id,
          metadata: {
            scope: input.scope,
            ...(input.actionId ? { actionId: input.actionId } : {}),
            ...(input.planId ? { planId: input.planId } : {}),
          },
        },
      }),
      prisma.agentConsentEvent.create({
        data: {
          id,
          subjectRef: input.subjectRef,
          scope: input.scope,
          kind,
          eventHash: hash,
          actionId: input.actionId ?? null,
          planId: input.planId ?? null,
        },
      }),
    ]);
    return { persisted: true, eventId: id, changed: true };
  } catch {
    return { persisted: false, eventId: null, changed: false };
  }
}

/** Record a grant. Idempotent over an already-granted scope (no new event). */
export async function grantAgentConsent(input: GrantConsentInput): Promise<ConsentWriteResult> {
  const current = await latestEvent(input.subjectRef, input.scope);
  if (current?.kind === 'granted') {
    return { persisted: true, eventId: current.id, changed: false };
  }
  return appendConsentEvent('granted', input);
}

/** Record a revocation. No-op when the scope is not currently granted. */
export async function revokeAgentConsent(input: GrantConsentInput): Promise<ConsentWriteResult> {
  const current = await latestEvent(input.subjectRef, input.scope);
  if (!current || current.kind === 'revoked') {
    return { persisted: true, eventId: current?.id ?? null, changed: false };
  }
  return appendConsentEvent('revoked', input);
}

/** Fold the ledger into current per-scope states for a subject. */
export async function readAgentConsentStates(subjectRef: string): Promise<AgentConsentState[]> {
  const events = await prisma.agentConsentEvent.findMany({
    where: { subjectRef },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  });
  const byScope = new Map<string, (typeof events)[number]>();
  for (const event of events) byScope.set(event.scope, event);
  return [...byScope.values()]
    .map((event) => ({
      scope: event.scope,
      granted: event.kind === 'granted',
      eventRef: event.id,
      at: event.createdAt.toISOString(),
    }))
    .sort((a, b) => (a.scope < b.scope ? -1 : a.scope > b.scope ? 1 : 0));
}

/**
 * Re-read the ledger and mint a ConsentProof — the ONLY constructor of
 * proofs. Returns null unless the CURRENT fold state for the scope is
 * granted; a revocation that lands between plan generation and execution
 * is honored here.
 */
export async function verifyAgentConsent(
  subjectRef: string,
  scope: string,
  now: string,
): Promise<ConsentProof | null> {
  const current = await latestEvent(subjectRef, scope);
  if (!current || current.kind !== 'granted') return null;
  return {
    consentId: current.id,
    subjectRef,
    scope,
    grantedAt: current.createdAt.toISOString(),
    verifiedAt: now,
  };
}
