import { PILOT_METRIC_EVENT_TYPES } from '../pilotOpsService';

describe('PILOT_METRIC_EVENT_TYPES funnel coverage', () => {
  it('includes the launch funnel events needed for proof capture', () => {
    const types = PILOT_METRIC_EVENT_TYPES as readonly string[];
    expect(types).toContain('npi_submitted');
    expect(types).toContain('readiness_viewed');
    expect(types).toContain('passport_viewed');
    expect(types).toContain('review_opened');
    expect(types).toContain('employer_action_taken');
  });
});

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    bundleShareEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    advisoryOutcomeEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employerDecisionEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    blockerResolutionEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    startOutcomeEvent: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    employerAcceptance: {
      count: jest.fn(),
    },
    startAttestation: {
      count: jest.fn(),
    },
    auditEvent: {
      findMany: jest.fn(),
    },
  },
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../../graphql/prisma_client';
import {
  computePilotKpis,
  kpiSnapshotToExportRows,
  kpiSnapshotToCsv,
  type PilotKpiSnapshot,
} from '../pilotKpiService';

const prismaMock = prisma as unknown as {
  bundleShareEvent: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  advisoryOutcomeEvent: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  employerDecisionEvent: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  blockerResolutionEvent: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  startOutcomeEvent: {
    findMany: jest.Mock;
    count: jest.Mock;
  };
  employerAcceptance: {
    count: jest.Mock;
  };
  startAttestation: {
    count: jest.Mock;
  };
  auditEvent: {
    findMany: jest.Mock;
  };
};

describe('pilotKpiService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-23T00:00:00.000Z'));

    prismaMock.bundleShareEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.bundleShareEvent.count.mockReset().mockResolvedValue(0);
    prismaMock.advisoryOutcomeEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.advisoryOutcomeEvent.count.mockReset().mockResolvedValue(0);
    prismaMock.employerDecisionEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.employerDecisionEvent.count.mockReset().mockResolvedValue(0);
    prismaMock.blockerResolutionEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.blockerResolutionEvent.count.mockReset().mockResolvedValue(0);
    prismaMock.startOutcomeEvent.findMany.mockReset().mockResolvedValue([]);
    prismaMock.startOutcomeEvent.count.mockReset().mockResolvedValue(0);
    prismaMock.employerAcceptance.count.mockReset().mockResolvedValue(0);
    prismaMock.startAttestation.count.mockReset().mockResolvedValue(0);
    prismaMock.auditEvent.findMany.mockReset().mockResolvedValue([]);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('applies scoped queries consistently and collapses corrected start outcomes', async () => {
    prismaMock.bundleShareEvent.findMany.mockResolvedValue([
      {
        id: 'share-1',
        subjectEntityId: 'entity-1',
        organizationContextId: 'org-1',
        organizationId: 'employer-1',
        deliveryStatus: 'DELIVERED',
        sharedAt: new Date('2026-03-01T00:00:00.000Z'),
        npi: '1111111111',
      },
    ]);

    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-02T00:00:00.000Z'),
        readinessScoreAtEvent: 40,
        blockersAtEvent: [],
        metadata: { pilotId: 'pilot-1', workflowLane: 'lane-1', geographyTag: 'CA' },
      },
      {
        id: 'ready-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        eventType: 'PASSPORT_VIEW',
        eventTimestamp: new Date('2026-03-05T00:00:00.000Z'),
        readinessScoreAtEvent: 68,
        blockersAtEvent: [],
        metadata: { pilotId: 'pilot-1', workflowLane: 'lane-1', geographyTag: 'CA' },
      },
    ]);

    prismaMock.employerDecisionEvent.findMany.mockResolvedValue([
      {
        id: 'decision-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        decision: 'PROCEED',
        decidedAt: new Date('2026-03-04T00:00:00.000Z'),
        readinessScoreAtDecision: 70,
        blockersAtDecision: [],
        metadata: { pilotId: 'pilot-1', workflowLane: 'lane-1', geographyTag: 'CA' },
      },
    ]);

    prismaMock.blockerResolutionEvent.findMany.mockResolvedValue([
      {
        id: 'blocker-1',
        entityId: 'entity-1',
        blockerCode: 'LICENSE_EXPIRED',
        openedAt: new Date('2026-03-01T00:00:00.000Z'),
        resolvedAt: null,
        resolutionDays: null,
        resolutionMethod: null,
        status: 'OPEN',
      },
    ]);

    prismaMock.startOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'start-old',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
        daysFromFirstReview: 9,
        daysFromShare: 9,
        daysFromReady: 5,
        readinessScoreAtStart: 72,
        blockersAtStart: ['LICENSE_EXPIRED'],
        metadata: { recordedAt: '2026-03-10T01:00:00.000Z' },
      },
      {
        id: 'start-corrected',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        startedAt: new Date('2026-03-10T00:00:00.000Z'),
        daysFromFirstReview: 8,
        daysFromShare: 8,
        daysFromReady: 4,
        readinessScoreAtStart: 91,
        blockersAtStart: [],
        metadata: { capturedAt: '2026-03-10T05:00:00.000Z' },
      },
    ]);

    prismaMock.bundleShareEvent.count.mockResolvedValue(1);
    prismaMock.advisoryOutcomeEvent.count.mockResolvedValue(2);
    prismaMock.employerDecisionEvent.count.mockResolvedValue(1);
    prismaMock.blockerResolutionEvent.count.mockResolvedValue(1);
    prismaMock.startOutcomeEvent.count.mockResolvedValue(2);
    prismaMock.employerAcceptance.count.mockResolvedValue(1);
    prismaMock.startAttestation.count.mockResolvedValue(1);

    const snapshot = await computePilotKpis({
      windowDays: 30,
      filter: {
        pilotId: 'pilot-1',
        workflowLane: 'lane-1',
        orgContextId: 'org-1',
        geographyTag: 'CA',
      },
    });

    expect(snapshot.isFiltered).toBe(true);
    expect(snapshot.reviewsOpened.total).toBe(1);
    expect(snapshot.decisions.proceedCount).toBe(1);
    expect(snapshot.velocity.medianDaysFirstReviewToDecision).toBe(2);
    expect(snapshot.velocity.medianDaysFirstReviewToReady).toBe(3);
    expect(snapshot.velocity.medianDaysFirstReviewToStart).toBe(8);
    expect(snapshot.velocity.medianDaysShareToDecision).toBe(3);
    expect(snapshot.startOutcomes).toEqual({
      totalStarts: 1,
      totalOutcomeRecords: 1,
      didNotStartCount: 0,
      nonStartReasons: [],
      distinctEntities: 1,
      readinessAtStart: {
        avgScore: 91,
        medianScore: 91,
        withBlockers: 0,
      },
    });
    expect(snapshot.eventChain.startOutcomeEvents).toBe(2);
    expect(snapshot.proofChain).toEqual(expect.objectContaining({
      totalCases: 1,
      replayableCases: 1,
      partialCases: 0,
    }));
    expect(snapshot.proofChain.cases[0]).toEqual(expect.objectContaining({
      caseKey: 'entity-1|org-1',
      replayable: true,
      eventNames: [
        'packet_shared',
        'employer_review_opened',
        'employer_decision_recorded',
        'start_outcome_recorded',
      ],
    }));

    expect(prismaMock.bundleShareEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        sharedAt: { gte: new Date('2026-02-21T00:00:00.000Z') },
        organizationContextId: 'org-1',
      },
    }));

    const advisoryWhere = prismaMock.advisoryOutcomeEvent.findMany.mock.calls[0][0].where;
    expect(advisoryWhere).toMatchObject({
      eventTimestamp: { gte: new Date('2026-02-21T00:00:00.000Z') },
      organizationContextId: 'org-1',
      AND: expect.arrayContaining([
        { metadata: { path: ['pilotId'], equals: 'pilot-1' } },
        { metadata: { path: ['workflowLane'], equals: 'lane-1' } },
        { metadata: { path: ['geographyTag'], equals: 'CA' } },
      ]),
    });

    const blockerWhere = prismaMock.blockerResolutionEvent.findMany.mock.calls[0][0].where;
    expect(blockerWhere).toMatchObject({
      openedAt: { gte: new Date('2026-02-21T00:00:00.000Z') },
      AND: expect.arrayContaining([
        { metadata: { path: ['pilotId'], equals: 'pilot-1' } },
      ]),
    });
    expect(blockerWhere).not.toHaveProperty('organizationContextId');
  });

  it('does not collapse repeated clinician activity across verifier org contexts into one velocity sample', async () => {
    prismaMock.bundleShareEvent.findMany.mockResolvedValue([
      {
        id: 'share-org-1',
        subjectEntityId: 'entity-1',
        organizationContextId: 'org-1',
        organizationId: 'employer-1',
        deliveryStatus: 'DELIVERED',
        sharedAt: new Date('2026-03-01T00:00:00.000Z'),
        npi: '1111111111',
      },
      {
        id: 'share-org-2',
        subjectEntityId: 'entity-1',
        organizationContextId: 'org-2',
        organizationId: 'employer-2',
        deliveryStatus: 'DELIVERED',
        sharedAt: new Date('2026-03-02T00:00:00.000Z'),
        npi: '1111111111',
      },
    ]);

    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-org-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-02T00:00:00.000Z'),
        readinessScoreAtEvent: 55,
        blockersAtEvent: [],
        metadata: { pilotId: 'pilot-1', workflowLane: 'perm-md', geographyTag: 'CA' },
      },
      {
        id: 'review-org-2',
        entityId: 'entity-1',
        organizationContextId: 'org-2',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-03T00:00:00.000Z'),
        readinessScoreAtEvent: 61,
        blockersAtEvent: [],
        metadata: { pilotId: 'pilot-2', workflowLane: 'locum-rn', geographyTag: 'TX' },
      },
    ]);

    prismaMock.employerDecisionEvent.findMany.mockResolvedValue([
      {
        id: 'decision-org-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        decision: 'PROCEED',
        decidedAt: new Date('2026-03-04T00:00:00.000Z'),
        readinessScoreAtDecision: 70,
        blockersAtDecision: [],
        metadata: { pilotId: 'pilot-1', workflowLane: 'perm-md', geographyTag: 'CA' },
      },
      {
        id: 'decision-org-2',
        entityId: 'entity-1',
        organizationContextId: 'org-2',
        decision: 'HOLD',
        decidedAt: new Date('2026-03-05T00:00:00.000Z'),
        readinessScoreAtDecision: 74,
        blockersAtDecision: [],
        metadata: { pilotId: 'pilot-2', workflowLane: 'locum-rn', geographyTag: 'TX' },
      },
    ]);

    prismaMock.bundleShareEvent.count.mockResolvedValue(2);
    prismaMock.advisoryOutcomeEvent.count.mockResolvedValue(2);
    prismaMock.employerDecisionEvent.count.mockResolvedValue(2);

    const snapshot = await computePilotKpis({ windowDays: 30 });

    expect(snapshot.reviewsOpened.total).toBe(2);
    expect(snapshot.decisions.total).toBe(2);
    expect(snapshot.velocity.sampleSizes.reviewToDecision).toBe(2);
    expect(snapshot.velocity.sampleSizes.shareToDecision).toBe(2);
    expect(snapshot.velocity.medianDaysFirstReviewToDecision).toBe(2);
    expect(snapshot.velocity.medianDaysShareToDecision).toBe(3);
  });

  it('keeps packet-share attribution warnings explicit when pilot-only scope filters are active', async () => {
    const snapshot = await computePilotKpis({
      windowDays: 30,
      filter: {
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        geographyTag: 'CA',
      },
    });

    expect(snapshot.gaps).toContain(
      'Bundle share events are only org-context scoped today. Exact packet-share attribution still requires bundle-share scope metadata when multiple pilots or lanes are active.',
    );
  });

  it('excludes legacy refresh advisories while counting refresh decisions and non-start proof events', async () => {
    prismaMock.bundleShareEvent.findMany.mockResolvedValue([
      {
        id: 'share-1',
        bundleId: 'bundle-1',
        subjectEntityId: 'entity-1',
        organizationContextId: 'org-1',
        organizationId: 'employer-1',
        deliveryStatus: 'DELIVERED',
        sharedAt: new Date('2026-03-01T00:00:00.000Z'),
        npi: '1111111111',
      },
    ]);

    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        advisoryVersion: 'pilot-review-open',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-02T00:00:00.000Z'),
        readinessScoreAtEvent: 42,
        blockersAtEvent: [],
        metadata: {
          eventName: 'employer_review_opened',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
          bundleId: 'bundle-1',
          organizationId: 'employer-1',
        },
      },
      {
        id: 'legacy-refresh-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        advisoryVersion: null,
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-03T00:00:00.000Z'),
        readinessScoreAtEvent: 42,
        blockersAtEvent: ['LICENSURE'],
        metadata: {
          reason: 'refresh_requested',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
        },
      },
    ]);

    prismaMock.employerDecisionEvent.findMany.mockResolvedValue([
      {
        id: 'decision-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        decision: 'REQUEST_REFRESH',
        decidedAt: new Date('2026-03-04T00:00:00.000Z'),
        readinessScoreAtDecision: 52,
        blockersAtDecision: ['LICENSURE'],
        metadata: {
          eventName: 'employer_decision_recorded',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
          organizationId: 'employer-1',
          bundleId: 'bundle-1',
        },
      },
    ]);

    prismaMock.auditEvent.findMany.mockResolvedValue([
      {
        id: 'audit-readiness-1',
        type: 'PILOT_PROOF_EVENT',
        referenceId: 'entity-1',
        clinicianId: '1111111111',
        organizationId: 'employer-1',
        createdAt: new Date('2026-03-05T00:00:00.000Z'),
        metadata: {
          schema: 'vitalcv.pilot-proof.event.v1',
          eventName: 'readiness_changed',
          entityId: 'entity-1',
          npi: '1111111111',
          organizationContextId: 'org-1',
          occurredAt: '2026-03-05T00:00:00.000Z',
          previousBand: 'L1',
          newBand: 'L2',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
        },
      },
      {
        id: 'audit-blocker-1',
        type: 'PILOT_OPS_EVENT',
        referenceId: 'entity-1',
        clinicianId: '1111111111',
        organizationId: 'employer-1',
        createdAt: new Date('2026-03-06T00:00:00.000Z'),
        metadata: {
          eventType: 'blocker_resolved',
          organizationContextId: 'org-1',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
          entity: { id: 'entity-1', label: 'Dr. Jane Doe' },
          details: { blockerCode: 'LICENSURE' },
        },
      },
      {
        id: 'audit-non-start-1',
        type: 'PILOT_PROOF_EVENT',
        referenceId: 'entity-1',
        clinicianId: '1111111111',
        organizationId: 'employer-1',
        createdAt: new Date('2026-03-07T00:00:00.000Z'),
        metadata: {
          schema: 'vitalcv.pilot-proof.event.v1',
          eventName: 'start_outcome_recorded',
          entityId: 'entity-1',
          npi: '1111111111',
          organizationContextId: 'org-1',
          occurredAt: '2026-03-07T00:00:00.000Z',
          outcomeStatus: 'DID_NOT_START',
          nonStartReason: 'candidate_withdrew',
          pilotId: 'pilot-1',
          workflowLane: 'perm-md',
          geographyTag: 'CA',
        },
      },
    ]);

    prismaMock.bundleShareEvent.count.mockResolvedValue(1);
    prismaMock.advisoryOutcomeEvent.count.mockResolvedValue(2);
    prismaMock.employerDecisionEvent.count.mockResolvedValue(1);
    prismaMock.blockerResolutionEvent.count.mockResolvedValue(0);
    prismaMock.startOutcomeEvent.count.mockResolvedValue(0);

    const snapshot = await computePilotKpis({
      windowDays: 30,
      filter: {
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        orgContextId: 'org-1',
        geographyTag: 'CA',
      },
    });

    expect(snapshot.reviewsOpened.total).toBe(1);
    expect(snapshot.decisions.refreshCount).toBe(1);
    expect(snapshot.startOutcomes).toEqual(expect.objectContaining({
      totalStarts: 0,
      totalOutcomeRecords: 1,
      didNotStartCount: 1,
      nonStartReasons: [{ reason: 'candidate_withdrew', count: 1 }],
      distinctEntities: 1,
    }));
    expect(snapshot.eventChain).toEqual(expect.objectContaining({
      blockerResolvedMetricEvents: 1,
      readinessChangeEvents: 1,
      nonStartOutcomeEvents: 1,
    }));
    expect(snapshot.proofChain).toEqual(expect.objectContaining({
      totalEvents: 6,
      totalCases: 1,
      replayableCases: 1,
      partialCases: 0,
    }));
    expect(snapshot.proofChain.cases[0]).toEqual(expect.objectContaining({
      eventNames: [
        'packet_shared',
        'employer_review_opened',
        'employer_decision_recorded',
        'readiness_changed',
        'blocker_resolved',
        'start_outcome_recorded',
      ],
      nonStartReason: 'candidate_withdrew',
      replayable: true,
    }));
  });

  it('does not invent filtered start counts from unscoped canonical starts', async () => {
    prismaMock.startAttestation.count.mockResolvedValue(2);

    const snapshot = await computePilotKpis({
      windowDays: 30,
      filter: {
        pilotId: 'pilot-1',
        workflowLane: 'lane-1',
        orgContextId: 'org-1',
        geographyTag: 'CA',
      },
    });

    expect(snapshot.startOutcomes.totalStarts).toBe(0);
    expect(snapshot.gaps).toContain(
      'No start outcome events with daysFromFirstReview — fire captureStartOutcome at StartAttestation creation.',
    );
    expect(snapshot.gaps).toContain(
      'Scoped start KPIs rely on start_outcome_events. Canonical start_attestations are unscoped health signals only and are excluded from filtered start metrics.',
    );
  });

  it('buckets readiness distribution from the latest review event per clinician', async () => {
    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-02T00:00:00.000Z'),
        readinessScoreAtEvent: 72,
        blockersAtEvent: [],
        metadata: {},
      },
      {
        id: 'review-2',
        entityId: 'entity-2',
        organizationContextId: 'org-1',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-03T00:00:00.000Z'),
        readinessScoreAtEvent: 25,
        blockersAtEvent: ['LICENSE_EXPIRED'],
        metadata: {},
      },
      {
        id: 'review-3',
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-04T00:00:00.000Z'),
        readinessScoreAtEvent: null,
        blockersAtEvent: ['MANUAL_REVIEW'],
        metadata: {},
      },
    ]);

    const snapshot = await computePilotKpis({ windowDays: 30 });

    expect(snapshot.readinessDistribution).toEqual({
      ready: 0,
      partial: 0,
      blocked: 1,
      total: 2,
      noScore: 1,
    });
  });

  it('exports normalized row-shaped data for downstream spreadsheets', () => {
    const snapshot: PilotKpiSnapshot = {
      generatedAt: '2026-03-23T21:00:00.000Z',
      windowDays: 90,
      since: '2025-12-23T21:00:00.000Z',
      appliedFilter: {
        pilotId: null,
        workflowLane: null,
        orgContextId: null,
        geographyTag: null,
      },
      isFiltered: false,
      packetShares: {
        total: 4,
        distinctEntities: 3,
        distinctOrgs: 2,
        byDeliveryStatus: { DELIVERED: 4 },
        earliestSharedAt: '2026-03-01T00:00:00.000Z',
        latestSharedAt: '2026-03-04T00:00:00.000Z',
      },
      reviewsOpened: {
        total: 2,
        distinctEntities: 2,
        byOrgContext: [],
        earliestAt: '2026-03-02T00:00:00.000Z',
        latestAt: '2026-03-03T00:00:00.000Z',
      },
      decisions: {
        total: 2,
        byType: { PROCEED: 2 },
        proceedCount: 2,
        refreshCount: 0,
        routeCount: 0,
        rejectCount: 0,
        holdCount: 0,
      },
      velocity: {
        medianDaysFirstReviewToDecision: 2,
        medianDaysFirstReviewToReady: 3,
        medianDaysFirstReviewToStart: 7,
        medianDaysShareToDecision: 4,
        sampleSizes: {
          reviewToDecision: 2,
          reviewToReady: 2,
          reviewToStart: 1,
          shareToDecision: 2,
        },
      },
      blockers: [],
      startOutcomes: {
        totalStarts: 1,
        totalOutcomeRecords: 1,
        didNotStartCount: 0,
        nonStartReasons: [],
        distinctEntities: 1,
        readinessAtStart: {
          avgScore: 91,
          medianScore: 91,
          withBlockers: 0,
        },
      },
      eventChain: {
        bundleShareEvents: 4,
        advisoryOutcomeEvents: 3,
        employerDecisionEvents: 2,
        blockerResolutionEvents: 0,
        blockerResolvedMetricEvents: 0,
        readinessChangeEvents: 0,
        startOutcomeEvents: 1,
        nonStartOutcomeEvents: 0,
        employerAcceptances: 1,
        startAttestations: 1,
      },
      readinessDistribution: {
        ready: 1,
        partial: 1,
        blocked: 0,
        total: 2,
        noScore: 0,
      },
      proofChain: {
        totalEvents: 1,
        totalCases: 1,
        replayableCases: 0,
        partialCases: 1,
        cases: [{
          caseKey: 'entity-1|org-1',
          entityId: 'entity-1',
          npi: null,
          organizationContextId: 'org-1',
          organizationId: 'employer-1',
          eventNames: ['packet_shared'],
          missingCoreEvents: [
            'employer_review_opened',
            'employer_decision_recorded',
            'start_outcome_recorded',
          ],
          replayable: false,
          lastOccurredAt: '2026-03-01T00:00:00.000Z',
          nonStartReason: null,
        }],
        events: [{
          eventName: 'packet_shared',
          occurredAt: '2026-03-01T00:00:00.000Z',
          caseKey: 'entity-1|org-1',
          entityId: 'entity-1',
          npi: '1111111111',
          organizationContextId: 'org-1',
          organizationId: 'employer-1',
          pilotId: null,
          workflowLane: null,
          geographyTag: null,
          sourceRecordType: 'BundleShareEvent',
          sourceRecordId: 'share-1',
          outcomeStatus: null,
          detail: 'DELIVERED',
        }],
      },
      gaps: [],
    };

    const rows = kpiSnapshotToExportRows(snapshot);
    const csv = kpiSnapshotToCsv(snapshot);

    expect(rows).toEqual(expect.arrayContaining([
      { section: 'filters', label: 'geography_tag', value: '(all)' },
      { section: 'velocity', label: 'median_days_share_to_decision', value: '4' },
      { section: 'velocity_samples', label: 'sample_share_to_decision', value: '2' },
      { section: 'event_chain', label: 'start_outcome_events', value: '1' },
      { section: 'proof_chain_summary', label: 'partial_cases', value: '1' },
      { section: 'proof_chain_case:1', label: 'case_key', value: 'entity-1|org-1' },
      { section: 'proof_chain_event:1', label: 'event_name', value: 'packet_shared' },
    ]));
    expect(csv).toContain('section,label,value');
    expect(csv).toContain('velocity,median_days_share_to_decision,4');
    expect(csv).toContain('velocity_samples,sample_share_to_decision,2');
    expect(csv).toContain('proof_chain_summary,partial_cases,1');
  });
});
