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
    employerDecisionEvent: {
      findFirst: jest.fn(),
    },
    startOutcomeEvent: {
      create: jest.fn(),
    },
    auditEvent: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../audit/auditLedger', () => ({
  appendAuditEvent: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { appendAuditEvent } from '../../audit/auditLedger';
import { captureReadinessChange, captureStartOutcome } from '../sealEventCapture';

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
  employerDecisionEvent: {
    findFirst: jest.Mock;
  };
  startOutcomeEvent: {
    create: jest.Mock;
  };
  auditEvent: {
    create: jest.Mock;
    findFirst: jest.Mock;
  };
};

const appendAuditEventMock = appendAuditEvent as jest.MockedFunction<typeof appendAuditEvent>;

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
    prismaMock.employerDecisionEvent.findFirst.mockReset().mockResolvedValue(null);
    prismaMock.startOutcomeEvent.create.mockReset().mockResolvedValue({});
    prismaMock.auditEvent.create.mockReset().mockResolvedValue({});
    prismaMock.auditEvent.findFirst.mockReset().mockResolvedValue(null);
    const auditEntry: ReturnType<typeof appendAuditEvent> = {
      eventId: 'audit-event-1',
      time: '2026-03-23T00:00:00.000Z',
      traceId: 'trace-1',
      category: ['READINESS_CHANGE'],
      actor: 'system:seal',
      resource: 'entity',
      requestFields: {},
      resultFields: {},
      severity: 'INFO',
      receiptHash: 'hash-1',
    };
    appendAuditEventMock.mockReset().mockReturnValue(auditEntry);
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
          eventName: 'start_outcome_recorded',
          outcomeStatus: 'STARTED',
          note: 'manual backfill',
          organizationContextId: 'org-ctx-1',
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

  it('derives scoped timings from pilot metadata and avoids unscoped bundle-share lookups', async () => {
    prismaMock.advisoryOutcomeEvent.findFirst.mockImplementation(async ({
      where,
    }: {
      where: {
        eventType?: string;
        readinessScoreAtEvent?: { gte: number };
        AND?: Array<{ metadata: { path: string[]; equals: string } }>;
      };
    }) => {
      if (where.eventType === 'EMPLOYER_REVIEW') {
        return { eventTimestamp: new Date('2026-03-04T00:00:00.000Z') };
      }
      if (where.readinessScoreAtEvent?.gte === 60) {
        return { eventTimestamp: new Date('2026-03-06T00:00:00.000Z') };
      }
      if (where.eventType === 'SHARE_INITIATED') {
        return null;
      }
      return null;
    });

    await captureStartOutcome({
      entityId: '00000000-0000-0000-0000-000000000333',
      organizationContextId: 'org-ctx-2',
      startedAt: new Date('2026-03-10T00:00:00.000Z'),
      readinessScoreAtStart: 83,
      blockersAtStart: [],
      sourceCoverageAtStart: EMPTY_COVERAGE,
      scope: {
        pilotId: 'pilot-2',
        workflowLane: 'locum-rn',
        geographyTag: 'TX',
      },
    });

    expect(prismaMock.bundleShareEvent.findFirst).not.toHaveBeenCalled();

    const reviewCall = prismaMock.advisoryOutcomeEvent.findFirst.mock.calls.find(
      ([call]) => call.where?.eventType === 'EMPLOYER_REVIEW',
    );
    expect(reviewCall?.[0].where.AND).toEqual(expect.arrayContaining([
      { metadata: { path: ['pilotId'], equals: 'pilot-2' } },
      { metadata: { path: ['workflowLane'], equals: 'locum-rn' } },
      { metadata: { path: ['geographyTag'], equals: 'TX' } },
    ]));

    expect(prismaMock.startOutcomeEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityId: '00000000-0000-0000-0000-000000000333',
        organizationContextId: 'org-ctx-2',
        daysFromFirstReview: 6,
        daysFromShare: null,
        daysFromReady: 4,
        metadata: expect.objectContaining({
          eventName: 'start_outcome_recorded',
          outcomeStatus: 'STARTED',
          pilotId: 'pilot-2',
          workflowLane: 'locum-rn',
          geographyTag: 'TX',
          capturedAt: '2026-03-23T00:00:00.000Z',
        }),
      }),
    }));
  });

  it('records readiness changes into the pilot proof audit chain with resolved entity context', async () => {
    prismaMock.vcvEntity.findFirst.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000333' });

    await captureReadinessChange({
      npi: '1111111111',
      previousBand: 'L1',
      newBand: 'L2',
      degraded: false,
      triggerEventType: 'trust_recompute',
      triggerEventId: 'trigger-1',
      affectedCapsuleCount: 3,
      processedAt: '2026-03-23T12:00:00.000Z',
    });

    expect(prismaMock.vcvEntity.findFirst).toHaveBeenCalledWith({
      where: { npi: '1111111111' },
      select: { id: true },
    });
    expect(appendAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({
      category: ['READINESS_CHANGE'],
      requestFields: expect.objectContaining({
        npi: '1111111111',
        triggerEventType: 'trust_recompute',
      }),
      resultFields: expect.objectContaining({
        previousBand: 'L1',
        newBand: 'L2',
        direction: 'IMPROVED',
      }),
    }));
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        type: 'PILOT_PROOF_EVENT',
        referenceId: '00000000-0000-0000-0000-000000000333',
        clinicianId: '1111111111',
        createdAt: new Date('2026-03-23T12:00:00.000Z'),
        metadata: expect.objectContaining({
          schema: 'vitalcv.pilot-proof.event.v1',
          eventName: 'readiness_changed',
          entityId: '00000000-0000-0000-0000-000000000333',
          npi: '1111111111',
          occurredAt: '2026-03-23T12:00:00.000Z',
          previousBand: 'L1',
          newBand: 'L2',
        }),
      }),
    }));
  });

  it('backfills organization context and pilot scope from the acceptance decision chain when the start path is otherwise unscoped', async () => {
    prismaMock.auditEvent.findFirst.mockResolvedValue({
      id: 'accept-audit-1',
      metadata: {
        employerReviewAction: {
          attribution: {
            organizationContextId: 'org-ctx-9',
            organizationId: 'org-9',
            organizationName: 'Acme Health',
            purposeOfUse: 'credential_review',
          },
        },
      },
    });
    prismaMock.employerDecisionEvent.findFirst.mockResolvedValue({
      organizationContextId: 'org-ctx-9',
      metadata: {
        pilotId: 'pilot-9',
        workflowLane: 'perm-md',
        geographyTag: 'CA',
        organizationId: 'org-9',
        bundleId: 'bundle-9',
      },
    });
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
      return null;
    });

    await captureStartOutcome({
      entityId: '00000000-0000-0000-0000-000000000444',
      startedAt: new Date('2026-03-10T00:00:00.000Z'),
      readinessScoreAtStart: 90,
      blockersAtStart: [],
      sourceCoverageAtStart: EMPTY_COVERAGE,
      metadata: {
        acceptanceId: 'acceptance-9',
        startAttestationId: 'attestation-9',
      },
    });

    expect(prismaMock.auditEvent.findFirst).toHaveBeenCalledWith({
      where: {
        type: 'EMPLOYER_REVIEW_ACCEPTED',
        referenceId: 'acceptance-9',
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        metadata: true,
      },
    });
    expect(prismaMock.employerDecisionEvent.findFirst).toHaveBeenCalledWith({
      where: {
        auditEventId: 'accept-audit-1',
      },
      orderBy: { decidedAt: 'desc' },
      select: {
        organizationContextId: true,
        metadata: true,
      },
    });
    expect(prismaMock.bundleShareEvent.findFirst).not.toHaveBeenCalled();
    expect(prismaMock.startOutcomeEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationContextId: 'org-ctx-9',
        daysFromFirstReview: 8,
        daysFromShare: null,
        daysFromReady: 4,
        metadata: expect.objectContaining({
          acceptanceId: 'acceptance-9',
          organizationId: 'org-9',
          organizationName: 'Acme Health',
          purposeOfUse: 'credential_review',
          bundleId: 'bundle-9',
          pilotId: 'pilot-9',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
          organizationContextId: 'org-ctx-9',
        }),
      }),
    }));
  });
});
