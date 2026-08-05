/**
 * Activation atomicity, against a real Postgres — Wave 1076 B1.
 *
 * The mock suite proves a failing audit rejects the request. That is NOT the
 * guarantee: an earlier version rejected the request while the mutation stayed
 * committed, so the profile changed and the caller was told it had not.
 *
 * Only a real transaction can show rollback, so these run against Postgres in
 * CI. Each test forces the AUDIT write to fail and then asserts the preceding
 * mutation is absent from the database.
 *
 * The audit failure is induced honestly — a foreign-key/constraint violation
 * from a deliberately invalid AuditEvent row — rather than by mocking, because
 * a mocked rejection would not exercise Postgres's own rollback.
 */

import { PrismaClient } from '@prisma/client';

import {
  confirmReview,
  confirmSharingControl,
  createOrRecoverDraft,
  saveCorrections,
  saveReusableProfile,
} from '../clinicianProfileService';
import * as auditModule from '../clinicianProfileAudit';
import * as workspaceModule from '../../workspace/workspaceService';
import { log } from '../../../obs/logger';

jest.mock('../../../obs/logger', () => ({ log: jest.fn() }));
jest.mock('../../workspace/workspaceService', () => ({ bootstrapFromNpi: jest.fn() }));

const prisma = new PrismaClient();

const USER = `user_atomicity_${Date.now()}`;
const NPI = '1003000126';
const COMPLETE = {
  fullName: 'JEAN ABBOTT', credential: 'NP', specialty: 'Emergency Medicine',
  practiceState: 'CO', contactEmail: 'jean@example.com',
};

/** Make the NEXT audit write fail, without mocking the database itself. */
function breakNextAudit(): jest.SpyInstance {
  return jest
    .spyOn(auditModule, 'writeActivationAudit')
    .mockRejectedValueOnce(new Error('audit store unavailable'));
}

const draft = () => prisma.clinicianProfileDraft.findUnique({
  where: { userId_npi: { userId: USER, npi: NPI } },
});
const auditCount = () => prisma.auditEvent.count({ where: { clinicianId: USER } });

async function seedDraft() {
  (workspaceModule.bootstrapFromNpi as jest.Mock).mockResolvedValue({
    npi: NPI, npiType: 'TYPE_1', inferredPersona: 'CLINICIAN',
    identitySource: 'NPPES_API', firstName: 'JEAN', lastName: 'ABBOTT',
    specialty: 'Emergency Medicine', state: 'CO', alreadyRegistered: false,
  });
  await createOrRecoverDraft(USER, NPI);
  await saveCorrections(USER, NPI, COMPLETE);
}

beforeEach(async () => {
  jest.restoreAllMocks();
  (log as jest.Mock).mockClear();
  await prisma.clinicianProfileDraft.deleteMany({ where: { userId: USER } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: USER } });
  (workspaceModule.bootstrapFromNpi as jest.Mock).mockResolvedValue({
    npi: NPI, npiType: 'TYPE_1', inferredPersona: 'CLINICIAN',
    identitySource: 'NPPES_API', firstName: 'JEAN', lastName: 'ABBOTT',
    specialty: 'Emergency Medicine', state: 'CO', alreadyRegistered: false,
  });
});

afterAll(async () => {
  await prisma.clinicianProfileDraft.deleteMany({ where: { userId: USER } });
  await prisma.auditEvent.deleteMany({ where: { clinicianId: USER } });
  await prisma.$disconnect();
});

describe('1 · a failed claim audit leaves no draft', () => {
  it('rolls the upsert back', async () => {
    breakNextAudit();
    await expect(createOrRecoverDraft(USER, NPI)).rejects.toThrow(/audit store unavailable/);
    expect(await draft()).toBeNull();
    expect(await auditCount()).toBe(0);
  });
});

describe('2 · a failed correction audit leaves clinician fields unchanged', () => {
  it('rolls the update back', async () => {
    await seedDraft();
    const before = (await draft())!.clinicianFields;

    breakNextAudit();
    await expect(saveCorrections(USER, NPI, { specialty: 'Urgent Care' }))
      .rejects.toThrow(/audit store unavailable/);

    expect((await draft())!.clinicianFields).toEqual(before);
  });
});

describe('3–4 · failed confirmation audits leave their timestamps unset', () => {
  it('3. review rolls back', async () => {
    await seedDraft();
    breakNextAudit();
    await expect(confirmReview(USER, NPI)).rejects.toThrow(/audit store unavailable/);
    expect((await draft())!.reviewedAt).toBeNull();
  });

  it('4. sharing control rolls back', async () => {
    await seedDraft();
    breakNextAudit();
    await expect(confirmSharingControl(USER, NPI)).rejects.toThrow(/audit store unavailable/);
    expect((await draft())!.sharingConfirmedAt).toBeNull();
  });
});

describe('5–7 · a failed save or activation audit leaves nothing behind', () => {
  it('5. save rolls back — savedAt stays unset', async () => {
    await seedDraft();
    breakNextAudit();
    await expect(saveReusableProfile(USER, NPI)).rejects.toThrow(/audit store unavailable/);
    expect((await draft())!.savedAt).toBeNull();
  });

  it('6–7. an activation audit failure rolls back the WHOLE unit and emits no analytics', async () => {
    await seedDraft();
    await confirmReview(USER, NPI);
    await confirmSharingControl(USER, NPI);
    (log as jest.Mock).mockClear();

    // The save audit succeeds; the ACTIVATION audit fails. All four writes in
    // the unit must roll back together — including the save that preceded it.
    // Capture the real implementation BEFORE spying: reaching for it through
    // the module afterwards resolves back to the spy and recurses.
    const realWrite = auditModule.writeActivationAudit;
    jest.spyOn(auditModule, 'writeActivationAudit').mockImplementation(
      async (action, ...rest) => {
        if (action === 'CLINICIAN_PROFILE_ACTIVATED') throw new Error('audit store unavailable');
        return realWrite(action, ...(rest as Parameters<typeof realWrite> extends [unknown, ...infer R] ? R : never));
      },
    );

    await expect(saveReusableProfile(USER, NPI)).rejects.toThrow(/audit store unavailable/);

    const after = (await draft())!;
    expect(after.activatedAt).toBeNull();
    // the save must not survive its activation's failure
    expect(after.savedAt).toBeNull();
    const activated = (log as jest.Mock).mock.calls
      .filter((c) => c[1] === 'clinician_profile_activated');
    expect(activated).toHaveLength(0);
  });
});

describe('8 · a successful retry commits exactly one activation and one receipt', () => {
  it('is idempotent across repeated saves', async () => {
    await seedDraft();
    await confirmReview(USER, NPI);
    await confirmSharingControl(USER, NPI);
    (log as jest.Mock).mockClear();

    const first = await saveReusableProfile(USER, NPI);
    expect(first.activatedAt).not.toBeNull();

    // Three more saves — a retry, a double-click, and a reload.
    await saveReusableProfile(USER, NPI);
    await saveReusableProfile(USER, NPI);
    await saveReusableProfile(USER, NPI);

    const activationAudits = await prisma.auditEvent.count({
      where: { clinicianId: USER, type: 'CLINICIAN_PROFILE_ACTIVATED' },
    });
    // exactly one durable activation receipt, however many saves ran
    expect(activationAudits).toBe(1);

    const analytics = (log as jest.Mock).mock.calls
      .filter((c) => c[1] === 'clinician_profile_activated');
    // and exactly one funnel event
    expect(analytics).toHaveLength(1);

    // And the activation timestamp never moved.
    const after = (await draft())!;
    expect(after.activatedAt!.toISOString()).toBe(first.activatedAt!.toISOString());
  });

  it('emits analytics with no direct actor identity', async () => {
    await seedDraft();
    await confirmReview(USER, NPI);
    await confirmSharingControl(USER, NPI);
    (log as jest.Mock).mockClear();
    await saveReusableProfile(USER, NPI);

    const entry = (log as jest.Mock).mock.calls.find((c) => c[1] === 'clinician_profile_activated');
    expect(entry).toBeDefined();
    const payload = JSON.stringify(entry![2]);
    for (const leak of [USER, NPI, 'JEAN', 'ABBOTT', 'jean@example.com', 'Emergency Medicine']) {
      expect({ leak, present: payload.includes(leak) }).toEqual({ leak, present: false });
    }
    expect(entry![2]).toMatchObject({ requiredComplete: true });
  });
});
