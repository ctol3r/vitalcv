import express from 'express';
import request from 'supertest';

jest.mock('../../services/intelligence/intelligenceFeedService', () => ({
  listIntelligenceFeed: jest.fn(),
}));

jest.mock('../../services/intelligence/intelligenceAggregateService', () => ({
  buildProviderIntelligenceAggregate: jest.fn(),
  buildInstitutionIntelligenceAggregate: jest.fn(),
  buildSpecialtyIntelligenceAggregate: jest.fn(),
  buildNetworkIntelligenceAggregate: jest.fn(),
}));

import { registerIntelligenceAggregateRoutes } from '../intelligenceAggregates';
import { listIntelligenceFeed } from '../../services/intelligence/intelligenceFeedService';
import {
  buildInstitutionIntelligenceAggregate,
  buildNetworkIntelligenceAggregate,
  buildProviderIntelligenceAggregate,
  buildSpecialtyIntelligenceAggregate,
} from '../../services/intelligence/intelligenceAggregateService';

const listIntelligenceFeedMock = listIntelligenceFeed as jest.MockedFunction<typeof listIntelligenceFeed>;
const buildProviderAggregateMock = buildProviderIntelligenceAggregate as jest.MockedFunction<typeof buildProviderIntelligenceAggregate>;
const buildInstitutionAggregateMock = buildInstitutionIntelligenceAggregate as jest.MockedFunction<typeof buildInstitutionIntelligenceAggregate>;
const buildSpecialtyAggregateMock = buildSpecialtyIntelligenceAggregate as jest.MockedFunction<typeof buildSpecialtyIntelligenceAggregate>;
const buildNetworkAggregateMock = buildNetworkIntelligenceAggregate as jest.MockedFunction<typeof buildNetworkIntelligenceAggregate>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntelligenceAggregateRoutes(app);
  return app;
}

describe('intelligence aggregate routes', () => {
  beforeEach(() => {
    listIntelligenceFeedMock.mockReset();
    buildProviderAggregateMock.mockReset();
    buildInstitutionAggregateMock.mockReset();
    buildSpecialtyAggregateMock.mockReset();
    buildNetworkAggregateMock.mockReset();
  });

  it('returns the normalized intelligence feed', async () => {
    listIntelligenceFeedMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      items: [{
        id: 'feed-1',
        type: 'insight',
        headline: 'Ada Lovelace influence score',
        summary: 'Influence score is elevated.',
        entityRefs: [{
          entityType: 'provider',
          entityId: '1234567890',
          entityLabel: 'Ada Lovelace',
        }],
        confidence: {
          score: 0.84,
          level: 'high',
          label: '84% confidence',
          insufficientSignal: false,
          reasoning: ['GRAPH_RUNTIME'],
        },
        priority: 'high',
        impact: 'high',
        linkedEvidenceRefs: [],
        recommendedActionRefs: [],
        createdAt: '2026-03-16T08:00:00.000Z',
        updatedAt: '2026-03-16T08:00:00.000Z',
        signal: null,
        metadata: {},
      }],
    });

    const response = await request(buildApp())
      .get('/api/intelligence/feed')
      .query({ entityType: 'provider', entityId: '1234567890', includeTypes: 'insight' })
      .expect(200);

    expect(listIntelligenceFeedMock).toHaveBeenCalledWith({
      entityType: 'provider',
      entityId: '1234567890',
      includeTypes: ['insight'],
      limit: 40,
    });
    expect(response.body.total).toBe(1);
    expect(response.body.items[0].headline).toContain('influence score');
  });

  it('returns provider and entity aggregate payloads', async () => {
    buildProviderAggregateMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      entity: { entityType: 'provider', entityId: '1234567890', entityLabel: 'Ada Lovelace' },
      trustScore: null,
      influenceScore: null,
      trajectorySignals: [],
      recentWarnings: [],
      recentFeed: [],
      recentFindings: [],
      recentStorylines: [],
      recommendedWatchItems: ['Watch trust score drift'],
    });
    buildInstitutionAggregateMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      entity: { entityType: 'institution', entityId: 'mayo-clinic', entityLabel: 'Mayo Clinic' },
      momentumSignals: [],
      recentWarnings: [],
      recentFeed: [],
      recommendedWatchItems: ['Monitor institution momentum'],
    });
    buildSpecialtyAggregateMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      entity: { entityType: 'specialty', entityId: 'cardiology', entityLabel: 'Cardiology' },
      pressureSignals: [],
      recentWarnings: [],
      recentFeed: [],
      recommendedWatchItems: ['Review severe pressure specialties'],
    });
    buildNetworkAggregateMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      entity: { entityType: 'network', entityId: '1234567890', entityLabel: 'Ada Lovelace network' },
      networkSignals: [],
      recentWarnings: [],
      recentFeed: [],
      recommendedWatchItems: ['Inspect recent network changes'],
    });

    const app = buildApp();

    const provider = await request(app)
      .get('/api/intelligence/aggregates/providers/1234567890')
      .expect(200);
    expect(provider.body.aggregate.entity.entityId).toBe('1234567890');

    const institution = await request(app)
      .get('/api/intelligence/aggregates/institutions/mayo-clinic')
      .expect(200);
    expect(institution.body.aggregate.entity.entityType).toBe('institution');

    const specialty = await request(app)
      .get('/api/intelligence/aggregates/specialties/cardiology')
      .expect(200);
    expect(specialty.body.aggregate.entity.entityType).toBe('specialty');

    const network = await request(app)
      .get('/api/intelligence/aggregates/network/1234567890')
      .expect(200);
    expect(network.body.aggregate.entity.entityType).toBe('network');
  });
});
