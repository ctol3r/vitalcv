import { evaluateNCQASnapshot, NCQAClinicianSnapshot } from '../ncqa/calcNCQA';

const baseSnapshot: NCQAClinicianSnapshot = {
  clinicianId: 'clin-001',
  psv: {
    status: 'PASS',
    lastVerifiedAt: new Date('2025-01-01T00:00:00Z'),
    nextDueAt: new Date('2025-06-01T00:00:00Z'),
    evidenceId: 'psv-1',
  },
  licenses: [
    {
      id: 'lic-1',
      state: 'CA',
      status: 'ACTIVE',
      expiresAt: new Date('2025-12-01T00:00:00Z'),
      lastCheckedAt: new Date('2025-01-01T00:00:00Z'),
    },
  ],
  boardCertifications: [
    {
      id: 'board-1',
      board: 'ABMS',
      expiresAt: new Date('2026-01-01T00:00:00Z'),
      verifiedAt: new Date('2024-12-01T00:00:00Z'),
    },
  ],
  recredentialing: {
    lastCompletedAt: new Date('2023-12-01T00:00:00Z'),
    nextDueAt: new Date('2026-12-01T00:00:00Z'),
  },
  rightsAcknowledgements: [],
  fileAudits: [],
  oppeReports: [],
};

describe('NCQA calculator', () => {
  it('flags CR2 failure when license expired', () => {
    const snapshot = {
      ...baseSnapshot,
      licenses: [
        {
          ...baseSnapshot.licenses[0],
          expiresAt: new Date('2024-01-01T00:00:00Z'),
        },
      ],
    };

    const results = evaluateNCQASnapshot(snapshot, new Date('2025-01-15T00:00:00Z'));
    const cr2 = results.find((record) => record.ruleCode === 'CR2');
    expect(cr2?.status).toBe('FAIL');
    expect(cr2?.notes).toContain('expired');
  });

  it('flags CR1 failure when board certification missing', () => {
    const snapshot = {
      ...baseSnapshot,
      boardCertifications: [],
    };

    const results = evaluateNCQASnapshot(snapshot, new Date('2025-01-15T00:00:00Z'));
    const cr1 = results.find((record) => record.ruleCode === 'CR1');
    expect(cr1?.status).toBe('FAIL');
    expect(cr1?.notes).toContain('Board certification');
  });

  it('flags CR1 failure when PSV nextDueAt is in the past', () => {
    const snapshot = {
      ...baseSnapshot,
      psv: {
        ...baseSnapshot.psv!,
        nextDueAt: new Date('2024-10-01T00:00:00Z'),
      },
    };

    const results = evaluateNCQASnapshot(snapshot, new Date('2025-01-15T00:00:00Z'));
    const cr1 = results.find((record) => record.ruleCode === 'CR1');
    expect(cr1?.status).toBe('FAIL');
    expect(cr1?.notes).toContain('PSV bundle expired');
  });
});

