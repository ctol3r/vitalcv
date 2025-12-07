import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { DriftEvent } from '../../drift/types.js';
import type { QualitySignal } from '../../qualityFusion/models/QualitySignal.js';
import { SafetySignalCollector } from '../collectors/signalCollector.js';

jest.mock('../../timeline/safetyIntegration.js', () => ({
  recordPrivilegeSafetyTimelineEvent: jest.fn().mockResolvedValue(undefined),
}));

const mockTimeline = jest.requireMock('../../timeline/safetyIntegration.js');

function buildMockClient() {
  return {
    privilegeSafetySignal: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation(({ data }) => ({
        id: 'sig-1',
        clinicianId: data.clinicianId,
        signalType: data.signalType,
        severity: data.severity,
        privilegeCodes: data.privilegeCodes,
        summary: data.summary,
        source: data.source,
        sourceEventId: data.sourceEventId ?? null,
        details: data.details ?? null,
        recommendedAction: data.recommendedAction,
        detectedAt: data.detectedAt,
        acknowledgedAt: null,
        resolvedAt: null,
        createdAt: data.detectedAt,
        updatedAt: data.detectedAt,
      })),
    },
  };
}

describe('SafetySignalCollector', () => {
  let mockClient: ReturnType<typeof buildMockClient>;
  let collector: SafetySignalCollector;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = buildMockClient();
    collector = new SafetySignalCollector(mockClient as any);
  });

  it('normalizes quality signals into privilege safety signals', async () => {
    const qualitySignal: QualitySignal = {
      clinicianId: 'clin-1',
      signalType: 'OPPE_LOW',
      severity: 'MED',
      timestamp: new Date(),
      details: {
        summary: 'OPPE volume fell below target',
        privilegeCodes: ['card-cath-lab'],
      },
      source: 'qualityFusion/oppeTrend',
    };

    const result = await collector.recordQualitySignal(qualitySignal);

    expect(result.recommendedAction).toBe('monitor');
    expect(mockClient.privilegeSafetySignal.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicianId: 'clin-1',
          signalType: 'OPPE_LOW',
          severity: 'MED',
        }),
      })
    );
    expect(mockTimeline.recordPrivilegeSafetyTimelineEvent).toHaveBeenCalled();
  });

  it('escalates to restrict when consecutive high drift events occur', async () => {
    mockClient.privilegeSafetySignal.findMany.mockResolvedValue([
      {
        id: 'prev',
        clinicianId: 'clin-2',
        signalType: 'LICENSE_RISK',
        severity: 'HIGH',
        privilegeCodes: ['*ALL_PRIVILEGES*'],
        summary: 'Previous alert',
        source: 'test',
        sourceEventId: null,
        details: null,
        recommendedAction: null,
        detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        acknowledgedAt: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const driftEvent: DriftEvent = {
      id: 'drift-1',
      detector: 'LicenseDriftDetector',
      category: 'licensure',
      severity: 'high',
      title: 'License suspension detected',
      summary: 'State board marked license as suspended',
      detectedAt: new Date(),
    } as DriftEvent;

    const result = await collector.recordDriftEvent(driftEvent, { clinicianId: 'clin-2' });

    expect(result?.recommendedAction).toBe('restrict');
  });
});

