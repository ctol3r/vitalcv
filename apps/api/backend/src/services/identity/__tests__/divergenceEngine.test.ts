const mockVerificationArtifactFindMany = jest.fn();
const mockAnomalyHistoryFindMany = jest.fn();
const mockAnomalyHistoryFindUnique = jest.fn();
const mockTransaction = jest.fn();
const mockLoadClaimRecordsForNpi = jest.fn();
const mockAppendAuditEvent = jest.fn();
const mockLog = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findMany: mockVerificationArtifactFindMany,
    },
    anomalyHistory: {
      findMany: mockAnomalyHistoryFindMany,
      findUnique: mockAnomalyHistoryFindUnique,
    },
    $transaction: mockTransaction,
  },
}));

jest.mock('../identityStore', () => ({
  loadClaimRecordsForNpi: mockLoadClaimRecordsForNpi,
}));

jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: mockAppendAuditEvent,
}));

jest.mock('../../../obs/logger', () => ({
  log: mockLog,
}));

import { sha256ForPayload } from '../../../utils/deterministic';
import { detectDivergence, resolveDivergenceConflict } from '../divergenceEngine';

describe('divergenceEngine', () => {
  const npi = '1234567890';

  beforeEach(() => {
    mockVerificationArtifactFindMany.mockReset();
    mockAnomalyHistoryFindMany.mockReset();
    mockAnomalyHistoryFindUnique.mockReset();
    mockTransaction.mockReset();
    mockLoadClaimRecordsForNpi.mockReset();
    mockAppendAuditEvent.mockReset();
    mockLog.mockReset();

    mockVerificationArtifactFindMany.mockResolvedValue([]);
    mockAnomalyHistoryFindMany.mockResolvedValue([]);
  });

  it('detects all seven canonical divergence rules with severity penalties', async () => {
    mockLoadClaimRecordsForNpi.mockResolvedValue([
      {
        claimId: 'identity-nppes',
        claimType: 'PERSONAL_IDENTITY',
        sourceId: 'NPPES_API',
        observedAt: '2026-04-01T12:00:00.000Z',
        value: {
          firstName: 'Ada',
          lastName: 'Lovelace',
          dateOfBirth: '1980-01-01',
        },
      },
      {
        claimId: 'identity-board',
        claimType: 'PERSONAL_IDENTITY',
        sourceId: 'STATE_BOARD',
        observedAt: '2026-04-01T13:00:00.000Z',
        value: {
          firstName: 'Ada',
          lastName: 'Byron',
          dateOfBirth: '1981-02-02',
        },
      },
      {
        claimId: 'license-board',
        claimType: 'LICENSE',
        sourceId: 'STATE_BOARD',
        observedAt: '2026-04-01T13:05:00.000Z',
        value: {
          state: 'CA',
          licenseNumber: 'LIC-123',
          licenseStatus: 'ACTIVE',
          issueDate: '2020-01-01',
          expiryDate: '2027-01-01',
        },
      },
      {
        claimId: 'license-fsmb',
        claimType: 'LICENSE',
        sourceId: 'FSMB',
        observedAt: '2026-04-01T13:10:00.000Z',
        value: {
          state: 'CA',
          licenseNumber: 'LIC-123',
          licenseStatus: 'SUSPENDED',
          issueDate: '2019-01-01',
          expiryDate: '2026-12-31',
        },
      },
      {
        claimId: 'specialty-nppes',
        claimType: 'SPECIALTY',
        sourceId: 'NPPES_API',
        observedAt: '2026-04-01T12:00:00.000Z',
        value: {
          specialty: 'Cardiology',
          isPrimary: true,
        },
      },
      {
        claimId: 'specialty-pecos',
        claimType: 'SPECIALTY',
        sourceId: 'PECOS_PUBLIC',
        observedAt: '2026-04-01T12:10:00.000Z',
        value: {
          specialty: 'Internal Medicine',
          isPrimary: true,
        },
      },
      {
        claimId: 'enrollment-pecos',
        claimType: 'ENROLLMENT_STATUS',
        sourceId: 'PECOS_PUBLIC',
        observedAt: '2026-04-01T12:15:00.000Z',
        value: {
          claimState: 'ENROLLED',
        },
      },
      {
        claimId: 'enrollment-state-board',
        claimType: 'ENROLLMENT_STATUS',
        sourceId: 'STATE_BOARD',
        observedAt: '2026-04-01T12:20:00.000Z',
        value: {
          claimState: 'NOT_FOUND',
        },
      },
      {
        claimId: 'address-nppes',
        claimType: 'PRACTICE_LOCATION',
        sourceId: 'NPPES_API',
        observedAt: '2026-04-01T12:00:00.000Z',
        value: {
          address1: '123 Main St',
          city: 'Austin',
          state: 'TX',
          zip: '78701',
        },
      },
      {
        claimId: 'address-pecos',
        claimType: 'PRACTICE_LOCATION',
        sourceId: 'PECOS_PUBLIC',
        observedAt: '2026-04-01T12:30:00.000Z',
        value: {
          address1: '456 Elm St',
          city: 'Dallas',
          state: 'TX',
          zip: '75201',
        },
      },
    ]);

    const report = await detectDivergence(npi);

    expect(report.conflicts).toHaveLength(7);
    expect(report.rulesFired).toEqual([
      'NAME_MISMATCH',
      'DOB_CONFLICT',
      'LICENSE_STATUS_DISCREPANCY',
      'CREDENTIAL_DATE_CONFLICT',
      'ENROLLMENT_CONTRADICTION',
      'SPECIALTY_MISMATCH',
      'ADDRESS_DIVERGENCE',
    ]);
    expect(report.totalPenalty).toBe(65);
    expect(report.hasBlocking).toBe(true);
    expect(report.conflicts.map((conflict) => conflict.ruleId)).toEqual(expect.arrayContaining([
      'NAME_MISMATCH',
      'DOB_CONFLICT',
      'LICENSE_STATUS_DISCREPANCY',
      'SPECIALTY_MISMATCH',
      'ENROLLMENT_CONTRADICTION',
      'ADDRESS_DIVERGENCE',
      'CREDENTIAL_DATE_CONFLICT',
    ]));
    expect(report.conflicts.find((conflict) => conflict.ruleId === 'NAME_MISMATCH')).toMatchObject({
      severity: 'HIGH',
      penalty: 15,
      active: true,
      resolution: 'OPEN',
    });
    expect(report.conflicts.find((conflict) => conflict.ruleId === 'ENROLLMENT_CONTRADICTION')).toMatchObject({
      severity: 'MEDIUM',
      penalty: 7,
    });
    expect(report.conflicts.find((conflict) => conflict.ruleId === 'ADDRESS_DIVERGENCE')).toMatchObject({
      severity: 'LOW',
      penalty: 3,
    });
    expect(mockAppendAuditEvent).toHaveBeenCalledTimes(3);
  });

  it('removes CRS penalty when a matching divergence has been resolved', async () => {
    mockLoadClaimRecordsForNpi.mockResolvedValue([
      {
        claimId: 'identity-nppes',
        claimType: 'PERSONAL_IDENTITY',
        sourceId: 'NPPES_API',
        observedAt: '2026-04-01T12:00:00.000Z',
        value: {
          firstName: 'Ada',
          lastName: 'Lovelace',
        },
      },
      {
        claimId: 'identity-board',
        claimType: 'PERSONAL_IDENTITY',
        sourceId: 'STATE_BOARD',
        observedAt: '2026-04-01T13:00:00.000Z',
        value: {
          firstName: 'Ada',
          lastName: 'Byron',
        },
      },
    ]);

    let storedRow: unknown;
    let findManyCalls = 0;
    mockAnomalyHistoryFindMany.mockImplementation(async () => {
      findManyCalls += 1;
      return findManyCalls === 1 ? [] : [storedRow];
    });

    const firstReport = await detectDivergence(npi);
    const conflict = firstReport.conflicts[0]!;
    storedRow = {
      anomalyKey: conflict.id,
      severity: conflict.severity,
      status: 'RESOLVED',
      occurrenceCount: 1,
      firstDetectedAt: new Date('2026-04-01T13:00:00.000Z'),
      lastDetectedAt: new Date('2026-04-01T13:05:00.000Z'),
      resolvedAt: new Date('2026-04-01T14:00:00.000Z'),
      lastFingerprint: sha256ForPayload({
        ruleId: conflict.ruleId,
        sources: [...conflict.sources].sort(),
        values: [...conflict.values].sort(),
      }),
      metadata: {
        kind: 'TRUST_DIVERGENCE',
        resolutionNote: 'Reviewed and accepted.',
      },
    };

    const secondReport = await detectDivergence(npi);
    const resolvedConflict = secondReport.conflicts[0]!;

    expect(resolvedConflict).toMatchObject({
      id: conflict.id,
      severity: 'HIGH',
      penalty: 0,
      active: false,
      resolution: 'RESOLVED',
      resolutionNote: 'Reviewed and accepted.',
    });
    expect(secondReport.totalPenalty).toBe(0);
    expect(secondReport.hasBlocking).toBe(false);
  });

  it('writes an AuditEvent before marking a divergence resolved', async () => {
    mockAnomalyHistoryFindUnique.mockResolvedValue({
      anomalyKey: 'div_testconflict',
      subjectType: 'NPI',
      subjectId: npi,
      metadata: {
        kind: 'TRUST_DIVERGENCE',
        ruleId: 'NAME_MISMATCH',
      },
      severity: 'HIGH',
    });

    const txAuditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const txAnomalyUpdate = jest.fn().mockResolvedValue({ anomalyKey: 'div_testconflict' });
    mockTransaction.mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => callback({
      auditEvent: {
        create: txAuditCreate,
      },
      anomalyHistory: {
        update: txAnomalyUpdate,
      },
    }));

    const result = await resolveDivergenceConflict({
      npi,
      conflictId: 'div_testconflict',
      resolvedBy: 'user_123',
      note: 'Resolved after source refresh.',
    });

    expect(result).toMatchObject({
      npi,
      conflictId: 'div_testconflict',
      resolution: 'RESOLVED',
      auditEventId: 'audit-1',
      note: 'Resolved after source refresh.',
    });
    expect(txAuditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'TRUST_DIVERGENCE_RESOLVED',
        referenceId: 'div_testconflict',
        clinicianId: npi,
      }),
    }));
    expect(txAnomalyUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { anomalyKey: 'div_testconflict' },
      data: expect.objectContaining({
        status: 'RESOLVED',
      }),
    }));
    expect(txAuditCreate.mock.invocationCallOrder[0]).toBeLessThan(txAnomalyUpdate.mock.invocationCallOrder[0]);
    expect(mockAppendAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'user_123',
      resource: 'divergence:div_testconflict',
    }));
  });
});
