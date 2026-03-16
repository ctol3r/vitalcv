import express from 'express';
import request from 'supertest';

jest.mock('../../services/storylines/storylineService', () => ({
  listStorylines: jest.fn(),
  getStorylineDetail: jest.fn(),
  acknowledgeStoryline: jest.fn(),
  escalateStoryline: jest.fn(),
  archiveStoryline: jest.fn(),
  saveStorylineInvestigation: jest.fn(),
}));

jest.mock('../../services/investigation/investigationWorkbenchService', () => ({
  buildStorylineInvestigationPayload: jest.fn(),
}));

import {
  acknowledgeStoryline,
  archiveStoryline,
  escalateStoryline,
  getStorylineDetail,
  listStorylines,
  saveStorylineInvestigation,
} from '../../services/storylines/storylineService';
import {
  storylineDetailResponseSchema,
  storylineListResponseSchema,
} from '../../services/storylines/contracts';
import { buildStorylineInvestigationPayload } from '../../services/investigation/investigationWorkbenchService';
import { registerStorylineRoutes } from '../storylines';

const listStorylinesMock = listStorylines as jest.MockedFunction<typeof listStorylines>;
const getStorylineDetailMock = getStorylineDetail as jest.MockedFunction<typeof getStorylineDetail>;
const acknowledgeStorylineMock = acknowledgeStoryline as jest.MockedFunction<typeof acknowledgeStoryline>;
const escalateStorylineMock = escalateStoryline as jest.MockedFunction<typeof escalateStoryline>;
const archiveStorylineMock = archiveStoryline as jest.MockedFunction<typeof archiveStoryline>;
const saveStorylineInvestigationMock = saveStorylineInvestigation as jest.MockedFunction<typeof saveStorylineInvestigation>;
const buildStorylineInvestigationPayloadMock = buildStorylineInvestigationPayload as jest.MockedFunction<typeof buildStorylineInvestigationPayload>;

function sampleStoryline(status: 'active' | 'quiet' | 'escalated' | 'resolved' | 'archived' = 'active') {
  return {
    storylineId: 'stl_123',
    fingerprint: 'abc123',
    storylineType: 'trust decline' as const,
    perspective: 'provider' as const,
    title: 'Trust risk rising for provider 1558302470',
    summary: 'Trust pressure is building around provider 1558302470.',
    whyItMatters: 'This matters because trust degradation can affect launch decisions.',
    recommendedActions: ['Open provider investigation'],
    severity: 'high' as const,
    confidence: 0.84,
    entityIds: ['provider:1558302470'],
    findingIds: ['fnd_1', 'fnd_2'],
    supportingEvidence: [
      {
        bullet: 'Trust score declined: stale licensure source',
        source: 'TrustScoreV1',
        confidence: 0.92,
        observedAt: '2026-03-15T12:00:00.000Z',
        findingId: 'fnd_1',
      },
    ],
    createdAt: '2026-03-10T12:00:00.000Z',
    updatedAt: '2026-03-15T12:00:00.000Z',
    lastActivityAt: '2026-03-15T12:00:00.000Z',
    status,
    progressionScore: 0.83,
    noveltyScore: 0.61,
    persistenceScore: 0.58,
    escalationThreshold: 0.63,
    timeline: {
      originEvent: {
        eventKey: 'evt_origin',
        type: 'origin' as const,
        summary: 'Storyline originated from 2 related findings.',
        occurredAt: '2026-03-10T12:00:00.000Z',
        findingIds: ['fnd_1'],
        toStatus: status,
        metadata: {},
      },
      events: [
        {
          eventKey: 'evt_origin',
          type: 'origin' as const,
          summary: 'Storyline originated from 2 related findings.',
          occurredAt: '2026-03-10T12:00:00.000Z',
          findingIds: ['fnd_1'],
          toStatus: status,
          metadata: {},
        },
      ],
      quietPeriods: 0,
      reactivations: 0,
      lastEventAt: '2026-03-10T12:00:00.000Z',
      lastActivityAt: '2026-03-15T12:00:00.000Z',
      currentStatus: status,
    },
    metadata: {},
  };
}

function sampleDetail(status: 'active' | 'quiet' | 'escalated' | 'resolved' | 'archived' = 'active') {
  return {
    storyline: sampleStoryline(status),
    findingLinks: [
      {
        findingId: 'fnd_1',
        findingCategory: 'TRUST_DECLINE',
        findingSeverity: 'high' as const,
        observedAt: '2026-03-15T12:00:00.000Z',
        weight: 0.92,
        snapshot: {
          title: 'Trust score declined 12 pts',
        },
      },
    ],
    entityLinks: [
      {
        entityType: 'provider' as const,
        entityKey: '1558302470',
        entityLabel: 'Provider 1558302470',
        weight: 1,
        firstSeenAt: '2026-03-10T12:00:00.000Z',
        lastSeenAt: '2026-03-15T12:00:00.000Z',
      },
    ],
    statusEvents: sampleStoryline(status).timeline.events,
    actionEvents: [
      {
        eventKey: 'act_1',
        actionType: 'acknowledge' as const,
        actorId: 'ops-user',
        note: 'Reviewed by trust ops',
        payload: {},
        occurredAt: '2026-03-15T12:05:00.000Z',
      },
    ],
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerStorylineRoutes(app);
  return app;
}

describe('storyline routes', () => {
  beforeEach(() => {
    listStorylinesMock.mockReset();
    getStorylineDetailMock.mockReset();
    acknowledgeStorylineMock.mockReset();
    escalateStorylineMock.mockReset();
    archiveStorylineMock.mockReset();
    saveStorylineInvestigationMock.mockReset();
    buildStorylineInvestigationPayloadMock.mockReset();
  });

  it('returns the storyline list contract and forwards filters', async () => {
    const app = buildApp();
    listStorylinesMock.mockResolvedValue({
      storylines: [sampleStoryline()],
      syncedAt: '2026-03-15T12:00:00.000Z',
    });

    const response = await request(app)
      .get('/api/storylines')
      .query({
        storylineType: 'trust decline',
        severity: 'high',
        provider: '1558302470',
        perspective: 'provider',
        sync: 'false',
      })
      .expect(200);

    expect(listStorylinesMock).toHaveBeenCalledWith(expect.objectContaining({
      storylineType: 'trust decline',
      severity: 'high',
      provider: '1558302470',
      perspective: 'provider',
      sync: false,
    }));
    expect(() => storylineListResponseSchema.parse(response.body)).not.toThrow();
  });

  it('acknowledges a storyline and returns the detail contract', async () => {
    const app = buildApp();
    acknowledgeStorylineMock.mockResolvedValue(sampleDetail('quiet'));

    const response = await request(app)
      .post('/api/storylines/stl_123/acknowledge')
      .send({ actorId: 'ops-user', note: 'Reviewed by trust ops' })
      .expect(200);

    expect(acknowledgeStorylineMock).toHaveBeenCalledWith({
      storylineId: 'stl_123',
      actorId: 'ops-user',
      note: 'Reviewed by trust ops',
    });
    expect(() => storylineDetailResponseSchema.parse(response.body)).not.toThrow();
  });

  it('returns the storyline investigation payload', async () => {
    const app = buildApp();
    buildStorylineInvestigationPayloadMock.mockResolvedValue({
      generatedAt: '2026-03-15T12:00:00.000Z',
      storylineId: 'stl_123',
      detail: {
        ...sampleDetail(),
        lifecycleStage: 'developing',
        score: {
          maxFindingConfidence: 0.92,
          findingCount: 1,
          investigatorDiversity: 1,
          recency: 0.9,
          riskTierWeighting: 0.8,
          total: 0.84,
        },
        scoreHistory: [],
        mergeSuggestions: [],
        splitSuggestions: [],
        timelineNodes: [],
        evidenceRefs: [],
        linkedEntities: sampleDetail().entityLinks,
        narrativeVersions: [],
        analystAnnotations: [],
      },
      console: {
        generatedAt: '2026-03-15T12:00:00.000Z',
        storylineId: 'stl_123',
        headline: 'Trust risk rising for provider 1558302470',
        summary: 'Trust pressure is building around provider 1558302470.',
        severityScore: 0.84,
        lifecycleStage: 'developing',
        timelineNodes: [],
        linkedProviders: ['1558302470'],
        narrativeText: 'Trust pressure is building around provider 1558302470.',
        lastUpdated: '2026-03-15T12:00:00.000Z',
        mergeSuggestions: [],
        splitSuggestions: [],
        score: {
          maxFindingConfidence: 0.92,
          findingCount: 1,
          investigatorDiversity: 1,
          recency: 0.9,
          riskTierWeighting: 0.8,
          total: 0.84,
        },
      },
      findingsInbox: {
        generatedAt: '2026-03-15T12:00:00.000Z',
        total: 0,
        rows: [],
      },
      feed: [],
      network: {
        generatedAt: '2026-03-15T12:00:00.000Z',
        focusNodeId: null,
        nodes: [],
        edges: [],
        highlights: {
          nodeIds: [],
          edgeIds: [],
        },
        paths: {
          shortestPath: null,
          rankedPaths: [],
        },
        semanticZoom: {
          overviewClusters: [],
          detailNodeCount: 0,
          detailEdgeCount: 0,
        },
      },
    } as Awaited<ReturnType<typeof buildStorylineInvestigationPayload>>);

    const response = await request(app)
      .get('/api/storylines/stl_123/investigation')
      .expect(200);

    expect(response.body.schema).toBe('https://vitalcv.com/storylines/investigation/v1');
    expect(response.body.storylineId).toBe('stl_123');
    expect(response.body.console.lifecycleStage).toBe('developing');
  });
});
