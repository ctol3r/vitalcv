jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    ingestRun: {
      count: jest.fn(),
    },
    anomalyHistory: {
      aggregate: jest.fn(),
    },
    driftEvent: {
      count: jest.fn(),
    },
  },
}));

import prisma from '../../../graphql/prisma_client';
import { computeStabilityMetrics } from '../stabilityMetricsService';

const prismaMock = prisma as unknown as {
  ingestRun: { count: jest.Mock };
  anomalyHistory: { aggregate: jest.Mock };
  driftEvent: { count: jest.Mock };
};

describe('stabilityMetricsService', () => {
  beforeEach(() => {
    prismaMock.ingestRun.count.mockReset();
    prismaMock.anomalyHistory.aggregate.mockReset();
    prismaMock.driftEvent.count.mockReset();
  });

  it('returns a high consistency score for stable NPIs', async () => {
    prismaMock.ingestRun.count.mockResolvedValue(5);
    prismaMock.anomalyHistory.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { occurrenceCount: 0 },
    });
    prismaMock.driftEvent.count.mockResolvedValue(0);

    const metrics = await computeStabilityMetrics(
      '1234567890',
      prisma as never,
      { now: new Date('2026-04-14T10:00:00.000Z') },
    );

    expect(metrics).toEqual({
      npi: '1234567890',
      generatedAt: '2026-04-14T10:00:00.000Z',
      totalValidations: 5,
      anomalies: 0,
      anomalyRecords: 0,
      driftEvents: 0,
      cleanRuns: 5,
      consistencyScore: 1,
      driftRate: 0,
      classification: 'stable',
      sampleStatus: 'sufficient',
      lowSampleThreshold: 3,
    });
  });

  it('returns unknown when the sample size is too small', async () => {
    prismaMock.ingestRun.count.mockResolvedValue(2);
    prismaMock.anomalyHistory.aggregate.mockResolvedValue({
      _count: { _all: 0 },
      _sum: { occurrenceCount: 0 },
    });
    prismaMock.driftEvent.count.mockResolvedValue(0);

    const metrics = await computeStabilityMetrics('1234567890', prisma as never);

    expect(metrics.classification).toBe('unknown');
    expect(metrics.sampleStatus).toBe('low');
    expect(metrics.consistencyScore).toBe(1);
  });

  it('classifies high drift as volatile', async () => {
    prismaMock.ingestRun.count.mockResolvedValue(6);
    prismaMock.anomalyHistory.aggregate.mockResolvedValue({
      _count: { _all: 1 },
      _sum: { occurrenceCount: 1 },
    });
    prismaMock.driftEvent.count.mockResolvedValue(4);

    const metrics = await computeStabilityMetrics('1234567890', prisma as never);

    expect(metrics.cleanRuns).toBe(1);
    expect(metrics.consistencyScore).toBe(0.1667);
    expect(metrics.driftRate).toBe(0.6667);
    expect(metrics.classification).toBe('volatile');
  });

  it('lets anomalies increase volatility even when drift is zero', async () => {
    prismaMock.ingestRun.count.mockResolvedValue(5);
    prismaMock.anomalyHistory.aggregate.mockResolvedValue({
      _count: { _all: 2 },
      _sum: { occurrenceCount: 2 },
    });
    prismaMock.driftEvent.count.mockResolvedValue(0);

    const metrics = await computeStabilityMetrics('1234567890', prisma as never);

    expect(metrics.consistencyScore).toBe(0.6);
    expect(metrics.classification).toBe('moderately_stable');
  });
});
