/**
 * N1 — clinician alert gating against a real Postgres.
 *
 * The point of these tests is that every way of NOT sending is distinct and
 * deliberate. "They said no", "we have no address", "we already told them
 * today", and "this isn't important enough for them" must never collapse
 * into one silent no-op, because an operator staring at zero emails needs to
 * know which one happened.
 */
import { randomUUID } from 'crypto';
import prisma from '../../../graphql/prisma_client';
import {
  claimClinicianAlertSend,
  clinicianAlertDedupeKey,
  resolveClinicianAlertRecipient,
  settleClinicianAlertSend,
} from '../clinicianAlertRecipient';

const RUN = randomUUID().slice(0, 8);
const NPIS: string[] = [];
const USER_IDS: string[] = [];

/** A clinician with a profile, optionally a verified email. */
async function makeClinician(opts: { verifiedEmail?: string | null } = {}): Promise<string> {
  const npi = `9${String(Math.floor(Math.random() * 1e9)).padStart(9, '0')}`;
  const user = await prisma.user.create({
    data: {
      id: randomUUID(),
      email: `n1-${RUN}-${npi}@example.test`,
      clerkUserId: `user_n1_${RUN}_${npi}`,
    },
    select: { id: true },
  });
  USER_IDS.push(user.id);
  await prisma.personProfile.create({
    data: {
      id: randomUUID(),
      userId: user.id,
      npi,
      verifiedEmail: opts.verifiedEmail === undefined ? `clin-${npi}@example.test` : opts.verifiedEmail,
      verifiedEmailAt: opts.verifiedEmail === null ? null : new Date(),
    },
  });
  NPIS.push(npi);
  return npi;
}

async function grant(npi: string, kind: 'granted' | 'revoked', seq: number): Promise<void> {
  await prisma.clinicianContactConsentEvent.create({
    data: {
      id: randomUUID(),
      clinicianNpi: npi,
      channel: 'EMAIL',
      kind,
      seq,
      eventHash: randomUUID().replace(/-/g, ''),
    },
  });
}

afterAll(async () => {
  await prisma.alertDeliveryAttempt.deleteMany({ where: { dedupeKey: { contains: 'clinician:9' } } });
  await prisma.clinicianNotificationPreference.deleteMany({ where: { clinicianNpi: { in: NPIS } } });
  await prisma.clinicianContactConsentEvent.deleteMany({ where: { clinicianNpi: { in: NPIS } } });
  await prisma.personProfile.deleteMany({ where: { npi: { in: NPIS } } });
  await prisma.user.deleteMany({ where: { id: { in: USER_IDS } } });
  await prisma.$disconnect();
});

describe('resolveClinicianAlertRecipient', () => {
  it('refuses when no profile exists for the NPI', async () => {
    const result = await resolveClinicianAlertRecipient('9999999999', 'CRITICAL');
    expect(result).toEqual({ deliverable: false, reason: 'no_profile' });
  });

  it('refuses when there is no verified email, even with consent granted', async () => {
    const npi = await makeClinician({ verifiedEmail: null });
    await grant(npi, 'granted', 1);
    const result = await resolveClinicianAlertRecipient(npi, 'CRITICAL');
    expect(result).toEqual({ deliverable: false, reason: 'no_verified_email' });
  });

  it('refuses when a verified email exists but consent was never granted', async () => {
    // The whole doctrine in one test: an address is not permission.
    const npi = await makeClinician();
    const result = await resolveClinicianAlertRecipient(npi, 'CRITICAL');
    expect(result).toEqual({ deliverable: false, reason: 'consent_not_granted' });
  });

  it('delivers once consent is granted', async () => {
    const npi = await makeClinician();
    await grant(npi, 'granted', 1);
    const result = await resolveClinicianAlertRecipient(npi, 'CRITICAL');
    expect(result).toMatchObject({ deliverable: true, suppressionWindowMinutes: 1440 });
  });

  it('honors a revocation — the latest seq governs, not the newest row order', async () => {
    const npi = await makeClinician();
    await grant(npi, 'granted', 1);
    await grant(npi, 'revoked', 2);
    expect(await resolveClinicianAlertRecipient(npi, 'CRITICAL')).toEqual({
      deliverable: false,
      reason: 'consent_not_granted',
    });
    // …and re-granting restores it.
    await grant(npi, 'granted', 3);
    expect(await resolveClinicianAlertRecipient(npi, 'CRITICAL')).toMatchObject({
      deliverable: true,
    });
  });

  it('respects an inactive preference', async () => {
    const npi = await makeClinician();
    await grant(npi, 'granted', 1);
    await prisma.clinicianNotificationPreference.create({
      data: { id: randomUUID(), clinicianNpi: npi, active: false },
    });
    expect(await resolveClinicianAlertRecipient(npi, 'CRITICAL')).toEqual({
      deliverable: false,
      reason: 'preference_inactive',
    });
  });

  it('respects the severity floor', async () => {
    const npi = await makeClinician();
    await grant(npi, 'granted', 1);
    await prisma.clinicianNotificationPreference.create({
      data: { id: randomUUID(), clinicianNpi: npi, severityFloor: 'CRITICAL' },
    });
    expect(await resolveClinicianAlertRecipient(npi, 'HIGH')).toEqual({
      deliverable: false,
      reason: 'below_severity_floor',
    });
    expect(await resolveClinicianAlertRecipient(npi, 'CRITICAL')).toMatchObject({
      deliverable: true,
    });
  });

  it('respects a channel the clinician deselected', async () => {
    const npi = await makeClinician();
    await grant(npi, 'granted', 1);
    await prisma.clinicianNotificationPreference.create({
      data: { id: randomUUID(), clinicianNpi: npi, channels: [] },
    });
    expect(await resolveClinicianAlertRecipient(npi, 'CRITICAL')).toEqual({
      deliverable: false,
      reason: 'channel_not_selected',
    });
  });

  it('carries the clinician-chosen suppression window through', async () => {
    const npi = await makeClinician();
    await grant(npi, 'granted', 1);
    await prisma.clinicianNotificationPreference.create({
      data: { id: randomUUID(), clinicianNpi: npi, suppressionWindowMinutes: 180 },
    });
    expect(await resolveClinicianAlertRecipient(npi, 'CRITICAL')).toMatchObject({
      deliverable: true,
      suppressionWindowMinutes: 180,
    });
  });
});

describe('send claiming and suppression', () => {
  it('is stable within a window and rolls at the boundary', () => {
    const base = { npi: '1234567893', kind: 'LICENSE_EXPIRED', suppressionWindowMinutes: 60 };
    const t0 = new Date('2026-08-08T10:00:00.000Z');
    const sameWindow = new Date('2026-08-08T10:59:00.000Z');
    const nextWindow = new Date('2026-08-08T11:30:00.000Z');
    expect(clinicianAlertDedupeKey({ ...base, now: t0 })).toBe(
      clinicianAlertDedupeKey({ ...base, now: sameWindow }),
    );
    expect(clinicianAlertDedupeKey({ ...base, now: t0 })).not.toBe(
      clinicianAlertDedupeKey({ ...base, now: nextWindow }),
    );
  });

  it('separates distinct credentials and kinds', () => {
    const now = new Date('2026-08-08T10:00:00.000Z');
    const base = { npi: '1234567893', suppressionWindowMinutes: 60, now };
    expect(clinicianAlertDedupeKey({ ...base, kind: 'A', credentialId: 'c1' })).not.toBe(
      clinicianAlertDedupeKey({ ...base, kind: 'A', credentialId: 'c2' }),
    );
    expect(clinicianAlertDedupeKey({ ...base, kind: 'A' })).not.toBe(
      clinicianAlertDedupeKey({ ...base, kind: 'B' }),
    );
  });

  it('claims once and suppresses the repeat — a daily sweep cannot mail daily', async () => {
    const npi = await makeClinician();
    const claimInput = {
      npi,
      kind: 'LICENSE_EXPIRED',
      credentialId: 'artifact-1',
      destination: `clin-${npi}@example.test`,
      suppressionWindowMinutes: 1440,
      now: new Date('2026-08-08T09:00:00.000Z'),
    };

    const first = await claimClinicianAlertSend(claimInput);
    expect(first.claimed).toBe(true);

    // Same finding, later the same day: suppressed, and the suppression is
    // visible in the ledger rather than being a silent skip.
    const second = await claimClinicianAlertSend({
      ...claimInput,
      now: new Date('2026-08-08T21:00:00.000Z'),
    });
    expect(second).toMatchObject({ claimed: false, reason: 'suppressed_within_window' });
    expect(second.dedupeKey).toBe(first.dedupeKey);

    // Next window: allowed again.
    const third = await claimClinicianAlertSend({
      ...claimInput,
      now: new Date('2026-08-10T09:00:00.000Z'),
    });
    expect(third.claimed).toBe(true);
  });

  it('concurrent sweeps cannot both claim the same send', async () => {
    const npi = await makeClinician();
    const claimInput = {
      npi,
      kind: 'SANCTION_DETECTED',
      destination: `clin-${npi}@example.test`,
      suppressionWindowMinutes: 1440,
      now: new Date('2026-08-08T09:00:00.000Z'),
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, () => claimClinicianAlertSend(claimInput)),
    );
    expect(results.filter((r) => r.claimed)).toHaveLength(1);
    expect(results.filter((r) => !r.claimed && r.reason === 'suppressed_within_window')).toHaveLength(4);
  });

  it('settles a claim to a terminal status', async () => {
    const npi = await makeClinician();
    const claim = await claimClinicianAlertSend({
      npi,
      kind: 'ENROLLMENT_LAPSED',
      destination: `clin-${npi}@example.test`,
      suppressionWindowMinutes: 1440,
      now: new Date('2026-08-08T09:00:00.000Z'),
    });
    expect(claim.claimed).toBe(true);
    if (!claim.claimed) return;

    await settleClinicianAlertSend(claim.attemptId, { status: 'NOT_CONFIGURED' });
    const row = await prisma.alertDeliveryAttempt.findUnique({ where: { id: claim.attemptId } });
    // A stub environment settles as NOT_CONFIGURED — never DELIVERED.
    expect(row?.status).toBe('NOT_CONFIGURED');
  });
});
