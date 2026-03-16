import express from 'express';
import request from 'supertest';

jest.mock('../../services/intelligence/providerIntelligenceService', () => ({
  listProviderInsights: jest.fn(),
  listSpecialtyInsights: jest.fn(),
  listInstitutionInsights: jest.fn(),
}));

import {
  listInstitutionInsights,
  listProviderInsights,
  listSpecialtyInsights,
} from '../../services/intelligence/providerIntelligenceService';
import { registerIntelligenceInsightRoutes } from '../insights';

const listProviderInsightsMock = listProviderInsights as jest.MockedFunction<typeof listProviderInsights>;
const listSpecialtyInsightsMock = listSpecialtyInsights as jest.MockedFunction<typeof listSpecialtyInsights>;
const listInstitutionInsightsMock = listInstitutionInsights as jest.MockedFunction<typeof listInstitutionInsights>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerIntelligenceInsightRoutes(app);
  return app;
}

describe('intelligence insight routes', () => {
  beforeEach(() => {
    listProviderInsightsMock.mockReset();
    listSpecialtyInsightsMock.mockReset();
    listInstitutionInsightsMock.mockReset();
  });

  it('returns provider insights', async () => {
    const app = buildApp();
    listProviderInsightsMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      connectors: [],
      insights: [{
        type: 'provider',
        entity: {
          entityType: 'provider',
          entityId: '1234567890',
          entityLabel: 'Dr. Ada Lovelace',
        },
        score: 0.91,
        scoreLabel: 'rising',
        confidence: 0.86,
        explanation: 'Provider trajectory is rising.',
        drivers: [],
        networkHubScore: 0.62,
        relatedStorylineIds: ['stl_1'],
        relatedActionIds: ['act_1'],
        lastUpdated: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
      }],
    });

    const response = await request(app)
      .get('/api/insights/providers')
      .query({ limit: '10', sync: 'false' })
      .expect(200);

    expect(listProviderInsightsMock).toHaveBeenCalledWith({
      sync: false,
      limit: 10,
    });
    expect(response.body.insights[0]).toEqual(expect.objectContaining({
      type: 'provider',
      scoreLabel: 'rising',
      networkHubScore: 0.62,
    }));
  });

  it('returns specialty and institution insights', async () => {
    const app = buildApp();
    listSpecialtyInsightsMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      connectors: [],
      insights: [{
        type: 'specialty',
        entity: {
          entityType: 'specialty',
          entityId: 'cardiology',
          entityLabel: 'Cardiology',
        },
        score: 0.88,
        scoreLabel: 'severe',
        confidence: 0.83,
        explanation: 'Specialty pressure is severe.',
        drivers: [],
        lastUpdated: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
      }],
    });
    listInstitutionInsightsMock.mockResolvedValue({
      generatedAt: '2026-03-16T08:00:00.000Z',
      connectors: [],
      insights: [{
        type: 'institution',
        entity: {
          entityType: 'institution',
          entityId: 'mayo-clinic',
          entityLabel: 'Mayo Clinic',
        },
        score: 0.82,
        scoreLabel: 'expanding',
        confidence: 0.79,
        explanation: 'Institution momentum is expanding.',
        drivers: [],
        lastUpdated: '2026-03-16T08:00:00.000Z',
        last_updated: '2026-03-16T08:00:00.000Z',
      }],
    });

    const specialty = await request(app)
      .get('/api/insights/specialties')
      .query({ severity: 'severe' })
      .expect(200);
    expect(listSpecialtyInsightsMock).toHaveBeenCalledWith({
      sync: true,
      limit: 25,
      severity: 'severe',
    });
    expect(specialty.body.insights[0].scoreLabel).toBe('severe');

    const institution = await request(app)
      .get('/api/insights/institutions')
      .query({ state: 'expanding' })
      .expect(200);
    expect(listInstitutionInsightsMock).toHaveBeenCalledWith({
      sync: true,
      limit: 25,
      state: 'expanding',
    });
    expect(institution.body.insights[0].scoreLabel).toBe('expanding');
  });
});
