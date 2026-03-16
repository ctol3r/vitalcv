import express from 'express';
import request from 'supertest';

jest.mock('../../services/strategy/strategyEngineService', () => ({
  listStrategyInsights: jest.fn(),
  listProviderStrategyInsights: jest.fn(),
  listInstitutionStrategyInsights: jest.fn(),
  listSpecialtyStrategyInsights: jest.fn(),
  listNetworkStrategyInsights: jest.fn(),
}));

import {
  listInstitutionStrategyInsights,
  listNetworkStrategyInsights,
  listProviderStrategyInsights,
  listSpecialtyStrategyInsights,
  listStrategyInsights,
} from '../../services/strategy/strategyEngineService';
import { strategyListResponseSchema } from '../../services/strategy/contracts';
import { registerStrategyRoutes } from '../strategy';

const listStrategyInsightsMock = listStrategyInsights as jest.MockedFunction<typeof listStrategyInsights>;
const listProviderStrategyInsightsMock = listProviderStrategyInsights as jest.MockedFunction<typeof listProviderStrategyInsights>;
const listInstitutionStrategyInsightsMock = listInstitutionStrategyInsights as jest.MockedFunction<typeof listInstitutionStrategyInsights>;
const listSpecialtyStrategyInsightsMock = listSpecialtyStrategyInsights as jest.MockedFunction<typeof listSpecialtyStrategyInsights>;
const listNetworkStrategyInsightsMock = listNetworkStrategyInsights as jest.MockedFunction<typeof listNetworkStrategyInsights>;

function sampleList() {
  return {
    insights: [
      {
        id: 'str_provider_1',
        type: 'PROVIDER_OPPORTUNITY' as const,
        category: 'strategic_opportunity' as const,
        scope: {
          entityType: 'provider' as const,
          entityId: '1558302470',
          entityLabel: 'Dr. Ada Hart',
          geography: 'TX',
          specialty: 'Cardiology',
        },
        title: 'Dr. Ada Hart is emerging in a high-pressure Cardiology market',
        summary: 'Cardiology demand in TX is outpacing mapped supply while the provider trajectory is rising.',
        impactLevel: 'strategic' as const,
        confidence: 0.87,
        explanation: 'The insight combines severe specialty pressure with a rising provider trajectory.',
        drivers: [
          {
            label: 'specialty_pressure',
            value: 88,
            direction: 'UP' as const,
            source: 'PREDICTION_ENGINE',
            explanation: 'Cardiology pressure score reached 88 in TX.',
          },
        ],
        affectedEntities: [
          {
            entityType: 'provider',
            entityId: '1558302470',
            entityLabel: 'Dr. Ada Hart',
            relationship: 'subject',
          },
        ],
        recommendedActions: ['Prioritize recruiter outreach to Dr. Ada Hart.'],
        supportingPredictions: [
          {
            predictionId: 'pred_1',
            predictionType: 'EMERGING_INVESTIGATOR',
            probability: 0.81,
            confidence: 0.78,
            explanation: 'Rising research visibility.',
            createdAt: '2026-03-15T12:00:00.000Z',
            updatedAt: '2026-03-15T12:00:00.000Z',
            metadata: {},
          },
        ],
        supportingStorylineIds: ['stl_1'],
        supportingActionIds: ['act_1'],
        createdAt: '2026-03-15T12:00:00.000Z',
        updatedAt: '2026-03-15T12:00:00.000Z',
      },
    ],
    total: 1,
    generatedAt: '2026-03-15T12:00:00.000Z',
    summary: {
      byType: { PROVIDER_OPPORTUNITY: 1 },
      byImpactLevel: { strategic: 1 },
      byCategory: { strategic_opportunity: 1 },
    },
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  registerStrategyRoutes(app);
  return app;
}

describe('strategy routes', () => {
  beforeEach(() => {
    listStrategyInsightsMock.mockReset();
    listProviderStrategyInsightsMock.mockReset();
    listInstitutionStrategyInsightsMock.mockReset();
    listSpecialtyStrategyInsightsMock.mockReset();
    listNetworkStrategyInsightsMock.mockReset();
  });

  it('returns the strategy list contract and forwards filters', async () => {
    const app = buildApp();
    listStrategyInsightsMock.mockResolvedValue(sampleList());

    const response = await request(app)
      .get('/api/strategy')
      .query({
        type: 'PROVIDER_OPPORTUNITY',
        impactLevel: 'strategic',
        confidence: '0.8',
        entityType: 'provider',
        limit: '10',
        sync: 'true',
      })
      .expect(200);

    expect(listStrategyInsightsMock).toHaveBeenCalledWith(expect.objectContaining({
      type: 'PROVIDER_OPPORTUNITY',
      impactLevel: 'strategic',
      confidence: 0.8,
      entityType: 'provider',
      limit: 10,
      sync: true,
    }));
    expect(() => strategyListResponseSchema.parse(response.body)).not.toThrow();
  });

  it('returns provider-scoped strategy insights', async () => {
    const app = buildApp();
    listProviderStrategyInsightsMock.mockResolvedValue(sampleList());

    await request(app)
      .get('/api/strategy/providers/1558302470')
      .expect(200);

    expect(listProviderStrategyInsightsMock).toHaveBeenCalledWith(
      '1558302470',
      expect.objectContaining({}),
    );
  });
});
