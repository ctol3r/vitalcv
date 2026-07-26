jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

import prisma from '../../graphql/prisma_client';
import { runMonitoringCheck } from '../monitoringEngine';

const prismaMock = prisma as unknown as {
  verificationArtifact: { findFirst: jest.Mock };
  $transaction: jest.Mock;
};

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  jest.clearAllMocks();
});

function fabricatedArtifact() {
  return {
    id: 'artifact-1',
    npi: '1234567890',
    source: 'NURSYS',
    status: 'ACTIVE',
    rawPayload: { adapterName: 'NURSYS_STUB', licenseStatus: 'ACTIVE' },
    revokedAt: null,
    suspendedAt: null,
    monitoring: true,
    trustState: 'verified_monitoring',
    createdAt: new Date(),
  };
}

describe('runMonitoringCheck fail-closed behavior', () => {
  it('skips NURSYS re-verification in production without touching the artifact', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(fabricatedArtifact());
    process.env.NODE_ENV = 'production';

    const result = await runMonitoringCheck('1234567890');

    expect(result.skippedReason).toBe('SOURCE_ACCESS_REQUIRED');
    expect(result.changed).toBe(false);
    expect(result.newStatus).toBe('ACTIVE');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('never overwrites a decision-grade artifact with stand-in data, in any environment', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue({
      ...fabricatedArtifact(),
      rawPayload: { adapterName: 'NURSYS_ENOTIFY', licenseStatus: 'ACTIVE' },
    });

    const result = await runMonitoringCheck('1234567890');

    expect(result.skippedReason).toBe('NON_DECISION_GRADE_SOURCE');
    expect(result.changed).toBe(false);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('still re-verifies fabricated artifacts against the stub outside production', async () => {
    prismaMock.verificationArtifact.findFirst.mockResolvedValue(fabricatedArtifact());
    prismaMock.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        monitoringEvent: { create: jest.fn().mockResolvedValue({ id: 'evt-1' }) },
        auditEvent: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
        verificationArtifact: { update: jest.fn().mockResolvedValue({}) },
      }),
    );

    const result = await runMonitoringCheck('1234567890');

    expect(result.skippedReason).toBeUndefined();
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    // Stub derives ACTIVE for NPIs starting 1-6 — deterministic, unchanged.
    expect(result.newStatus).toBe('ACTIVE');
    expect(result.changed).toBe(false);
  });
});
