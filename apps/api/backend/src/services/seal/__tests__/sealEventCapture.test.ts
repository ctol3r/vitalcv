jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    vcvEntity: {
      findFirst: jest.fn(),
    },
    bundleShareEvent: {
      findFirst: jest.fn(),
    },
    advisoryOutcomeEvent: {
      findFirst: jest.fn(),
    },
    startOutcomeEvent: {
      create: jest.fn(),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { captureStartOutcome } from '../sealEventCapture';

const prismaMock = prisma as unknown as {
  vcvEntity: {
    findFirst: jest.Mock;
  };
  bundleShareEvent: {
    findFirst: jest.Mock;
  };
  advisoryOutcomeEvent: {
    findFirst: jest.Mock;
  };
  startOutcomeEvent: {
    create: jest.Mock;
  };
};

const EMPTY_COVERAGE = {
  checked: [],
  stale: [],
  pending: [],
  gated: [],
  unavailable: [],
  accessRequired: [],
  reviewRequired: [],
  notDecisionGrade: [],
  previewOnly: [],
};

describe('captureStartOutcome', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-23T00:00:00.000Z'));

    prismaMock.vcvEntity.findFirst.mockReset().mockResolvedValue(null);
    prismaMock.bundleShareEvent.findFirst.mockReset().mockResolvedValue(null);
    prismaMock.advisoryOutcomeEvent.findFirst.mockReset().mockResolvedValue(null);
    prismaMock.startOutcomeEvent.create.mockReset().mockResolvedValue({});
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('resolves legacy NPI input and derives timings from review/share/ready events', async () => {
    prismaMock.vcvEntity.findFirst.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000111' });
    prismaMock.bundleShareEvent.findFirst.mockResolvedValue({
      sharedAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    prismaMock.advisoryOutcomeEvent.findFirst.mockImplementation(async ({
      where,
    }: {
      where: { eventType?: string; readinessScoreAtEvent?: { gte: number } };
    }) => {
      if (where.eventType === 'EMPLOYER_REVIEW') {
        return { eventTimestamp: new Date('2026-03-02T00:00:00.000Z') };
      }
      if (where.readinessScoreAtEvent?.gte === 60) {
        return { eventTimestamp: new Date('2026-03-06T00:00:00.000Z') };
      }
      if (where.eventType === 'SHARE_INITIATED') {
        return { eventTimestamp: new Date('2026-02-28T00:00:00.000Z') };
      }
      return null;
    });

    await captureStartOutcome({
      entityId: '1111111111',
      organizationContextId: 'org-ctx-1',
      startedAt: new Date('2026-03-10T00:00:00.000Z'),
      readinessScoreAtStart: 88,
      blockersAtStart: [],
      sourceCoverageAtStart: EMPTY_COVERAGE,
      metadata: { note: 'manual backfill' },
    });

    expect(prismaMock.vcvEntity.findFirst).toHaveBeenCalledWith({
      where: { npi: '1111111111' },
      select: { id: true },
    });
    expect(prismaMock.bundleShareEvent.findFirst).toHaveBeenCalledWith({
      where: {
        subjectEntityId: '00000000-0000-0000-0000-000000000111',
        organizationContextId: 'org-ctx-1',
      },
      orderBy: { sharedAt: 'asc' },
      select: { sharedAt: true },
    });
    expect(prismaMock.startOutcomeEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityId: '00000000-0000-0000-0000-000000000111',
        organizationContextId: 'org-ctx-1',
        daysFromFirstReview: 8,
        daysFromShare: 9,
        daysFromReady: 4,
        readinessScoreAtStart: 88,
        metadata: expect.objectContaining({
          note: 'manual backfill',
          capturedAt: '2026-03-23T00:00:00.000Z',
        }),
      }),
    }));

    const shareInitiatedCalls = prismaMock.advisoryOutcomeEvent.findFirst.mock.calls.filter(
      ([call]) => call.where?.eventType === 'SHARE_INITIATED',
    );
    expect(shareInitiatedCalls).toHaveLength(0);
  });

  it('falls back to legacy SHARE_INITIATED when bundle share rows are absent', async () => {
    prismaMock.advisoryOutcomeEvent.findFirst.mockImplementation(async ({
      where,
    }: {
      where: { eventType?: string; readinessScoreAtEvent?: { gte: number } };
    }) => {
      if (where.eventType === 'EMPLOYER_REVIEW') {
        return { eventTimestamp: new Date('2026-03-03T00:00:00.000Z') };
      }
      if (where.eventType === 'SHARE_INITIATED') {
        return { eventTimestamp: new Date('2026-03-04T00:00:00.000Z') };
      }
      if (where.readinessScoreAtEvent?.gte === 60) {
        return { eventTimestamp: new Date('2026-03-05T00:00:00.000Z') };
      }
      return null;
    });

    await captureStartOutcome({
      entityId: '00000000-0000-0000-0000-000000000222',
      organizationContextId: null,
      startedAt: new Date('2026-03-10T00:00:00.000Z'),
      readinessScoreAtStart: 77,
      blockersAtStart: ['LICENSE_EXPIRED'],
      sourceCoverageAtStart: EMPTY_COVERAGE,
    });

    expect(prismaMock.vcvEntity.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.startOutcomeEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityId: '00000000-0000-0000-0000-000000000222',
        daysFromFirstReview: 7,
        daysFromShare: 6,
        daysFromReady: 5,
      }),
    }));

    const shareInitiatedCalls = prismaMock.advisoryOutcomeEvent.findFirst.mock.calls.filter(
      ([call]) => call.where?.eventType === 'SHARE_INITIATED',
    );
    expect(shareInitiatedCalls).toHaveLength(1);
  });
});
