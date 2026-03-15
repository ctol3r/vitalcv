import express from 'express';
import request from 'supertest';

jest.mock('../../services/search/requestContext', () => ({
  resolveSearchRequestContext: jest.fn(),
}));

jest.mock('../../services/copilot/copilotQueryService', () => ({
  executeCopilotQuery: jest.fn(),
}));

jest.mock('../../llm', () => ({
  invokeAgentModel: jest.fn(),
}));

import { invokeAgentModel } from '../../llm';
import {
  copilotQueryResponseSchema,
} from '../../services/copilot/contracts';
import { executeCopilotQuery } from '../../services/copilot/copilotQueryService';
import { resolveSearchRequestContext } from '../../services/search/requestContext';
import { registerCopilotRoutes } from '../copilot';

const resolveSearchRequestContextMock =
  resolveSearchRequestContext as jest.MockedFunction<typeof resolveSearchRequestContext>;
const executeCopilotQueryMock =
  executeCopilotQuery as jest.MockedFunction<typeof executeCopilotQuery>;
const invokeAgentModelMock =
  invokeAgentModel as jest.MockedFunction<typeof invokeAgentModel>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerCopilotRoutes(app);
  app.use((err: { status?: number; statusCode?: number; message?: string }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(err.status ?? err.statusCode ?? 500).json({ message: err.message ?? 'error' });
  });
  return app;
}

describe('copilot routes', () => {
  beforeEach(() => {
    resolveSearchRequestContextMock.mockReset();
    executeCopilotQueryMock.mockReset();
    invokeAgentModelMock.mockReset();

    resolveSearchRequestContextMock.mockResolvedValue({
      aclLevel: 'PUBLIC',
      isAuthenticated: false,
      membershipRoles: ['PUBLIC'],
      queryHash: 'hashed-query',
    });

    invokeAgentModelMock.mockImplementation(async (_options, invoke) => {
      const result = await invoke();
      return result.output;
    });
  });

  it('rejects invalid requests', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/copilot/query')
      .send({ query: 'hi' })
      .expect(400);

    expect(response.body.message ?? response.body.error).toBeTruthy();
    expect(executeCopilotQueryMock).not.toHaveBeenCalled();
  });

  it('returns the new copilot query contract', async () => {
    const app = buildApp();

    executeCopilotQueryMock.mockResolvedValue({
      parsedQuery: {
        rawQuery: 'cardiologists in texas with high trust score',
        normalizedQuery: 'cardiologists in texas with high trust score',
        intent: 'DUE_DILIGENCE',
        keywords: ['cardiologists', 'texas'],
        structuredFilters: {
          specialties: ['Cardiology'],
          states: ['TX'],
          institutions: [],
          licenseStatuses: [],
          trustScore: { min: 80 },
          boardCertified: undefined,
          researchTopics: [],
          payments: undefined,
          affiliations: [],
        },
        semanticTopics: ['Cardiology', 'TX', 'cardiologists', 'texas'],
        graphTraversal: [],
        rankingWeights: {
          relevance: 0.35,
          trustScore: 0.35,
          freshness: 0.15,
          sourceCoverage: 0.15,
        },
      },
      results: [
        {
          id: 'clinician:1234567890',
          rank: 1,
          type: 'CLINICIAN',
          title: 'Dr. High Trust',
          subtitle: 'Cardiology',
          summary: 'Cardiology clinician in TX.',
          specialty: 'Cardiology',
          state: 'TX',
          institution: 'Mayo Clinic',
          licenseStatus: 'ACTIVE',
          boardCertified: true,
          trustScore: 91,
          trustBand: 'L3',
          scores: {
            relevance: 0.91,
            trustScore: 0.91,
            freshness: 0.8,
            sourceCoverage: 0.75,
            total: 0.87,
          },
          sourceCoverage: ['NPPES', 'PECOS', 'OIG'],
        },
      ],
      explanations: [
        {
          resultId: 'clinician:1234567890',
          title: 'Dr. High Trust',
          summary: 'Dr. High Trust appears because specialty = Cardiology; state = TX; trust score = 91.',
          because: ['specialty = Cardiology', 'state = TX', 'trust score = 91'],
          matchedFilters: [
            {
              field: 'specialty',
              value: 'Cardiology',
              reason: 'specialty matched Cardiology',
            },
          ],
          verifiedSources: ['NPPES', 'PECOS', 'OIG'],
          scoring: {
            relevance: 0.91,
            trustScore: 0.91,
            freshness: 0.8,
            sourceCoverage: 0.75,
            total: 0.87,
          },
        },
      ],
      graphInsights: [
        {
          resultId: 'clinician:1234567890',
          type: 'SOURCE_COVERAGE',
          summary: 'Dr. High Trust is supported by NPPES, PECOS, OIG.',
          path: ['Dr. High Trust', 'NPPES', 'PECOS'],
          depth: 1,
        },
      ],
    });

    const response = await request(app)
      .post('/api/copilot/query')
      .send({ query: 'cardiologists in texas with high trust score' })
      .expect(200);

    expect(resolveSearchRequestContextMock).toHaveBeenCalled();
    expect(invokeAgentModelMock).toHaveBeenCalled();
    expect(executeCopilotQueryMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'cardiologists in texas with high trust score',
      limit: 20,
    }));
    expect(() => copilotQueryResponseSchema.parse(response.body)).not.toThrow();
  });
});
