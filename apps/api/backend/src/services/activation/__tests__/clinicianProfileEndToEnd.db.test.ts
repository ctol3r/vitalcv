/**
 * One complete clinician activation, end to end, against a real Postgres —
 * Wave 1076 B1.
 *
 * The route and state suites use a mocked Prisma; this one does not. It drives
 * the real service functions against a real database and then reads the rows
 * back, because the properties that matter here are properties of what is
 * actually stored:
 *
 *   - a draft survives being left and returned to, with corrections intact;
 *   - `savedAt` is stamped by the save and by nothing else;
 *   - activation happens exactly once, and a second attempt cannot re-stamp it;
 *   - every step leaves a durable audit row;
 *   - a saved profile does NOT unlock private credential holdings.
 *
 * The identity is a non-sensitive test one: a Clerk-shaped id that belongs to
 * nobody, and the NPI from the NPPES documentation examples. No real
 * clinician's information is written by this file.
 *
 * Skips itself when no database is configured, the same as the atomicity suite
 * next door — a missing DATABASE_URL should not turn into a red suite that
 * says something false about the code.
 */

import { PrismaClient } from '@prisma/client';

const DATABASE_URL = process.env.DATABASE_URL;
const describeDb = DATABASE_URL ? describe : describe.skip;

/** A test identity that belongs to nobody. */
const USER = 'user_b1_e2e_test_identity';
const NPI = '1003000126';

jest.mock('../../workspace/workspaceService', () => ({
  // The registry itself is not what this suite is testing, and reaching NPPES
  // over the network would make it flaky for reasons that have nothing to do
  // with activation. What the server DOES with the answer is the subject.
  bootstrapFromNpi: jest.fn().mockResolvedValue({
    npi: '1003000126',
    npiType: 'TYPE_1',
    inferredPersona: 'CLINICIAN',
    identitySource: 'NPPES_API',
    firstName: 'JEAN',
    lastName: 'ABBOTT',
    specialty: 'Emergency Medicine',
    state: 'CO',
    alreadyRegistered: false,
  }),
}));

import {
  confirmReview,
  confirmSharingControl,
  createOrRecoverDraft,
  listProfiles,
  readDraft,
  saveCorrections,
  saveReusableProfile,
} from '../clinicianProfileService';

const prisma = new PrismaClient();

async function auditActions(): Promise<string[]> {
  const rows = await prisma.auditEvent.findMany({
    where: { clinicianId: USER },
    orderBy: { createdAt: 'asc' },
    select: { type: true },
  });
  return rows.map((r) => r.type);
}

describeDb('one complete clinician activation, against a real database', () => {
  beforeAll(async () => {
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { clinicianId: USER } });
    await prisma.clinicianProfileDraft.deleteMany({ where: { userId: USER } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.auditEvent.deleteMany({ where: { clinicianId: USER } });
    await prisma.clinicianProfileDraft.deleteMany({ where: { userId: USER } });
  });

  it('runs the whole loop and activates exactly once', async () => {
    // ── claim ────────────────────────────────────────────────────────────
    const claimed = await createOrRecoverDraft(USER, NPI);
    expect(claimed.state).toBe('resolved');
    // What the registry answered is labelled as the registry's, not as ours.
    const name = claimed.fields.find((f) => f.key === 'fullName');
    expect(name?.truthClass).toBe('public_source');
    expect(name?.source).toBe('NPPES');
    // And the profile is not complete: NPPES answers no credential and no
    // contact email, which is exactly what the surface has to explain.
    expect(claimed.missingRequired).toEqual(
      expect.arrayContaining(['credential', 'contactEmail']),
    );

    // ── an incomplete save is refused ────────────────────────────────────
    await expect(saveReusableProfile(USER, NPI)).rejects.toMatchObject({ status: 422 });
    expect((await readDraft(USER, NPI)).savedAt).toBeNull();

    // ── corrections ──────────────────────────────────────────────────────
    const corrected = await saveCorrections(USER, NPI, {
      credential: 'NP',
      contactEmail: 'Jean@Example.com',
      specialty: 'Urgent Care',
      licensedStates: ['co', 'TX', 'co'],
    });
    // A correction is a draft write and NOTHING else.
    expect(corrected.savedAt).toBeNull();
    expect(corrected.activatedAt).toBeNull();
    // An edited public-source value becomes the clinician's statement…
    expect(corrected.fields.find((f) => f.key === 'specialty')?.truthClass).toBe('clinician_provided');
    // …while the original public observation is preserved underneath it.
    const rowAfterEdit = await prisma.clinicianProfileDraft.findUniqueOrThrow({
      where: { userId_npi: { userId: USER, npi: NPI } },
      select: { resolvedSnapshot: true, clinicianFields: true },
    });
    expect((rowAfterEdit.resolvedSnapshot as Record<string, unknown>).specialty).toBe('Emergency Medicine');
    expect((rowAfterEdit.clinicianFields as Record<string, unknown>).specialty).toBe('Urgent Care');
    // Normalized on the way in: lower-cased email, de-duplicated upper states.
    expect((rowAfterEdit.clinicianFields as Record<string, unknown>).contactEmail).toBe('jean@example.com');
    expect((rowAfterEdit.clinicianFields as Record<string, unknown>).licensedStates).toEqual(['CO', 'TX']);
    expect(corrected.missingRequired).toEqual([]);

    // ── review and sharing, still not activation ─────────────────────────
    const reviewed = await confirmReview(USER, NPI);
    expect(reviewed.reviewedAt).not.toBeNull();
    expect(reviewed.activatedAt).toBeNull();

    const shared = await confirmSharingControl(USER, NPI);
    expect(shared.sharingConfirmedAt).not.toBeNull();
    // Reviewed and sharing-confirmed and complete — and STILL not activated,
    // because the clinician has not asked to keep it.
    expect(shared.savedAt).toBeNull();
    expect(shared.activatedAt).toBeNull();
    expect(shared.state).toBe('resolved');

    // ── the explicit save is what activates ──────────────────────────────
    const saved = await saveReusableProfile(USER, NPI);
    expect(saved.savedAt).not.toBeNull();
    expect(saved.activatedAt).not.toBeNull();
    expect(saved.state).toBe('profile_saved');

    // ── a saved profile does not unlock private holdings ─────────────────
    expect(saved.permissions.reusableProfile).toBe(true);
    expect(saved.permissions.opportunityDiscovery).toBe(true);
    expect(saved.permissions.privateCredentialHoldings).toBe(false);

    // ── durable receipts for every step ──────────────────────────────────
    expect(await auditActions()).toEqual([
      'CLINICIAN_PROFILE_CLAIMED',
      'CLINICIAN_PROFILE_CORRECTED',
      'CLINICIAN_PROFILE_REVIEW_CONFIRMED',
      'CLINICIAN_PROFILE_SHARING_CONFIRMED',
      'CLINICIAN_PROFILE_SAVED',
      'CLINICIAN_PROFILE_ACTIVATED',
    ]);
  });

  it('cannot activate a second time, however many saves arrive', async () => {
    await createOrRecoverDraft(USER, NPI);
    await saveCorrections(USER, NPI, { credential: 'NP', contactEmail: 'jean@example.com' });
    await confirmReview(USER, NPI);
    await confirmSharingControl(USER, NPI);

    const first = await saveReusableProfile(USER, NPI);
    const firstActivatedAt = first.activatedAt;
    const firstSavedAt = first.savedAt;

    // A double-clicked button, a retried request, a refreshed tab.
    const again = await saveReusableProfile(USER, NPI);
    const andAgain = await saveReusableProfile(USER, NPI);

    expect(again.activatedAt).toEqual(firstActivatedAt);
    expect(andAgain.activatedAt).toEqual(firstActivatedAt);
    expect(again.savedAt).toEqual(firstSavedAt);

    // Exactly one activation receipt exists, not three.
    const activations = (await auditActions()).filter((a) => a === 'CLINICIAN_PROFILE_ACTIVATED');
    expect(activations).toHaveLength(1);
  });

  it('survives concurrent saves without activating twice', async () => {
    await createOrRecoverDraft(USER, NPI);
    await saveCorrections(USER, NPI, { credential: 'NP', contactEmail: 'jean@example.com' });
    await confirmReview(USER, NPI);
    await confirmSharingControl(USER, NPI);

    // The conditional `activatedAt: null` write is what makes this safe: the
    // loser updates zero rows rather than stamping a second activation.
    await Promise.all([
      saveReusableProfile(USER, NPI),
      saveReusableProfile(USER, NPI),
      saveReusableProfile(USER, NPI),
    ]);

    const activations = (await auditActions()).filter((a) => a === 'CLINICIAN_PROFILE_ACTIVATED');
    expect(activations).toHaveLength(1);
  });

  it('recovers the draft with corrections intact after leaving and returning', async () => {
    await createOrRecoverDraft(USER, NPI);
    await saveCorrections(USER, NPI, { credential: 'NP', contactEmail: 'jean@example.com' });
    await confirmReview(USER, NPI);

    // Returning to the flow re-claims. It must not reset anything: this is the
    // difference between "your profile is where you left it" and "start again".
    const reclaimed = await createOrRecoverDraft(USER, NPI);

    expect(reclaimed.reviewedAt).not.toBeNull();
    expect(reclaimed.fields.find((f) => f.key === 'contactEmail')?.value).toBe('jean@example.com');
    expect(reclaimed.fields.find((f) => f.key === 'credential')?.value).toBe('NP');

    // And it did not create a second draft for the same clinician.
    const drafts = await prisma.clinicianProfileDraft.count({ where: { userId: USER } });
    expect(drafts).toBe(1);
  });

  it('recovers an unsaved draft on a machine that has never seen this flow', async () => {
    await createOrRecoverDraft(USER, NPI);
    await saveCorrections(USER, NPI, { credential: 'NP' });

    // No URL, no local storage — the durable draft is the only handle left.
    const recoverable = await listProfiles(USER, { includeDrafts: true });
    expect(recoverable).toHaveLength(1);
    expect(recoverable[0].npi).toBe(NPI);
    expect(recoverable[0].savedAt).toBeNull();

    // And it does not masquerade as a reusable profile in the saved list.
    expect(await listProfiles(USER)).toHaveLength(0);
  });

  it('keeps one clinician out of another’s draft', async () => {
    await createOrRecoverDraft(USER, NPI);

    const OTHER = 'user_b1_e2e_other_identity';
    try {
      // 404, not 403: another person's draft is not this caller's to know about.
      await expect(readDraft(OTHER, NPI)).rejects.toMatchObject({ status: 404 });
      await expect(saveCorrections(OTHER, NPI, { credential: 'MD' })).rejects.toMatchObject({ status: 404 });
      await expect(saveReusableProfile(OTHER, NPI)).rejects.toMatchObject({ status: 404 });

      // The owner's draft is untouched by any of it.
      const mine = await readDraft(USER, NPI);
      expect(mine.fields.find((f) => f.key === 'credential')).toBeUndefined();
    } finally {
      await prisma.auditEvent.deleteMany({ where: { clinicianId: OTHER } });
      await prisma.clinicianProfileDraft.deleteMany({ where: { userId: OTHER } });
    }
  });

  it('refuses a mistyped value with a 400 that names the field', async () => {
    await createOrRecoverDraft(USER, NPI);

    await expect(saveCorrections(USER, NPI, { contactEmail: 'not-an-email' })).rejects.toMatchObject({
      status: 400,
      code: 'FIELD_INVALID',
      details: { field: 'contactEmail' },
    });

    // Nothing was persisted, and no correction receipt was written for a
    // correction that did not happen.
    const row = await prisma.clinicianProfileDraft.findUniqueOrThrow({
      where: { userId_npi: { userId: USER, npi: NPI } },
      select: { clinicianFields: true },
    });
    expect(row.clinicianFields).toEqual({});
    expect(await auditActions()).toEqual(['CLINICIAN_PROFILE_CLAIMED']);
  });
});
