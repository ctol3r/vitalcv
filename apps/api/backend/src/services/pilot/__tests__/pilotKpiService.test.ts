import { PILOT_METRIC_EVENT_TYPES } from '../pilotOpsService';

describe('PILOT_METRIC_EVENT_TYPES funnel coverage', () => {
  it('includes passport_viewed, review_requested, review_opened for funnel tracking', () => {
    const types = PILOT_METRIC_EVENT_TYPES as readonly string[];
    expect(types).toContain('passport_viewed');
    expect(types).toContain('review_requested');
    expect(types).toContain('review_opened');
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
        metadata: {
          recordedAt: '2026-03-10T01:00:00.000Z',
          correctionGroupKey: 'pilot-case-entity-1',
        },
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
        metadata: {
          capturedAt: '2026-03-10T05:00:00.000Z',
          correctionGroupKey: 'pilot-case-entity-1',
          baselineProcessDurationDays: 30,
          manualCorrection: true,
        },
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
      distinctEntities: 1,
      readinessAtStart: {
        avgScore: 91,
        medianScore: 91,
        withBlockers: 0,
      },
    });
    expect(snapshot.proofSummary).toEqual({
      totalCases: 1,
      startedCases: 1,
      notStartedCases: 0,
      pendingCases: 0,
      casesWithBaseline: 1,
      casesWithMeasuredDelta: 1,
      usableProofCases: 1,
      avgMeasuredDeltaDays: 22,
      medianMeasuredDeltaDays: 22,
      automaticProofArtifactReady: true,
    });
    expect(snapshot.proofCases).toEqual([
      {
        entityId: 'entity-1',
        organizationContextId: 'org-1',
        baselineProcessDurationDays: 30,
        firstSharedAt: '2026-03-01T00:00:00.000Z',
        firstReviewAt: '2026-03-02T00:00:00.000Z',
        employerDecisionAt: '2026-03-04T00:00:00.000Z',
        actualStartDate: '2026-03-10T00:00:00.000Z',
        outcomeRecordedAt: '2026-03-10T05:00:00.000Z',
        outcomeStatus: 'started',
        started: true,
        nonStartReason: null,
        daysFromFirstShare: 8,
        daysFromFirstReview: 8,
        daysFromReady: 4,
        measuredProcessDurationDays: 8,
        measuredDeltaDays: 22,
        blockerResolution: {
          resolvedCount: 0,
          avgDays: null,
          medianDays: null,
        },
        manualCorrection: true,
        note: null,
      },
    ]);
    expect(snapshot.eventChain.startOutcomeEvents).toBe(2);

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

  it('tracks not-started proof cases without counting them as starts', async () => {
    prismaMock.bundleShareEvent.findMany.mockResolvedValue([
      {
        id: 'share-1',
        subjectEntityId: 'entity-2',
        organizationContextId: 'org-2',
        organizationId: 'employer-2',
        deliveryStatus: 'DELIVERED',
        sharedAt: new Date('2026-03-01T00:00:00.000Z'),
        npi: '2222222222',
      },
    ]);
    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        entityId: 'entity-2',
        organizationContextId: 'org-2',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-02T00:00:00.000Z'),
        readinessScoreAtEvent: 58,
        blockersAtEvent: ['LICENSURE_PENDING'],
        metadata: {},
      },
    ]);
    prismaMock.employerDecisionEvent.findMany.mockResolvedValue([
      {
        id: 'decision-1',
        entityId: 'entity-2',
        organizationContextId: 'org-2',
        decision: 'HOLD',
        decidedAt: new Date('2026-03-03T00:00:00.000Z'),
        readinessScoreAtDecision: 58,
        blockersAtDecision: ['LICENSURE_PENDING'],
        metadata: {},
      },
    ]);
    prismaMock.startOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'outcome-1',
        entityId: 'entity-2',
        organizationContextId: 'org-2',
        startedAt: new Date('2026-03-04T00:00:00.000Z'),
        daysFromFirstReview: null,
        daysFromShare: null,
        daysFromReady: null,
        readinessScoreAtStart: null,
        blockersAtStart: ['LICENSURE_PENDING'],
        metadata: {
          outcomeStatus: 'not_started',
          outcomeRecordedAt: '2026-03-04T00:00:00.000Z',
          baselineProcessDurationDays: 40,
          nonStartReason: 'Credentialing hold remained unresolved',
        },
      },
    ]);
    prismaMock.bundleShareEvent.count.mockResolvedValue(1);
    prismaMock.advisoryOutcomeEvent.count.mockResolvedValue(1);
    prismaMock.employerDecisionEvent.count.mockResolvedValue(1);
    prismaMock.startOutcomeEvent.count.mockResolvedValue(1);

    const snapshot = await computePilotKpis({ windowDays: 30 });

    expect(snapshot.startOutcomes.totalStarts).toBe(0);
    expect(snapshot.velocity.medianDaysFirstReviewToStart).toBeNull();
    expect(snapshot.proofSummary).toEqual({
      totalCases: 1,
      startedCases: 0,
      notStartedCases: 1,
      pendingCases: 0,
      casesWithBaseline: 1,
      casesWithMeasuredDelta: 0,
      usableProofCases: 0,
      avgMeasuredDeltaDays: null,
      medianMeasuredDeltaDays: null,
      automaticProofArtifactReady: false,
    });
    expect(snapshot.proofCases[0]).toMatchObject({
      entityId: 'entity-2',
      outcomeStatus: 'not_started',
      started: false,
      actualStartDate: null,
      nonStartReason: 'Credentialing hold remained unresolved',
      baselineProcessDurationDays: 40,
      employerDecisionAt: '2026-03-03T00:00:00.000Z',
      measuredDeltaDays: null,
    });
  });

  it('flags started cases that are missing a buyer baseline', async () => {
    prismaMock.advisoryOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'review-1',
        entityId: 'entity-3',
        organizationContextId: 'org-3',
        eventType: 'EMPLOYER_REVIEW',
        eventTimestamp: new Date('2026-03-02T00:00:00.000Z'),
        readinessScoreAtEvent: 70,
        blockersAtEvent: [],
        metadata: {},
      },
    ]);
    prismaMock.startOutcomeEvent.findMany.mockResolvedValue([
      {
        id: 'start-1',
        entityId: 'entity-3',
        organizationContextId: 'org-3',
        startedAt: new Date('2026-03-08T00:00:00.000Z'),
        daysFromFirstReview: 6,
        daysFromShare: null,
        daysFromReady: null,
        readinessScoreAtStart: 82,
        blockersAtStart: [],
        metadata: {},
      },
    ]);
    prismaMock.advisoryOutcomeEvent.count.mockResolvedValue(1);
    prismaMock.startOutcomeEvent.count.mockResolvedValue(1);

    const snapshot = await computePilotKpis({ windowDays: 30 });

    expect(snapshot.proofSummary.casesWithBaseline).toBe(0);
    expect(snapshot.proofCases[0]).toMatchObject({
      entityId: 'entity-3',
      outcomeStatus: 'started',
      measuredProcessDurationDays: 6,
      baselineProcessDurationDays: null,
      measuredDeltaDays: null,
    });
    expect(snapshot.gaps).toContain(
      'Started cases are missing baseline_process_duration_days — measured TTS deltas require the buyer/employer baseline.',
    );
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
        distinctEntities: 1,
        readinessAtStart: {
          avgScore: 91,
          medianScore: 91,
          withBlockers: 0,
        },
      },
      proofCases: [
        {
          entityId: 'entity-1',
          organizationContextId: 'org-1',
          baselineProcessDurationDays: 30,
          firstSharedAt: '2026-03-01T00:00:00.000Z',
          firstReviewAt: '2026-03-02T00:00:00.000Z',
          employerDecisionAt: '2026-03-03T00:00:00.000Z',
          actualStartDate: '2026-03-09T00:00:00.000Z',
          outcomeRecordedAt: '2026-03-09T01:00:00.000Z',
          outcomeStatus: 'started',
          started: true,
          nonStartReason: null,
          daysFromFirstShare: 8,
          daysFromFirstReview: 7,
          daysFromReady: 4,
          measuredProcessDurationDays: 7,
          measuredDeltaDays: 23,
          blockerResolution: {
            resolvedCount: 1,
            avgDays: 3,
            medianDays: 3,
          },
          manualCorrection: false,
          note: 'confirmed by operator',
        },
      ],
      proofSummary: {
        totalCases: 1,
        startedCases: 1,
        notStartedCases: 0,
        pendingCases: 0,
        casesWithBaseline: 1,
        casesWithMeasuredDelta: 1,
        usableProofCases: 1,
        avgMeasuredDeltaDays: 23,
        medianMeasuredDeltaDays: 23,
        automaticProofArtifactReady: true,
      },
      eventChain: {
        bundleShareEvents: 4,
        advisoryOutcomeEvents: 3,
        employerDecisionEvents: 2,
        blockerResolutionEvents: 0,
        startOutcomeEvents: 1,
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
      gaps: [],
    };

    const rows = kpiSnapshotToExportRows(snapshot);
    const csv = kpiSnapshotToCsv(snapshot);

    expect(rows).toEqual(expect.arrayContaining([
      { section: 'filters', label: 'geography_tag', value: '(all)' },
      { section: 'proof_summary', label: 'automatic_proof_artifact_ready', value: 'true' },
      { section: 'proof_case:entity-1', label: 'baseline_process_duration_days', value: '30' },
      { section: 'proof_case:entity-1', label: 'measured_delta_days', value: '23' },
      { section: 'velocity', label: 'median_days_share_to_decision', value: '4' },
      { section: 'velocity_samples', label: 'sample_share_to_decision', value: '2' },
      { section: 'event_chain', label: 'start_outcome_events', value: '1' },
    ]));
    expect(csv).toContain('section,label,value');
    expect(csv).toContain('proof_summary,automatic_proof_artifact_ready,true');
    expect(csv).toContain('proof_case:entity-1,measured_delta_days,23');
    expect(csv).toContain('velocity,median_days_share_to_decision,4');
    expect(csv).toContain('velocity_samples,sample_share_to_decision,2');
  });
});
