/**
 * A1 — agent consent ledger against a REAL Postgres. Gated on DATABASE_URL,
 * scoped cleanup, wired into the web-quality DB step in ci.yml.
 *
 * Proves the properties the whole Level-3 gate rests on: append-only,
 * revocable, re-grantable (the cycle ConsentGrant's content-addressed hash
 * cannot express), audit-paired, and that `verifyAgentConsent` mints a proof
 * only while the CURRENT fold says granted.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const DB_URL = process.env.DATABASE_URL;
const SKIP = !DB_URL;

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('../lib/generated/prisma');
  return {
    prisma: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } }),
  };
});

const SUBJECT = `consent-subject-${randomUUID().slice(0, 8)}`;
const SCOPE = 'share_packet:opportunity:opp-42';
const OTHER_SCOPE = 'private_holdings_access:self';
const NOW = '2026-08-07T00:00:00.000Z';

describe.skipIf(SKIP)('agent consent ledger (real Postgres)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let store: typeof import('@/lib/agent/consent/consent-store');

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    store = await import('@/lib/agent/consent/consent-store');
  });

  afterAll(async () => {
    if (SKIP) return;
    const events = await prisma.agentConsentEvent.findMany({ where: { subjectRef: SUBJECT } });
    await prisma.auditEvent.deleteMany({ where: { referenceId: { in: events.map((e) => e.id) } } });
    await prisma.agentConsentEvent.deleteMany({ where: { subjectRef: SUBJECT } });
    await prisma.$disconnect();
  });

  it('records a grant with a paired audit row and mints a proof', async () => {
    const result = await store.grantAgentConsent({ subjectRef: SUBJECT, scope: SCOPE, planId: 'plan_x' });
    expect(result.persisted).toBe(true);
    expect(result.changed).toBe(true);

    const row = await prisma.agentConsentEvent.findFirst({ where: { subjectRef: SUBJECT, scope: SCOPE } });
    expect(row?.kind).toBe('granted');
    expect(row?.eventHash).toMatch(/^[0-9a-f]{64}$/);

    const audit = await prisma.auditEvent.findFirst({
      where: { type: 'agent.consent_granted', referenceId: row!.id },
    });
    expect(audit).not.toBeNull();

    const proof = await store.verifyAgentConsent(SUBJECT, SCOPE, NOW);
    expect(proof).not.toBeNull();
    expect(proof!.scope).toBe(SCOPE);
    expect(proof!.consentId).toBe(row!.id);
    expect(proof!.verifiedAt).toBe(NOW);
  });

  it('is idempotent over an already-granted scope', async () => {
    const before = await prisma.agentConsentEvent.count({ where: { subjectRef: SUBJECT, scope: SCOPE } });
    const result = await store.grantAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
    expect(result.persisted).toBe(true);
    expect(result.changed).toBe(false);
    const after = await prisma.agentConsentEvent.count({ where: { subjectRef: SUBJECT, scope: SCOPE } });
    expect(after).toBe(before);
  });

  it('revokes by appending — the grant row survives and no proof is minted', async () => {
    const revoke = await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
    expect(revoke.persisted).toBe(true);
    expect(revoke.changed).toBe(true);

    const rows = await prisma.agentConsentEvent.findMany({
      where: { subjectRef: SUBJECT, scope: SCOPE },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.kind)).toEqual(['granted', 'revoked']);

    expect(await store.verifyAgentConsent(SUBJECT, SCOPE, NOW)).toBeNull();
    const states = await store.readAgentConsentStates(SUBJECT);
    expect(states.find((s) => s.scope === SCOPE)?.granted).toBe(false);
  });

  it('supports re-grant after revoke as a distinct event', async () => {
    const regrant = await store.grantAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
    expect(regrant.persisted).toBe(true);
    expect(regrant.changed).toBe(true);

    const rows = await prisma.agentConsentEvent.findMany({
      where: { subjectRef: SUBJECT, scope: SCOPE },
      orderBy: { createdAt: 'asc' },
    });
    expect(rows.map((r) => r.kind)).toEqual(['granted', 'revoked', 'granted']);
    // Distinct hashes prove the cycle is representable (the grant-hash trap).
    expect(new Set(rows.map((r) => r.eventHash)).size).toBe(3);
    expect(await store.verifyAgentConsent(SUBJECT, SCOPE, NOW)).not.toBeNull();
  });

  it('folds per scope independently and never leaks across scopes', async () => {
    await store.grantAgentConsent({ subjectRef: SUBJECT, scope: OTHER_SCOPE });
    await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: OTHER_SCOPE });

    const states = await store.readAgentConsentStates(SUBJECT);
    expect(states.find((s) => s.scope === SCOPE)?.granted).toBe(true);
    expect(states.find((s) => s.scope === OTHER_SCOPE)?.granted).toBe(false);
    expect(await store.verifyAgentConsent(SUBJECT, OTHER_SCOPE, NOW)).toBeNull();
    // Another subject's ledger is untouched by this one.
    expect(await store.verifyAgentConsent(`${SUBJECT}-other`, SCOPE, NOW)).toBeNull();
  });

  it('revoking an ungranted scope is a no-op, not an error', async () => {
    const result = await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: 'never_granted:x' });
    expect(result.persisted).toBe(true);
    expect(result.changed).toBe(false);
  });
});
