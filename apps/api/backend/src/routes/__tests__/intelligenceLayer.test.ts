import express from 'express';
import request from 'supertest';

jest.mock('../../services/predictions/predictionEngineService', () => ({
  refreshPredictionInsights: jest.fn(),
}));

jest.mock('../../services/intelligenceLayer/intelligenceLayerService', () => ({
  buildPredictionSurfaceForEntity: jest.fn(),
  createIntelligenceWatch: jest.fn(),
  deleteIntelligenceWatch: jest.fn(),
  detectProviderTrajectories: jest.fn(),
  getIntelligenceWatch: jest.fn(),
  getProviderCoverageScore: jest.fn(),
  listIntelligenceFeed: jest.fn(),
  listIntelligenceWatches: jest.fn(),
  listNetworkChanges: jest.fn(),
  listSignalCorrelations: jest.fn(),
  listSignalHistory: jest.fn(),
}));

import { refreshPredictionInsights } from '../../services/predictions/predictionEngineService';
import {
  buildPredictionSurfaceForEntity,
  createIntelligenceWatch,
  deleteIntelligenceWatch,
  detectProviderTrajectories,
  getIntelligenceWatch,
  getProviderCoverageScore,
  listIntelligenceFeed,
  listIntelligenceWatches,
  listNetworkChanges,
  listSignalCorrelations,
  listSignalHistory,
} from '../../services/intelligenceLayer/intelligenceLayerService';
import { registerIntelligenceLayerRoutes } from '../intelligenceLayer';

const refreshPredictionInsightsMock = refreshPredictionInsights as jest.MockedFunction<typeof refreshPredictionInsights>;
const listIntelligenceFeedMock = listIntelligenceFeed as jest.MockedFunction<typeof listIntelligenceFeed>;
const listSignalHistoryMock = listSignalHistory as jest.MockedFunction<typeof listSignalHistory>;
const detectProviderTrajectoriesMock = detectProviderTrajectories as jest.MockedFunction<typeof detectProviderTrajectories>;
const listNetworkChangesMock = listNetworkChanges as jest.MockedFunction<typeof listNetworkChanges>;
const getProviderCoverageScoreMock = getProviderCoverageScore as jest.MockedFunction<typeof getProviderCoverageScore>;
const listSignalCorrelationsMock = listSignalCorrelations as jest.MockedFunction<typeof listSignalCorrelations>;
const listIntelligenceWatchesMock = listIntelligenceWatches as jest.MockedFunction<typeof listIntelligenceWatches>;
const createIntelligenceWatchMock = createIntelligenceWatch as jest.MockedFunction<typeof createIntelligenceWatch>;
const getIntelligenceWatchMock = getIntelligenceWatch as jest.MockedFunction<typeof getIntelligenceWatch>;
const deleteIntelligenceWatchMock = deleteIntelligenceWatch as jest.MockedFunction<typeof deleteIntelligenceWatch>;
const buildPredictionSurfaceForEntityMock = buildPredictionSurfaceForEntity as jest.MockedFunction<typeof buildPredictionSurfaceForEntity>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntelligenceLayerRoutes(app);
  return app;
}

describe('intelligence layer routes', () => {
  beforeEach(() => {
    refreshPredictionInsightsMock.mockReset();
    listIntelligenceFeedMock.mockReset();
    listSignalHistoryMock.mockReset();
    detectProviderTrajectoriesMock.mockReset();
    listNetworkChangesMock.mockReset();
    getProviderCoverageScoreMock.mockReset();
    listSignalCorrelationsMock.mockReset();
    listIntelligenceWatchesMock.mockReset();
    createIntelligenceWatchMock.mockReset();
    getIntelligenceWatchMock.mockReset();
    deleteIntelligenceWatchMock.mockReset();
    buildPredictionSurfaceForEntityMock.mockReset();
  });

  it('serves feed, signal history, trajectories, coverage, and correlations', async () => {
    const app = buildApp();
    listIntelligenceFeedMock.mockResolvedValue([{
      id: 'feed-1',
      itemType: 'prediction',
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: 'Dr. Ada Lovelace',
      title: 'Provider trajectory rising',
      summary: 'Trajectory is rising.',
      confidence: 0.82,
      severity: 'info',
      timestamp: '2026-03-16T08:00:00.000Z',
      sources: ['OPENALEX'],
      metadata: {},
    }]);
    listSignalHistoryMock.mockResolvedValue([{
      entityType: 'provider',
      entityId: '1234567890',
      signalType: 'influence_score',
      value: 82,
      confidence: 0.8,
      drivers: [],
      timestamp: '2026-03-16T08:00:00.000Z',
    }]);
    detectProviderTrajectoriesMock.mockResolvedValue([{
      trajectoryType: 'influence_rising',
      confidence: 0.78,
      explanation: 'Influence is rising.',
      supportingSignals: [],
    }]);
    listNetworkChangesMock.mockResolvedValue([{
      id: 'net-1',
      changeType: 'new_collaborator',
      entityType: 'provider',
      entityId: '1234567890',
      entityLabel: null,
      counterpartType: 'provider',
      counterpartId: '2234567890',
      counterpartLabel: 'Dr. Grace Hopper',
      confidence: 0.74,
      explanation: 'New collaborator detected.',
      supportingSignals: [],
      observedAt: '2026-03-16T08:00:00.000Z',
    }]);
    getProviderCoverageScoreMock.mockResolvedValue({
      coverageScore: 86,
      sourceCount: 6,
      missingSources: ['sanctions feeds'],
      confidence: 0.84,
      coveredSources: ['NPPES', 'OpenAlex'],
      updatedAt: '2026-03-16T08:00:00.000Z',
    });
    listSignalCorrelationsMock.mockResolvedValue([{
      id: 'cor-1',
      correlationType: 'research_program_expansion',
      entities: [{ entityType: 'provider', entityId: '1234567890' }],
      signals: [],
      explanation: 'Research program expansion detected.',
      confidence: 0.81,
      observedAt: '2026-03-16T08:00:00.000Z',
    }]);

    const feed = await request(app)
      .get('/api/intelligence/feed')
      .query({ sync: 'false' })
      .expect(200);
    expect(feed.body.items[0].itemType).toBe('prediction');

    const history = await request(app)
      .get('/api/intelligence/signals/provider/1234567890/history')
      .query({ sync: 'false', signalType: 'influence_score' })
      .expect(200);
    expect(history.body.history[0].signalType).toBe('influence_score');

    const trajectories = await request(app)
      .get('/api/intelligence/trajectories/providers/1234567890')
      .query({ sync: 'false' })
      .expect(200);
    expect(trajectories.body.trajectories[0].trajectoryType).toBe('influence_rising');

    const coverage = await request(app)
      .get('/api/intelligence/coverage/providers/1234567890')
      .query({ sync: 'false' })
      .expect(200);
    expect(coverage.body.coverage.coverageScore).toBe(86);

    const correlations = await request(app)
      .get('/api/intelligence/correlations')
      .query({ sync: 'false', entityType: 'provider', entityId: '1234567890' })
      .expect(200);
    expect(correlations.body.correlations[0].correlationType).toBe('research_program_expansion');
  });

  it('creates, lists, loads, and deletes watch targets', async () => {
    const app = buildApp();
    listIntelligenceWatchesMock.mockResolvedValue([{
      id: 'watch-1',
      name: 'Watch Ada',
      active: true,
      ownerOrganizationId: null,
      targetType: 'provider',
      targetValue: '1234567890',
      subscribedSignals: ['trust_score'],
      createdAt: '2026-03-16T08:00:00.000Z',
      updatedAt: '2026-03-16T08:00:00.000Z',
    }]);
    createIntelligenceWatchMock.mockResolvedValue({
      id: 'watch-1',
      name: 'Watch Ada',
      active: true,
      ownerOrganizationId: null,
      targetType: 'provider',
      targetValue: '1234567890',
      subscribedSignals: ['trust_score'],
      createdAt: '2026-03-16T08:00:00.000Z',
      updatedAt: '2026-03-16T08:00:00.000Z',
    });
    getIntelligenceWatchMock.mockResolvedValue({
      id: 'watch-1',
      name: 'Watch Ada',
      active: true,
      ownerOrganizationId: null,
      targetType: 'provider',
      targetValue: '1234567890',
      subscribedSignals: ['trust_score'],
      createdAt: '2026-03-16T08:00:00.000Z',
      updatedAt: '2026-03-16T08:00:00.000Z',
      alerts: [],
      earlyWarnings: [],
    });
    deleteIntelligenceWatchMock.mockResolvedValue(true);
    buildPredictionSurfaceForEntityMock.mockResolvedValue({
      predictions: [],
      trajectories: [],
      networkChanges: [],
      correlations: [],
      signalHistory: [],
      coverage: null,
    });

    const list = await request(app)
      .get('/api/watch')
      .expect(200);
    expect(list.body.total).toBe(1);

    const created = await request(app)
      .post('/api/watch')
      .send({ targetType: 'provider', targetValue: '1234567890' })
      .expect(201);
    expect(created.body.watch.targetValue).toBe('1234567890');

    const detail = await request(app)
      .get('/api/watch/watch-1')
      .query({ sync: 'false' })
      .expect(200);
    expect(detail.body.watch.id).toBe('watch-1');

    await request(app)
      .delete('/api/watch/watch-1')
      .expect(204);
  });
});
