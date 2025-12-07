import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { PrivilegeSafetySignal as PrismaSafetySignalModel } from '@prisma/client';
import { SafetySignalCollector } from '../collectors/signalCollector.js';
import { SafetyThresholdRegistry } from '../rules/thresholds.js';
import { recordSafetySignalTimelineEvent } from '../../timeline/safetyIntegration.js';

jest.mock('../../timeline/safetyIntegration.js', () => ({
  recordSafetySignalTimelineEvent: jest.fn().mockResolvedValue(undefined),
}));

function buildRecord(overrides: Partial<PrismaSafetySignalModel> = {}): PrismaSafetySignalModel {
  const now = new Date();
  return {
    id: 'sig-1',
    clinicianId: 'clinician-1',
    orgId: 'org-1',
    privilegeCodes: ['ANES'],
    privilegeGrantedId: null,
    signalType: 'QUALITY_RISK',
    severity: 'HIGH',
    summary: 'test signal',
    source: 'unit-test',
    detectedAt: now,
    details: {},
    evidence: null,
    resolvedAt: null,
    resolutionNotes: null,
    resolutionActor: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('SafetySignalCollector', () => {
  const createMock = jest.fn();
  const findManyMock = jest.fn();
  const registry = new SafetyThresholdRegistry([]);
  const collector = new SafetySignalCollector({
    prisma: {
      privilegeSafetySignal: {
        create: (...args: any[]) => createMock(...args),
        findMany: (...args: any[]) => findManyMock(...args),
      },
    } as any,
    thresholdRegistry: registry,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    createMock.mockResolvedValue(buildRecord());
    findManyMock.mockResolvedValue([]);
  });

  it('normalizes quality signals into privilege safety signals', async () => {
    const timestamp = new Date();
    await collector.ingestQualitySignal({
      clinicianId: 'clinician-1',
      signalType: 'LICENSE_DRIFT',
      severity: 'MED',
      details: { summary: 'License variance detected' },
      timestamp,
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          signalType: 'LICENSE_RISK',
          severity: 'MED',
          clinicianId: 'clinician-1',
        }),
      })
    );

    expect(recordSafetySignalTimelineEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicianId: 'clinician-1',
        privilegeCodes: expect.any(Array),
      })
    );
  });

  it('skips drift events without clinician context', async () => {
    const result = await collector.ingestDriftEvent({
      severity: 'critical',
      summary: 'orphan drift',
    });
    expect(result).toBeNull();
    expect(createMock).not.toHaveBeenCalled();
  });

  it('suppresses enrollment success events', async () => {
    const result = await collector.ingestEnrollmentChange({
      clinicianId: 'clinician-1',
      orgId: 'org-1',
      changeType: 'ENROLLED',
    });
    expect(result).toBeNull();
  });
});

