import express from 'express';
import request from 'supertest';

jest.mock('../../services/pilot/pilotKpiService', () => ({
  computePilotKpis: jest.fn(),
  kpiSnapshotToCsv: jest.fn(),
}));

jest.mock('../../services/pilot/roiReportService', () => ({
  generateRoiReport: jest.fn(),
  roiReportToHtml: jest.fn(),
}));

jest.mock('../../services/seal/sealEventCapture', () => ({
  captureAdvisoryEvent: jest.fn(() => Promise.resolve()),
  captureStartOutcome: jest.fn(() => Promise.resolve()),
  recordPilotProofEvent: jest.fn(() => Promise.resolve()),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../services/entity/employerReviewAttribution', () => ({
  resolveEmployerReviewAttribution: jest.fn(),
}));

import {
  computePilotKpis,
  kpiSnapshotToCsv,
} from '../../services/pilot/pilotKpiService';
import {
  captureAdvisoryEvent,
  captureStartOutcome,
  recordPilotProofEvent,
} from '../../services/seal/sealEventCapture';
import { resolveEmployerReviewAttribution } from '../../services/entity/employerReviewAttribution';
import { registerPilotKpiRoutes } from '../pilotKpi';

const computePilotKpisMock = computePilotKpis as jest.MockedFunction<typeof computePilotKpis>;
const kpiSnapshotToCsvMock = kpiSnapshotToCsv as jest.MockedFunction<typeof kpiSnapshotToCsv>;
const captureAdvisoryEventMock =
  captureAdvisoryEvent as jest.MockedFunction<typeof captureAdvisoryEvent>;
const captureStartOutcomeMock =
  captureStartOutcome as jest.MockedFunction<typeof captureStartOutcome>;
const recordPilotProofEventMock =
  recordPilotProofEvent as jest.MockedFunction<typeof recordPilotProofEvent>;
const resolveEmployerReviewAttributionMock =
  resolveEmployerReviewAttribution as jest.MockedFunction<typeof resolveEmployerReviewAttribution>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerPilotKpiRoutes(app);
  app.use((err: { status?: number; statusCode?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? err.statusCode ?? 500).json({ error: err.message ?? 'error' });
  });
  return app;
}

describe('pilot KPI routes', () => {
  beforeEach(() => {
    process.env.MONITORING_SECRET = 'monitoring-secret';
    computePilotKpisMock.mockReset().mockResolvedValue({
      generatedAt: '2026-03-29T16:00:00.000Z',
      windowDays: 30,
      since: '2026-02-28T16:00:00.000Z',
      appliedFilter: {
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        orgContextId: 'org-1',
        geographyTag: 'CA',
      },
      isFiltered: true,
      packetShares: {
        total: 1,
        distinctEntities: 1,
        distinctOrgs: 1,
        byDeliveryStatus: { DELIVERED: 1 },
        earliestSharedAt: null,
        latestSharedAt: null,
      },
      reviewsOpened: {
        total: 1,
        distinctEntities: 1,
        byOrgContext: [],
        earliestAt: null,
        latestAt: null,
      },
      decisions: {
        total: 0,
        byType: {},
        proceedCount: 0,
        refreshCount: 0,
        routeCount: 0,
        rejectCount: 0,
        holdCount: 0,
      },
      velocity: {
        medianDaysFirstReviewToDecision: null,
        medianDaysFirstReviewToReady: null,
        medianDaysFirstReviewToStart: null,
        medianDaysShareToDecision: null,
        sampleSizes: {
          reviewToDecision: 0,
          reviewToReady: 0,
          reviewToStart: 0,
          shareToDecision: 0,
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
        bundleShareEvents: 1,
        advisoryOutcomeEvents: 1,
        employerDecisionEvents: 0,
        blockerResolutionEvents: 0,
        blockerResolvedMetricEvents: 0,
        readinessChangeEvents: 0,
        startOutcomeEvents: 1,
        nonStartOutcomeEvents: 0,
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
        totalEvents: 0,
        totalCases: 0,
        replayableCases: 0,
        partialCases: 0,
        cases: [],
        events: [],
      },
      gaps: [],
    } as never);
    kpiSnapshotToCsvMock.mockReset().mockReturnValue('section,label,value\nfilters,geography_tag,CA');
    captureAdvisoryEventMock.mockReset().mockResolvedValue(undefined);
    captureStartOutcomeMock.mockReset().mockResolvedValue(undefined);
    recordPilotProofEventMock.mockReset().mockResolvedValue(undefined);
    resolveEmployerReviewAttributionMock.mockReset().mockResolvedValue({
      source: 'bundle_share',
      organizationContextId: 'ctx-1',
      bundleShareEventId: 'share-1',
      bundleId: 'bundle-1',
      requestorEntityId: 'requestor-1',
      organizationId: 'org-1',
      organizationName: 'Acme Health',
      purposeOfUse: 'credential_review',
    } as never);
  });

  it('exports CSV with the same scoped filter contract used by pilot reporting', async () => {
    const response = await request(buildApp())
      .get('/api/internal/pilot/kpis/export?days=30&org=org-1&pilotId=pilot-1&lane=perm-md&geo=CA')
      .set('x-monitoring-secret', 'monitoring-secret')
      .expect(200);

    expect(computePilotKpisMock).toHaveBeenCalledWith({
      windowDays: 30,
      filter: {
        orgContextId: 'org-1',
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        geographyTag: 'CA',
      },
    });
    expect(kpiSnapshotToCsvMock).toHaveBeenCalled();
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.headers['content-disposition']).toContain('vitalcv-pilot-kpis-');
    expect(response.text).toContain('filters,geography_tag,CA');
  });

  it('captures employer review-open events with scope and review context intact', async () => {
    const entityId = '00000000-0000-0000-0000-000000000111';

    const response = await request(buildApp())
      .post(`/api/employer-review/${entityId}/view`)
      .set('x-clerk-user-id', 'employer-1')
      .send({
        organizationContextId: 'ctx-1',
        readinessScore: 88,
        blockers: ['DEA_REGISTRATION'],
        sharedBy: 'Ada Lovelace',
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        geographyTag: 'CA',
      });

    expect(response.status).toBe(202);

    expect(response.body).toEqual({ ok: true, queued: true });
    expect(captureAdvisoryEventMock).toHaveBeenCalledWith(expect.objectContaining({
      entityId,
      organizationContextId: 'ctx-1',
      advisoryVersion: 'pilot-review-open',
      eventType: 'EMPLOYER_REVIEW',
      blockersAtEvent: ['DEA_REGISTRATION'],
      readinessScoreAtEvent: 88,
      metadata: expect.objectContaining({
        eventName: 'employer_review_opened',
        bundleId: 'bundle-1',
        bundleShareEventId: 'share-1',
        organizationId: 'org-1',
        organizationName: 'Acme Health',
        purposeOfUse: 'credential_review',
        sharedBy: 'Ada Lovelace',
        reviewerClerkId: 'employer-1',
      }),
      scope: {
        orgContextId: 'ctx-1',
        pilotId: 'pilot-1',
        workflowLane: 'perm-md',
        geographyTag: 'CA',
      },
    }));
  });

  it('records manual start outcomes with pilot scope instead of dropping them on route entry', async () => {
    const entityId = '00000000-0000-0000-0000-000000000222';
    const startedAt = '2026-03-29T16:00:00.000Z';

    const response = await request(buildApp())
      .post('/api/internal/pilot/start-outcome')
      .set('x-monitoring-secret', 'monitoring-secret')
      .send({
        entityId,
        organizationContextId: 'ctx-2',
        pilotId: 'pilot-2',
        workflowLane: 'locum-rn',
        geographyTag: 'TX',
        startedAt,
        readinessScoreAtStart: 91,
        blockers: ['DEA_REGISTRATION'],
        note: 'Manual pilot operator capture',
      })
      .expect(202);

    expect(response.body).toEqual({
      ok: true,
      queued: true,
      entityId,
      startedAt,
    });
    expect(captureStartOutcomeMock).toHaveBeenCalledWith(expect.objectContaining({
      entityId,
      organizationContextId: 'ctx-2',
      startedAt: new Date(startedAt),
      readinessScoreAtStart: 91,
      blockersAtStart: ['DEA_REGISTRATION'],
      sourceCoverageAtStart: {},
      metadata: expect.objectContaining({
        recordedBy: 'operator-manual',
        note: 'Manual pilot operator capture',
        monitoredAt: expect.any(String),
      }),
      scope: {
        orgContextId: 'ctx-2',
        pilotId: 'pilot-2',
        workflowLane: 'locum-rn',
        geographyTag: 'TX',
      },
    }));
  });

  it('records did-not-start outcomes into the proof chain instead of forcing a startedAt value', async () => {
    const entityId = '00000000-0000-0000-0000-000000000333';
    const recordedAt = '2026-03-29T18:00:00.000Z';

    const response = await request(buildApp())
      .post('/api/internal/pilot/start-outcome')
      .set('x-monitoring-secret', 'monitoring-secret')
      .send({
        entityId,
        organizationContextId: 'ctx-3',
        pilotId: 'pilot-3',
        workflowLane: 'travel-rn',
        geographyTag: 'NV',
        status: 'DID_NOT_START',
        nonStartReason: 'candidate_withdrew',
        nonStartCategory: 'candidate',
        note: 'Candidate paused after review',
        recordedAt,
      })
      .expect(202);

    expect(response.body).toEqual({
      ok: true,
      queued: true,
      entityId,
      status: 'DID_NOT_START',
      nonStartReason: 'candidate_withdrew',
      recordedAt,
    });
    expect(recordPilotProofEventMock).toHaveBeenCalledWith({
      eventName: 'start_outcome_recorded',
      entityId,
      organizationContextId: 'ctx-3',
      occurredAt: recordedAt,
      metadata: {
        outcomeStatus: 'DID_NOT_START',
        nonStartReason: 'candidate_withdrew',
        nonStartCategory: 'candidate',
        note: 'Candidate paused after review',
        pilotId: 'pilot-3',
        workflowLane: 'travel-rn',
        geographyTag: 'NV',
      },
    });
    expect(captureStartOutcomeMock).not.toHaveBeenCalled();
  });
});
