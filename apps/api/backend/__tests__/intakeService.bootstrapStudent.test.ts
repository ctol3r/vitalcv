/**
 * intakeService.bootstrapStudent.test.ts — the no-NPI / student preview lane.
 *
 * Contract:
 *   - A signed-in clinician-in-training with no NPI starts a PREVIEW-ONLY
 *     profile (profession = 'student', completeness 10) and one hashed
 *     `student_bootstrapped` audit row is written.
 *   - The self-attestation is recorded (attested + version), never verified.
 *   - It NEVER downgrades an already NPI-backed profile back to a preview.
 *
 * DB-free: prisma + logger are mocked (no docker), same pattern as the NPI
 * bootstrap regression test.
 */

// ── Mocks (hoisted above the SUT import) ──────────────────────────────────

const prismaMock = {
  personProfile: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
};

jest.mock('../src/graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
  Prisma: {},
}));

jest.mock('../src/obs/logger', () => ({
  log: jest.fn(),
}));

// ── SUT import (after mocks) ──────────────────────────────────────────────

import { bootstrapStudentIntake } from '../src/services/intake/intakeService';
import { PREVIEW_PROFESSION } from '../src/services/identity/identityTier';

const USER = '11111111-1111-4111-8111-111111111111';

describe('bootstrapStudentIntake — no-NPI preview lane', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.personProfile.upsert.mockResolvedValue({});
    prismaMock.auditEvent.create.mockResolvedValue({});
  });

  it('starts a preview-only profile (student, no NPI, completeness 10) and audits it', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue(null);

    const result = await bootstrapStudentIntake(USER, { attested: true, attestationVersion: 'v1' });

    expect(result).toEqual({ profession: PREVIEW_PROFESSION, previewOnly: true, completeness: 10 });

    // Upsert wrote a preview profile with NO npi.
    expect(prismaMock.personProfile.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = prismaMock.personProfile.upsert.mock.calls[0][0];
    expect(upsertArg.where).toEqual({ userId: USER });
    expect(upsertArg.create.profession).toBe(PREVIEW_PROFESSION);
    expect(upsertArg.create.completeness).toBe(10);
    expect(upsertArg.create).not.toHaveProperty('npi');
    expect(upsertArg.create.attestedAt).toBeInstanceOf(Date);
    expect(upsertArg.create.attestationVersion).toBe('v1');

    // Exactly one honest, preview-flagged audit row.
    expect(prismaMock.auditEvent.create).toHaveBeenCalledTimes(1);
    const audit = prismaMock.auditEvent.create.mock.calls[0][0];
    expect(audit.data.type).toBe('student_bootstrapped');
    expect(audit.data.referenceId).toBe(USER);
    expect(audit.data.metadata).toMatchObject({
      previewOnly: true,
      attested: true,
      attestationVersion: 'v1',
    });
  });

  it('records an un-attested start honestly (no attestedAt, attested:false)', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue(null);

    const result = await bootstrapStudentIntake(USER);

    expect(result.previewOnly).toBe(true);
    const upsertArg = prismaMock.personProfile.upsert.mock.calls[0][0];
    expect(upsertArg.create.attestedAt).toBeUndefined();
    expect(upsertArg.create.attestationVersion).toBeUndefined();
    const audit = prismaMock.auditEvent.create.mock.calls[0][0];
    expect(audit.data.metadata).toMatchObject({ attested: false, attestationVersion: null });
  });

  it('never downgrades an already NPI-backed profile to a preview', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue({
      npi: '1234567890',
      profession: 'physician',
      completeness: 30,
    });

    const result = await bootstrapStudentIntake(USER, { attested: true });

    expect(result).toEqual({ profession: 'physician', previewOnly: false, completeness: 30 });
    // Guard fires before any write or audit.
    expect(prismaMock.personProfile.upsert).not.toHaveBeenCalled();
    expect(prismaMock.auditEvent.create).not.toHaveBeenCalled();
  });

  it('is idempotent for an existing preview (upsert update path, still previewOnly)', async () => {
    prismaMock.personProfile.findUnique.mockResolvedValue({
      npi: null,
      profession: PREVIEW_PROFESSION,
      completeness: 10,
    });

    const result = await bootstrapStudentIntake(USER, { attested: true, attestationVersion: 'v1' });

    expect(result.previewOnly).toBe(true);
    const upsertArg = prismaMock.personProfile.upsert.mock.calls[0][0];
    expect(upsertArg.update.profession).toBe(PREVIEW_PROFESSION);
    expect(upsertArg.update.completeness).toBe(10);
  });
});
