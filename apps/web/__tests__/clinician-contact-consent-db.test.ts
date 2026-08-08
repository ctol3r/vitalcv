/**
 * N1 — clinician contact-consent ledger against a REAL Postgres.
 *
 * Same discipline as the agent consent ledger: append-only, seq-serialized,
 * audit-paired, and strict on failure. Gated on DATABASE_URL; wired into the
 * web-quality DB step in ci.yml.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';

const SKIP = !process.env.DATABASE_URL;

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', async () => {
  const { PrismaClient } = await import('../lib/generated/prisma');
  return {
    prisma: new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL ?? '' } } }),
  };
});

const RUN = randomUUID().slice(0, 8);
const NPIS = new Set<string>();
let counter = 0;
function npiFor(): string {
  counter += 1;
  const npi = `8${String(counter).padStart(4, '0')}${RUN.slice(0, 5)}`.slice(0, 10);
  NPIS.add(npi);
  return npi;
}

describe.skipIf(SKIP)('clinician contact consent ledger (real Postgres)', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let store: typeof import('@/lib/clinician-notifications/consent-store');
  let prefs: typeof import('@/lib/clinician-notifications/preferences');

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    store = await import('@/lib/clinician-notifications/consent-store');
    prefs = await import('@/lib/clinician-notifications/preferences');
  });

  afterAll(async () => {
    if (SKIP) return;
    const refs = [...NPIS];
    const events = await prisma.clinicianContactConsentEvent.findMany({
      where: { clinicianNpi: { in: refs } },
    });
    await prisma.auditEvent.deleteMany({ where: { referenceId: { in: events.map((e) => e.id) } } });
    await prisma.clinicianContactConsentEvent.deleteMany({ where: { clinicianNpi: { in: refs } } });
    await prisma.clinicianNotificationPreference.deleteMany({ where: { clinicianNpi: { in: refs } } });
    await prisma.$disconnect();
  });

  it('records a grant at seq 1 with a paired audit row', async () => {
    const npi = npiFor();
    const result = await store.grantContactConsent({
      clinicianNpi: npi,
      channel: 'EMAIL',
      grantSource: 'holder_settings',
    });
    expect(result).toMatchObject({ persisted: true, changed: true, seq: 1 });

    const row = await prisma.clinicianContactConsentEvent.findFirst({
      where: { clinicianNpi: npi },
    });
    expect(row?.kind).toBe('granted');
    expect(row?.grantSource).toBe('holder_settings');
    expect(row?.eventHash).toMatch(/^[0-9a-f]{64}$/);

    const audit = await prisma.auditEvent.findFirst({
      where: { type: 'clinician.contact_consent_granted', referenceId: row!.id },
    });
    expect(audit).not.toBeNull();
  });

  it('is idempotent in both directions', async () => {
    const npi = npiFor();
    await store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' });
    expect(await store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' })).toMatchObject({
      persisted: true,
      changed: false,
    });
    await store.revokeContactConsent({ clinicianNpi: npi, channel: 'EMAIL' });
    expect(await store.revokeContactConsent({ clinicianNpi: npi, channel: 'EMAIL' })).toMatchObject({
      persisted: true,
      changed: false,
    });
    expect(
      await prisma.clinicianContactConsentEvent.count({ where: { clinicianNpi: npi } }),
    ).toBe(2);
  });

  it('revoking an ungranted channel is a no-op, not an error', async () => {
    const npi = npiFor();
    expect(await store.revokeContactConsent({ clinicianNpi: npi, channel: 'EMAIL' })).toMatchObject({
      persisted: true,
      changed: false,
      seq: null,
    });
    expect(await prisma.clinicianContactConsentEvent.count({ where: { clinicianNpi: npi } })).toBe(0);
  });

  it('supports the full grant → revoke → re-grant cycle with distinct hashes', async () => {
    const npi = npiFor();
    await store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' });
    await store.revokeContactConsent({ clinicianNpi: npi, channel: 'EMAIL' });
    await store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' });

    const rows = await prisma.clinicianContactConsentEvent.findMany({
      where: { clinicianNpi: npi },
      orderBy: { seq: 'asc' },
    });
    expect(rows.map((r) => r.kind)).toEqual(['granted', 'revoked', 'granted']);
    expect(rows.map((r) => r.seq)).toEqual([1, 2, 3]);
    expect(new Set(rows.map((r) => r.eventHash)).size).toBe(3);

    const states = await store.readContactConsentStates(npi);
    expect(states).toEqual([
      expect.objectContaining({ channel: 'EMAIL', granted: true, seq: 3 }),
    ]);
  });

  it('serializes concurrent grants — one transition, never ambiguity', async () => {
    const npi = npiFor();
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' }),
      ),
    );
    expect(results.every((r) => r.persisted)).toBe(true);
    expect(results.filter((r) => r.changed)).toHaveLength(1);

    const rows = await prisma.clinicianContactConsentEvent.findMany({ where: { clinicianNpi: npi } });
    expect(rows).toHaveLength(1);
    expect(rows[0].seq).toBe(1);
  });

  it('grant vs revoke races land in a definite order with dense seq', async () => {
    const npi = npiFor();
    await Promise.all([
      store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' }),
      store.revokeContactConsent({ clinicianNpi: npi, channel: 'EMAIL' }),
      store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' }),
    ]);
    const rows = await prisma.clinicianContactConsentEvent.findMany({
      where: { clinicianNpi: npi },
      orderBy: { seq: 'asc' },
    });
    expect(rows.map((r) => r.seq)).toEqual(rows.map((_, i) => i + 1));
    rows.slice(1).forEach((row, i) => expect(row.kind).not.toBe(rows[i].kind));

    const head = rows[rows.length - 1];
    const states = await store.readContactConsentStates(npi);
    expect(states[0].granted).toBe(head.kind === 'granted');
    expect(states[0].seq).toBe(head.seq);
  });

  it('a failed write creates neither consent nor a partial audit row', async () => {
    const npi = npiFor();
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "clinician_contact_consent_events" ADD CONSTRAINT "tmp_n1_probe" CHECK (clinician_npi <> '${npi}')`,
    );
    try {
      expect(await store.grantContactConsent({ clinicianNpi: npi, channel: 'EMAIL' })).toMatchObject({
        persisted: false,
        eventRef: null,
        changed: false,
      });
    } finally {
      await prisma.$executeRawUnsafe(
        `ALTER TABLE "clinician_contact_consent_events" DROP CONSTRAINT "tmp_n1_probe"`,
      );
    }
    expect(await prisma.clinicianContactConsentEvent.count({ where: { clinicianNpi: npi } })).toBe(0);
    const audits = await prisma.auditEvent.findMany({
      where: { type: 'clinician.contact_consent_granted' },
      select: { metadata: true, referenceId: true },
    });
    for (const audit of audits) {
      const target = await prisma.clinicianContactConsentEvent.findUnique({
        where: { id: audit.referenceId ?? '' },
      });
      expect(target, 'audit row references no consent event').not.toBeNull();
    }
  });
});

describe.skipIf(SKIP)('notification preferences', () => {
  let prisma: import('../lib/generated/prisma').PrismaClient;
  let prefs: typeof import('@/lib/clinician-notifications/preferences');

  beforeAll(async () => {
    prisma = (await import('@/lib/db')).prisma as never;
    prefs = await import('@/lib/clinician-notifications/preferences');
  });

  it('defaults conservatively when no row exists', async () => {
    const npi = npiFor();
    const preference = await prefs.readNotificationPreference(npi);
    expect(preference).toMatchObject({
      severityFloor: 'HIGH',
      suppressionWindowMinutes: 1440,
      active: true,
      isDefault: true,
    });
  });

  it('clamps a suppression window rather than rejecting it', async () => {
    const npi = npiFor();
    const tooSmall = await prefs.updateNotificationPreference({
      clinicianNpi: npi,
      suppressionWindowMinutes: 5,
    });
    expect(tooSmall.preference.suppressionWindowMinutes).toBe(60);

    const tooLarge = await prefs.updateNotificationPreference({
      clinicianNpi: npi,
      suppressionWindowMinutes: 999_999,
    });
    expect(tooLarge.preference.suppressionWindowMinutes).toBe(20160);
  });

  it('persists a severity floor and an inactive flag', async () => {
    const npi = npiFor();
    const result = await prefs.updateNotificationPreference({
      clinicianNpi: npi,
      severityFloor: 'CRITICAL',
      active: false,
    });
    expect(result.persisted).toBe(true);
    const read = await prefs.readNotificationPreference(npi);
    expect(read).toMatchObject({ severityFloor: 'CRITICAL', active: false, isDefault: false });
  });
});
