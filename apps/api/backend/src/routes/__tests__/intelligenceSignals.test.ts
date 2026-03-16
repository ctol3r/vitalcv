import express from 'express';
import request from 'supertest';

jest.mock('../../services/intelligence/intelligenceSignalsService', () => ({
  buildIntelligenceFeed: jest.fn(),
  getGeographyPressureIndex: jest.fn(),
  getInstitutionMomentumIndex: jest.fn(),
  getProviderInfluenceScore: jest.fn(),
  getProviderIntelligenceSummary: jest.fn(),
  getProviderTrustScore: jest.fn(),
  getSpecialtyPressureIndex: jest.fn(),
  listGeographyPressureIndexes: jest.fn(),
  listInstitutionMomentumIndexes: jest.fn(),
  listProviderInfluenceScores: jest.fn(),
  listSpecialtyPressureIndexes: jest.fn(),
}));

import {
  buildIntelligenceFeed,
  getProviderInfluenceScore,
  getProviderIntelligenceSummary,
  getProviderTrustScore,
  listSpecialtyPressureIndexes,
} from '../../services/intelligence/intelligenceSignalsService';
import { registerIntelligenceSignalRoutes } from '../intelligenceSignals';

const getProviderTrustScoreMock = getProviderTrustScore as jest.MockedFunction<typeof getProviderTrustScore>;
const getProviderInfluenceScoreMock = getProviderInfluenceScore as jest.MockedFunction<typeof getProviderInfluenceScore>;
const listSpecialtyPressureIndexesMock = listSpecialtyPressureIndexes as jest.MockedFunction<typeof listSpecialtyPressureIndexes>;
const getProviderIntelligenceSummaryMock = getProviderIntelligenceSummary as jest.MockedFunction<typeof getProviderIntelligenceSummary>;
const buildIntelligenceFeedMock = buildIntelligenceFeed as jest.MockedFunction<typeof buildIntelligenceFeed>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntelligenceSignalRoutes(app);
  return app;
}

describe('intelligence signal routes', () => {
  beforeEach(() => {
    getProviderTrustScoreMock.mockReset();
    getProviderInfluenceScoreMock.mockReset();
    listSpecialtyPressureIndexesMock.mockReset();
    getProviderIntelligenceSummaryMock.mockReset();
    buildIntelligenceFeedMock.mockReset();
  });

  it('returns provider trust and influence signals', async () => {
    const app = buildApp();

    getProviderTrustScoreMock.mockResolvedValue({
      providerId: 'provider:1234567890',
      providerNpi: '1234567890',
      providerLabel: 'Dr. Ada Lovelace',
      score: 82,
      tier: 'Strong trust',
      confidence: 0.84,
      drivers: [],
      sourceSignals: ['NPPES_API', 'OIG_LEIE'],
      timestamp: '2026-03-16T08:00:00.000Z',
      last_updated: '2026-03-16T08:00:00.000Z',
      explanation: 'Strong trust based on verified exclusion and licensure coverage.',
      insufficientSignal: false,
    });

    getProviderInfluenceScoreMock.mockResolvedValue({
      providerId: 'provider:1234567890',
      providerNpi: '1234567890',
      providerLabel: 'Dr. Ada Lovelace',
      score: 91,
      percentile: 0.97,
      tier: 'High Influence',
      confidence: 0.79,
      drivers: [],
      sourceSignals: ['GRAPH_RUNTIME'],
      centrality_delta: 1.6,
      timestamp: '2026-03-16T08:00:00.000Z',
      last_updated: '2026-03-16T08:00:00.000Z',
      explanation: 'High influence driven by PageRank and bridge centrality.',
      insufficientSignal: false,
    });

    const trustResponse = await request(app)
      .get('/api/trust/providers/1234567890')
      .query({ sync: 'false' })
      .expect(200);

    expect(getProviderTrustScoreMock).toHaveBeenCalledWith('1234567890', { sync: false });
    expect(trustResponse.body.trust).toEqual(expect.objectContaining({
      score: 82,
      tier: 'Strong trust',
    }));

    const influenceResponse = await request(app)
      .get('/api/influence/providers/1234567890')
      .query({ sync: 'false' })
      .expect(200);

    expect(getProviderInfluenceScoreMock).toHaveBeenCalledWith('1234567890', { sync: false });
    expect(influenceResponse.body.influence).toEqual(expect.objectContaining({
      score: 91,
      tier: 'High Influence',
      percentile: 0.97,
    }));
  });

  it('returns provider summary, normalized provider feed, and pressure indexes', async () => {
    const app = buildApp();

    getProviderIntelligenceSummaryMock.mockResolvedValue({
      npi: '1234567890',
      providerId: 'provider:1234567890',
      providerLabel: 'Dr. Ada Lovelace',
      specialty: 'Cardiology',
      geography: 'CA',
      trust: {
        providerId: 'provider:1234567890',
        providerNpi: '1234567890',
        providerLabel: 'Dr. Ada Lovelace',
        score: 82,
        tier: 'Strong trust',
        confidence: 0.84,
        drivers: [],
        sourceSignals: ['NPPES_API'],
        timestamp: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
        explanation: 'Strong trust.',
        insufficientSignal: false,
      },
      influence: {
        providerId: 'provider:1234567890',
        providerNpi: '1234567890',
        providerLabel: 'Dr. Ada Lovelace',
        score: 91,
        percentile: 0.97,
        tier: 'High Influence',
        confidence: 0.79,
        drivers: [],
        sourceSignals: ['GRAPH_RUNTIME'],
        centrality_delta: 1.6,
        timestamp: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
        explanation: 'High influence.',
        insufficientSignal: false,
      },
      workforcePressure: {
        id: 'cardiology',
        state: 'high',
        score: 72,
        confidence: 0.74,
        drivers: [],
        sourceSignals: ['WORKFORCE_SCARCITY'],
        timestamp: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
        explanation: 'High pressure.',
        specialty: 'Cardiology',
        geography: 'CA',
        hotspots: [],
        insufficientSignal: false,
      },
      institutionMomentum: null,
      earlyWarnings: [],
      findings: [],
      storylines: [],
      predictions: [],
      actions: [],
      feed: {
        generatedAt: '2026-03-16T08:00:00.000Z',
        total: 1,
        counts: {
          finding: 0,
          storyline: 0,
          prediction: 0,
          insight: 1,
          early_warning: 0,
        },
        items: [{
          id: 'insight:trust:1234567890',
          headline: 'Dr. Ada Lovelace trust score',
          entity: {
            entityType: 'provider',
            entityId: '1234567890',
            entityLabel: 'Dr. Ada Lovelace',
          },
          type: 'insight',
          explanation: 'Strong trust.',
          confidence: 0.84,
          linkedEvidence: [],
          recommendedAction: null,
          created_at: '2026-03-16T08:00:00.000Z',
          state: 'Strong trust',
          score: 82,
        }],
      },
      summary: 'Trust is strong, influence is high, and pressure is high.',
      generatedAt: '2026-03-16T08:00:00.000Z',
    });

    buildIntelligenceFeedMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      total: 1,
      counts: {
        finding: 0,
        storyline: 0,
        prediction: 0,
        insight: 1,
        early_warning: 0,
      },
      items: [{
        id: 'insight:trust:1234567890',
        headline: 'Dr. Ada Lovelace trust score',
        entity: {
          entityType: 'provider',
          entityId: '1234567890',
          entityLabel: 'Dr. Ada Lovelace',
        },
        type: 'insight',
        explanation: 'Strong trust.',
        confidence: 0.84,
        linkedEvidence: [],
        recommendedAction: null,
        created_at: '2026-03-16T08:00:00.000Z',
        state: 'Strong trust',
        score: 82,
      }],
    });

    listSpecialtyPressureIndexesMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      specialties: [{
        id: 'cardiology',
        state: 'severe',
        score: 88,
        confidence: 0.81,
        drivers: [],
        sourceSignals: ['HRSA', 'NRMP'],
        timestamp: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
        explanation: 'Severe pressure.',
        specialty: 'Cardiology',
        geography: 'TX',
        hotspots: [],
        insufficientSignal: false,
      }],
    });

    const summaryResponse = await request(app)
      .get('/api/provider-intelligence/1234567890')
      .query({ sync: 'false', limit: '12' })
      .expect(200);

    expect(getProviderIntelligenceSummaryMock).toHaveBeenCalledWith('1234567890', {
      sync: false,
      limit: 12,
    });
    expect(summaryResponse.body).toEqual(expect.objectContaining({
      npi: '1234567890',
      summary: 'Trust is strong, influence is high, and pressure is high.',
    }));

    const feedResponse = await request(app)
      .get('/api/provider-intelligence/1234567890/feed')
      .query({ sync: 'false', limit: '15' })
      .expect(200);

    expect(buildIntelligenceFeedMock).toHaveBeenCalledWith({
      providerNpi: '1234567890',
      sync: false,
      limit: 15,
    });
    expect(feedResponse.body.items[0]).toEqual(expect.objectContaining({
      type: 'insight',
      headline: 'Dr. Ada Lovelace trust score',
    }));

    const pressureResponse = await request(app)
      .get('/api/pressure/specialties')
      .query({ sync: 'false', limit: '10' })
      .expect(200);

    expect(listSpecialtyPressureIndexesMock).toHaveBeenCalledWith({
      sync: false,
      limit: 10,
    });
    expect(pressureResponse.body.specialties[0]).toEqual(expect.objectContaining({
      id: 'cardiology',
      state: 'severe',
    }));
  });
});
