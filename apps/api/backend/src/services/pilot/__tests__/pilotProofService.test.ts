import { ApplicationStatus } from '@prisma/client';

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    auditEvent: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    application: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    verificationArtifact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    investigatorFinding: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    storyline: {
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    actionRecommendation: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

jest.mock('../../trust/trustStateEngine', () => ({
  getTrustStateHistory: jest.fn(),
}));

jest.mock('../pilotKpiService', () => ({
  computePilotKpis: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import { computePilotKpis } from '../pilotKpiService';
import {
  getPilotProofSummary,
  pilotProofSummaryToExportRows,
} from '../pilotProofService';

const prismaMock = prisma as unknown as {
  auditEvent: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  application: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  verificationArtifact: {
    findMany: jest.Mock;
    findFirst: jest.Mock;
  };
  investigatorFinding: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  storyline: {
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
  };
  actionRecommendation: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
};

const computePilotKpisMock = computePilotKpis as jest.MockedFunction<typeof computePilotKpis>;

describe('getPilotProofSummary', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-23T00:00:00.000Z'));

    computePilotKpisMock.mockReset().mockResolvedValue({
      generatedAt: '2026-03-23T00:00:00.000Z',
      windowDays: 30,
      since: '2026-02-21T00:00:00.000Z',
      appliedFilter: {
        pilotId: null,
        workflowLane: null,
        orgContextId: null,
        geographyTag: null,
      },
      isFiltered: false,
      packetShares: {
        total: 1,
        distinctEntities: 1,
        distinctOrgs: 1,
        byDeliveryStatus: { DELIVERED: 1 },
        earliestSharedAt: '2026-03-01T00:00:00.000Z',
        latestSharedAt: '2026-03-01T00:00:00.000Z',
      },
      reviewsOpened: {
        total: 1,
        distinctEntities: 1,
        byOrgContext: [{ orgContextId: 'ctx-1', count: 1 }],
        earliestAt: '2026-03-02T00:00:00.000Z',
        latestAt: '2026-03-02T00:00:00.000Z',
      },
      decisions: {
        total: 1,
        byType: { PROCEED: 1 },
        proceedCount: 1,
        refreshCount: 0,
        routeCount: 0,
        rejectCount: 0,
        holdCount: 0,
      },
      velocity: {
        medianDaysFirstReviewToDecision: 2,
        medianDaysFirstReviewToReady: 3,
        medianDaysFirstReviewToStart: 9,
        medianDaysShareToDecision: 4,
        sampleSizes: {
          reviewToDecision: 1,
          reviewToReady: 1,
          reviewToStart: 1,
          shareToDecision: 1,
        },
      },
      blockers: [{
        code: 'LICENSE_EXPIRED',
        openCount: 0,
        resolvedCount: 1,
        avgResolutionDays: 4,
        medianResolutionDays: 4,
        byResolutionMethod: { SOURCE_UPDATE: 1 },
      }],
      startOutcomes: {
        totalStarts: 1,
        totalOutcomeRecords: 2,
        didNotStartCount: 1,
        nonStartReasons: [{ reason: 'candidate_withdrew', count: 1 }],
        distinctEntities: 2,
        readinessAtStart: {
          avgScore: 82,
          medianScore: 82,
          withBlockers: 0,
        },
      },
      eventChain: {
        bundleShareEvents: 1,
        advisoryOutcomeEvents: 1,
        employerDecisionEvents: 1,
        blockerResolutionEvents: 0,
        blockerResolvedMetricEvents: 1,
        readinessChangeEvents: 1,
        startOutcomeEvents: 1,
        nonStartOutcomeEvents: 1,
        employerAcceptances: 0,
        startAttestations: 1,
      },
      readinessDistribution: {
        ready: 1,
        partial: 0,
        blocked: 0,
        total: 1,
        noScore: 0,
      },
      proofChain: {
        totalEvents: 4,
        totalCases: 1,
        replayableCases: 1,
        partialCases: 0,
        cases: [{
          caseKey: 'entity-1|ctx-1|pilot-1|perm-md|CA',
          entityId: 'entity-1',
          npi: null,
          organizationContextId: 'ctx-1',
          organizationId: 'org-1',
          eventNames: [
            'packet_shared',
            'employer_review_opened',
            'employer_decision_recorded',
            'start_outcome_recorded',
          ],
          missingCoreEvents: [],
          replayable: true,
          lastOccurredAt: '2026-03-10T00:00:00.000Z',
          nonStartReason: null,
        }],
        events: [{
          eventName: 'start_outcome_recorded',
          occurredAt: '2026-03-10T00:00:00.000Z',
          caseKey: 'entity-1|ctx-1|pilot-1|perm-md|CA',
          entityId: 'entity-1',
          npi: null,
          organizationContextId: 'ctx-1',
          organizationId: 'org-1',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
          sourceRecordType: 'StartOutcomeEvent',
          sourceRecordId: 'start-1',
          outcomeStatus: 'STARTED',
          detail: 'started',
        }],
      },
      gaps: [],
    } as never);

    prismaMock.auditEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.auditEvent.findFirst.mockReset().mockResolvedValue({ createdAt: new Date('2026-01-10T00:00:00.000Z') });

    prismaMock.application.findMany.mockReset().mockResolvedValue([
      {
        id: 'app-1',
        clerkUserId: 'user-1',
        npi: '1111111111',
        status: ApplicationStatus.PENDING,
        createdAt: new Date('2026-01-10T00:00:00.000Z'),
        updatedAt: new Date('2026-03-20T00:00:00.000Z'),
        reviewedAt: null,
      },
    ]);
    prismaMock.application.findFirst.mockReset().mockResolvedValue({ createdAt: new Date('2026-01-10T00:00:00.000Z') });

    prismaMock.verificationArtifact.findMany.mockReset().mockResolvedValue([
      {
        rawPayload: {
          npi: '1111111111',
          readiness_level: 'L3',
          readiness_score: 82,
          readiness_status: 'READY',
          computedAt: '2026-03-20T00:00:00.000Z',
          gap_summary: [],
        },
      },
    ]);
    prismaMock.verificationArtifact.findFirst.mockReset().mockResolvedValue({ verifiedAt: new Date('2026-01-10T00:00:00.000Z') });

    prismaMock.investigatorFinding.findMany.mockReset().mockResolvedValue([
      {
        findingId: 'finding-1',
        title: 'Primary source mismatch',
        severity: 'HIGH',
        createdAt: new Date('2026-03-20T00:00:00.000Z'),
        entityIds: ['entity-1'],
      },
    ]);
    prismaMock.investigatorFinding.count.mockReset()
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);
    prismaMock.investigatorFinding.findFirst.mockReset().mockResolvedValue({ createdAt: new Date('2026-01-10T00:00:00.000Z') });

    prismaMock.storyline.findMany.mockReset().mockResolvedValue([
      {
        storylineId: 'storyline-1',
        title: 'Credentialing delay cluster',
        createdAt: new Date('2026-03-21T00:00:00.000Z'),
        findingIds: ['finding-1'],
      },
    ]);
    prismaMock.storyline.count.mockReset()
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);
    prismaMock.storyline.findFirst.mockReset().mockResolvedValue({ createdAt: new Date('2026-01-10T00:00:00.000Z') });

    prismaMock.actionRecommendation.findMany.mockReset().mockResolvedValue([
      {
        id: 'action-1',
        targetEntityId: 'entity-1',
        createdAt: new Date('2026-03-22T00:00:00.000Z'),
        updatedAt: new Date('2026-03-22T02:00:00.000Z'),
        actionType: 'REQUEST_REFRESH',
      },
    ]);
    prismaMock.actionRecommendation.count.mockReset()
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps proof counts and baseline deltas anchored to persisted totals', async () => {
    const summary = await getPilotProofSummary();

    expect(summary.counts.findingsSurfaced).toBe(3);
    expect(summary.counts.storylinesSurfaced).toBe(2);
    expect(summary.counts.employerActionsGenerated).toBe(4);

    expect(summary.baselineComparison.current.findings).toBe(3);
    expect(summary.baselineComparison.current.storylines).toBe(2);
    expect(summary.baselineComparison.current.employerActionsGenerated).toBe(4);

    expect(summary.baselineComparison.baseline.findings).toBe(1);
    expect(summary.baselineComparison.baseline.storylines).toBe(1);
    expect(summary.baselineComparison.baseline.employerActionsGenerated).toBe(1);

    expect(summary.baselineComparison.delta.findings).toBe(2);
    expect(summary.baselineComparison.delta.storylines).toBe(1);
    expect(summary.baselineComparison.delta.employerActionsGenerated).toBe(3);
    expect(summary.livePilot.conversion).toEqual({
      shareToReviewRatePct: 100,
      reviewToDecisionRatePct: 100,
      reviewToProceedRatePct: 100,
      proceedToStartRatePct: 100,
    });
    expect(summary.livePilot.decisionOutcomes).toEqual(expect.objectContaining({
      total: 1,
      proceedCount: 1,
    }));
    expect(summary.livePilot.gaps).toEqual([]);
  });

  it('exports live pilot conversion, decision, blocker, and gap rows for proof packs', async () => {
    const summary = await getPilotProofSummary();
    const rows = pilotProofSummaryToExportRows(summary);

    expect(rows).toEqual(expect.arrayContaining([
      { section: 'conversion', label: 'share_to_review_rate_pct', value: '100' },
      { section: 'conversion', label: 'review_to_proceed_rate_pct', value: '100' },
      { section: 'decisions', label: 'proceed_count', value: '1' },
      { section: 'blocker:license_expired', label: 'avg_resolution_days', value: '4' },
      { section: 'live_pilot_gaps', label: 'status', value: 'none' },
    ]));
  });
});
