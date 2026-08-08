/**
 * A1 — agent consent ledger against a REAL Postgres. Gated on DATABASE_URL,
 * scoped cleanup, wired into the web-quality DB step in ci.yml.
 *
 * Two things are under test: the ledger semantics the Level-3 gate rests on
 * (append-only, revocable, re-grantable, isolated, audit-paired), and the
 * SERIALIZATION of concurrent transitions. The concurrency cases fire real
 * simultaneous transactions — the unique constraint on
 * (subject_ref, scope, seq) is what makes their outcome definite.
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

const RUN = randomUUID().slice(0, 8);
const SUBJECT = `consent-subject-${RUN}`;
const SCOPE = 'share_packet:opportunity:opp-42';
const OTHER_SCOPE = 'private_holdings_access:self';
const NOW = '2026-08-07T00:00:00.000Z';

/** Every subject this suite creates, so cleanup stays scoped. */
const SUBJECTS = new Set<string>([SUBJECT]);
function subject(suffix: string): string {
  const ref = `${SUBJECT}-${suffix}`;
  SUBJECTS.add(ref);
  return ref;
}

describe.skipIf(SKIP)('agent consent ledger (real Postgres)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let store: typeof import('@/lib/agent/consent/consent-store');

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    store = await import('@/lib/agent/consent/consent-store');
  });

  afterAll(async () => {
    if (SKIP) return;
    const refs = [...SUBJECTS];
    const events = await prisma.agentConsentEvent.findMany({ where: { subjectRef: { in: refs } } });
    await prisma.auditEvent.deleteMany({ where: { referenceId: { in: events.map((e) => e.id) } } });
    await prisma.agentConsentEvent.deleteMany({ where: { subjectRef: { in: refs } } });
    await prisma.$disconnect();
  });

  describe('ledger semantics', () => {
    it('records a grant at seq 1 with a paired audit row and mints a proof', async () => {
      const result = await store.grantAgentConsent({ subjectRef: SUBJECT, scope: SCOPE, planId: 'plan_x' });
      expect(result).toMatchObject({ persisted: true, changed: true, seq: 1 });

      const row = await prisma.agentConsentEvent.findFirst({ where: { subjectRef: SUBJECT, scope: SCOPE } });
      expect(row?.kind).toBe('granted');
      expect(row?.seq).toBe(1);
      expect(row?.eventHash).toMatch(/^[0-9a-f]{64}$/);

      const audit = await prisma.auditEvent.findFirst({
        where: { type: 'agent.consent_granted', referenceId: row!.id },
      });
      expect(audit).not.toBeNull();

      const proof = await store.verifyAgentConsent(SUBJECT, SCOPE, NOW);
      expect(proof).toMatchObject({ scope: SCOPE, consentId: row!.id, verifiedAt: NOW });
    });

    it('is idempotent over an already-granted scope', async () => {
      const before = await prisma.agentConsentEvent.count({ where: { subjectRef: SUBJECT, scope: SCOPE } });
      const result = await store.grantAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
      expect(result).toMatchObject({ persisted: true, changed: false });
      const after = await prisma.agentConsentEvent.count({ where: { subjectRef: SUBJECT, scope: SCOPE } });
      expect(after).toBe(before);
    });

    it('revokes by appending — the grant row survives and no proof is minted', async () => {
      const revoke = await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
      expect(revoke).toMatchObject({ persisted: true, changed: true, seq: 2 });

      const rows = await prisma.agentConsentEvent.findMany({
        where: { subjectRef: SUBJECT, scope: SCOPE },
        orderBy: { seq: 'asc' },
      });
      expect(rows.map((r) => r.kind)).toEqual(['granted', 'revoked']);
      expect(await store.verifyAgentConsent(SUBJECT, SCOPE, NOW)).toBeNull();
    });

    it('is idempotent over an already-revoked scope', async () => {
      const before = await prisma.agentConsentEvent.count({ where: { subjectRef: SUBJECT, scope: SCOPE } });
      const result = await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
      expect(result).toMatchObject({ persisted: true, changed: false });
      expect(
        await prisma.agentConsentEvent.count({ where: { subjectRef: SUBJECT, scope: SCOPE } }),
      ).toBe(before);
    });

    it('supports re-grant after revoke as a distinct event', async () => {
      const regrant = await store.grantAgentConsent({ subjectRef: SUBJECT, scope: SCOPE });
      expect(regrant).toMatchObject({ persisted: true, changed: true, seq: 3 });

      const rows = await prisma.agentConsentEvent.findMany({
        where: { subjectRef: SUBJECT, scope: SCOPE },
        orderBy: { seq: 'asc' },
      });
      expect(rows.map((r) => r.kind)).toEqual(['granted', 'revoked', 'granted']);
      // Distinct hashes prove the cycle is representable (the grant-hash trap).
      expect(new Set(rows.map((r) => r.eventHash)).size).toBe(3);
      expect(await store.verifyAgentConsent(SUBJECT, SCOPE, NOW)).not.toBeNull();
    });

    it('resolves a server-issued consentRef to its scope, scoped to the subject', async () => {
      const states = await store.readAgentConsentStates(SUBJECT);
      const head = states.find((s) => s.scope === SCOPE)!;
      expect(await store.resolveConsentScopeByRef(SUBJECT, head.eventRef)).toBe(SCOPE);
      // Another subject cannot resolve — and therefore cannot revoke — it.
      expect(await store.resolveConsentScopeByRef(subject('stranger'), head.eventRef)).toBeNull();
      expect(await store.resolveConsentScopeByRef(SUBJECT, randomUUID())).toBeNull();
    });

    it('folds per scope independently and never leaks across subjects', async () => {
      await store.grantAgentConsent({ subjectRef: SUBJECT, scope: OTHER_SCOPE });
      await store.revokeAgentConsent({ subjectRef: SUBJECT, scope: OTHER_SCOPE });

      const states = await store.readAgentConsentStates(SUBJECT);
      expect(states.find((s) => s.scope === SCOPE)?.granted).toBe(true);
      expect(states.find((s) => s.scope === OTHER_SCOPE)?.granted).toBe(false);
      expect(await store.verifyAgentConsent(SUBJECT, OTHER_SCOPE, NOW)).toBeNull();
      expect(await store.verifyAgentConsent(subject('other'), SCOPE, NOW)).toBeNull();
    });
  });

  describe('serialized transitions', () => {
    it('simultaneous grants cannot create ambiguous state', async () => {
      const ref = subject('race-grant');
      const results = await Promise.all(
        Array.from({ length: 8 }, () => store.grantAgentConsent({ subjectRef: ref, scope: SCOPE })),
      );
      expect(results.every((r) => r.persisted)).toBe(true);
      // Exactly one transition happened; the rest observed it and no-op'd.
      expect(results.filter((r) => r.changed)).toHaveLength(1);

      const rows = await prisma.agentConsentEvent.findMany({ where: { subjectRef: ref, scope: SCOPE } });
      expect(rows).toHaveLength(1);
      expect(rows[0].seq).toBe(1);
      expect(await store.verifyAgentConsent(ref, SCOPE, NOW)).not.toBeNull();
    });

    it('grant vs revoke has a deterministic final ordering', async () => {
      const ref = subject('race-grant-revoke');
      const [grant, revoke] = await Promise.all([
        store.grantAgentConsent({ subjectRef: ref, scope: SCOPE }),
        store.revokeAgentConsent({ subjectRef: ref, scope: SCOPE }),
      ]);
      expect(grant.persisted && revoke.persisted).toBe(true);

      const rows = await prisma.agentConsentEvent.findMany({
        where: { subjectRef: ref, scope: SCOPE },
        orderBy: { seq: 'asc' },
      });
      // seq is dense and gapless whatever the interleaving, and the head is
      // unambiguous — never two rows claiming the same position.
      expect(rows.map((r) => r.seq)).toEqual(rows.map((_, i) => i + 1));
      expect(new Set(rows.map((r) => r.seq)).size).toBe(rows.length);

      const head = rows[rows.length - 1];
      const proof = await store.verifyAgentConsent(ref, SCOPE, NOW);
      // The proof agrees with the serialized head, whichever way it landed.
      expect(proof !== null).toBe(head.kind === 'granted');
    });

    it('revoke vs re-grant has a deterministic final ordering', async () => {
      const ref = subject('race-revoke-regrant');
      await store.grantAgentConsent({ subjectRef: ref, scope: SCOPE });

      await Promise.all([
        store.revokeAgentConsent({ subjectRef: ref, scope: SCOPE }),
        store.grantAgentConsent({ subjectRef: ref, scope: SCOPE }),
        store.revokeAgentConsent({ subjectRef: ref, scope: SCOPE }),
      ]);

      const rows = await prisma.agentConsentEvent.findMany({
        where: { subjectRef: ref, scope: SCOPE },
        orderBy: { seq: 'asc' },
      });
      expect(rows.map((r) => r.seq)).toEqual(rows.map((_, i) => i + 1));
      // No two adjacent events repeat a state — every row is a real transition.
      rows.slice(1).forEach((row, i) => expect(row.kind).not.toBe(rows[i].kind));

      const head = rows[rows.length - 1];
      const proof = await store.verifyAgentConsent(ref, SCOPE, NOW);
      expect(proof !== null).toBe(head.kind === 'granted');
      const states = await store.readAgentConsentStates(ref);
      expect(states.find((s) => s.scope === SCOPE)?.seq).toBe(head.seq);
    });

    it('concurrent writes across scopes and subjects stay isolated', async () => {
      const a = subject('iso-a');
      const b = subject('iso-b');
      await Promise.all([
        store.grantAgentConsent({ subjectRef: a, scope: SCOPE }),
        store.grantAgentConsent({ subjectRef: a, scope: OTHER_SCOPE }),
        store.grantAgentConsent({ subjectRef: b, scope: SCOPE }),
      ]);
      // Each (subject, scope) numbers from 1 independently.
      for (const [ref, scope] of [[a, SCOPE], [a, OTHER_SCOPE], [b, SCOPE]] as const) {
        const rows = await prisma.agentConsentEvent.findMany({ where: { subjectRef: ref, scope } });
        expect(rows).toHaveLength(1);
        expect(rows[0].seq).toBe(1);
      }
      await store.revokeAgentConsent({ subjectRef: a, scope: SCOPE });
      // Revoking one scope leaves the neighbours untouched.
      expect(await store.verifyAgentConsent(a, SCOPE, NOW)).toBeNull();
      expect(await store.verifyAgentConsent(a, OTHER_SCOPE, NOW)).not.toBeNull();
      expect(await store.verifyAgentConsent(b, SCOPE, NOW)).not.toBeNull();
    });

    it('a failed write creates neither authorization nor a partial audit row', async () => {
      const ref = subject('atomic');
      // A scope unique to this run, so the audit assertion below cannot be
      // perturbed by consent rows other suites write concurrently.
      const isolatedScope = `share_packet:opportunity:atomic-${RUN}`;

      // Force the consent insert (the SECOND statement in the transaction) to
      // fail. A non-atomic implementation would leave the audit row behind,
      // and an audit row is what an authorization looks like after the fact.
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "agent_consent_events" ADD CONSTRAINT "tmp_atomicity_probe" CHECK (subject_ref <> '${ref}')`,
      );
      try {
        const result = await store.grantAgentConsent({ subjectRef: ref, scope: isolatedScope });
        expect(result).toMatchObject({ persisted: false, eventId: null, changed: false });
      } finally {
        await prisma.$executeRawUnsafe(
          `ALTER TABLE "agent_consent_events" DROP CONSTRAINT "tmp_atomicity_probe"`,
        );
      }

      // No authorization, no event, and no audit row for this scope.
      expect(await store.verifyAgentConsent(ref, isolatedScope, NOW)).toBeNull();
      expect(await prisma.agentConsentEvent.count({ where: { subjectRef: ref } })).toBe(0);
      const auditRows = await prisma.auditEvent.findMany({
        where: { type: 'agent.consent_granted' },
        select: { metadata: true },
      });
      const forThisScope = auditRows.filter(
        (row) => (row.metadata as { scope?: string } | null)?.scope === isolatedScope,
      );
      expect(forThisScope).toHaveLength(0);
    });
  });
});
