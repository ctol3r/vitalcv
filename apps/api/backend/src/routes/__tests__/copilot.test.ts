import express from 'express';
import request from 'supertest';

jest.mock('../../services/search/requestContext', () => ({
  resolveSearchRequestContext: jest.fn(),
}));

jest.mock('../../services/copilot/copilotQueryService', () => ({
  executeCopilotQuery: jest.fn(),
}));

jest.mock('../../services/copilot/copilotContextService', () => ({
  hasRequestedCopilotAnchor: jest.fn((anchor: {
    providerId?: string | null;
    findingId?: string | null;
    storylineId?: string | null;
  }) => Boolean(anchor.providerId ?? anchor.findingId ?? anchor.storylineId)),
  loadCopilotContext: jest.fn(),
  resolveCopilotContextAnchor: jest.fn((input: {
    providerId?: string | null;
    findingId?: string | null;
    storylineId?: string | null;
    context?: {
      provider?: { npi?: string };
      finding?: { id?: string };
      storyline?: { id?: string };
    };
  }) => ({
    providerId: input.providerId ?? input.context?.provider?.npi ?? null,
    findingId: input.findingId ?? input.context?.finding?.id ?? null,
    storylineId: input.storylineId ?? input.context?.storyline?.id ?? null,
  })),
  shouldWarmCopilot: jest.fn(),
}));

jest.mock('../../services/investigation/copilotInvestigationService', () => ({
  buildCopilotInvestigationPayload: jest.fn(),
}));

jest.mock('../../llm', () => ({
  invokeAgentModel: jest.fn(),
}));

import { invokeAgentModel } from '../../llm';
import {
  copilotQueryResponseSchema,
} from '../../services/copilot/contracts';
import { executeCopilotQuery } from '../../services/copilot/copilotQueryService';
import {
  loadCopilotContext,
  shouldWarmCopilot,
} from '../../services/copilot/copilotContextService';
import { buildCopilotInvestigationPayload } from '../../services/investigation/copilotInvestigationService';
import { resolveSearchRequestContext } from '../../services/search/requestContext';
import { registerCopilotRoutes } from '../copilot';
import { HttpError } from '../../utils/httpError';

const resolveSearchRequestContextMock =
  resolveSearchRequestContext as jest.MockedFunction<typeof resolveSearchRequestContext>;
const executeCopilotQueryMock =
  executeCopilotQuery as jest.MockedFunction<typeof executeCopilotQuery>;
const loadCopilotContextMock =
  loadCopilotContext as jest.MockedFunction<typeof loadCopilotContext>;
const shouldWarmCopilotMock =
  shouldWarmCopilot as jest.MockedFunction<typeof shouldWarmCopilot>;
const buildCopilotInvestigationPayloadMock =
  buildCopilotInvestigationPayload as jest.MockedFunction<typeof buildCopilotInvestigationPayload>;
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
    loadCopilotContextMock.mockReset();
    shouldWarmCopilotMock.mockReset();
    buildCopilotInvestigationPayloadMock.mockReset();
    invokeAgentModelMock.mockReset();

    resolveSearchRequestContextMock.mockResolvedValue({
      aclLevel: 'PUBLIC',
      isAuthenticated: false,
      membershipRoles: ['PUBLIC'],
      queryHash: 'hashed-query',
    });
    loadCopilotContextMock.mockResolvedValue({
      provider: {
        providerId: '1234567890',
        label: 'Dr. High Trust',
        specialty: 'Cardiology',
        state: 'TX',
        trustScore: 91,
        trustBand: 'L3',
        trustConfidence: 0.88,
        activeFindings: 1,
        anomalyCount: 0,
        anomalySeverity: null,
        affiliations: ['Mayo Clinic'],
        networkHighlights: [],
        sources: ['NPPES', 'PECOS'],
      },
      recentFindings: [],
      activeStorylines: [],
      networkSummary: null,
      riskSignals: [],
    });
    shouldWarmCopilotMock.mockReturnValue(false);

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

  it('returns the structured copilot investigation payload', async () => {
    const app = buildApp();
    buildCopilotInvestigationPayloadMock.mockResolvedValue({
      generatedAt: '2026-03-15T12:00:00.000Z',
      objective: 'Assess provider 1234567890 for escalation readiness.',
      keyQuestions: ['What changed most recently?'],
      signalChecks: [],
      evidenceSummary: [],
      networkContext: {
        focusNodeId: null,
        highlights: [],
        topPaths: [],
      },
      confidenceAssessment: {
        score: 0.81,
        level: 'high',
        reasoning: ['Signals are corroborated across findings and storyline context.'],
      },
      recommendedAction: 'Escalate to analyst review.',
      followUpQueries: ['Show supporting findings for provider 1234567890'],
    });

    const response = await request(app)
      .post('/api/copilot/investigation')
      .send({ providerId: '1234567890' })
      .expect(200);

    expect(buildCopilotInvestigationPayloadMock).toHaveBeenCalledWith({
      providerId: '1234567890',
      storylineId: null,
      objective: null,
    });
    expect(response.body.schema).toBe('https://vitalcv.com/copilot/investigation/v1');
    expect(response.body.confidenceAssessment.level).toBe('high');
  });

  it('returns the new copilot query contract', async () => {
    const app = buildApp();

    executeCopilotQueryMock.mockResolvedValue({
      answer: 'Dr. High Trust is the strongest current match for this query.',
      sources: ['NPPES', 'PECOS', 'OIG'],
      confidence: 0.87,
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
      .send({
        query: 'cardiologists in texas with high trust score',
        sessionId: 'session-123',
        context: {
          scope: 'provider',
          provider: {
            npi: '1234567890',
            label: 'Dr. High Trust',
            specialty: 'Cardiology',
            state: 'TX',
            trustScore: 91,
            trustBand: 'L3',
          },
          recentFindings: [],
          evidenceSummary: [],
          riskSummary: {
            trustScore: 91,
            trustBand: 'L3',
            summary: 'Current provider is under review.',
          },
        },
        command: {
          name: 'summarize',
          raw: '/summarize',
        },
      })
      .expect(200);

    expect(resolveSearchRequestContextMock).toHaveBeenCalled();
    expect(invokeAgentModelMock).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        sessionId: 'session-123',
        contextScope: 'provider',
        command: 'summarize',
      }),
      attributes: expect.objectContaining({
        'vitalcv.copilot.context_scope': 'provider',
        'vitalcv.copilot.command': 'summarize',
      }),
    }), expect.any(Function));
    expect(executeCopilotQueryMock).toHaveBeenCalledWith(expect.objectContaining({
      query: 'cardiologists in texas with high trust score',
      limit: 20,
    }));
    expect(() => copilotQueryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.status).toBe('ok');
    expect(response.body.document.sections).toHaveLength(6);
  });

  it('returns the warming fallback instead of failing when anchored context is not ready', async () => {
    const app = buildApp();
    loadCopilotContextMock.mockResolvedValue({
      provider: null,
      recentFindings: [],
      activeStorylines: [],
      networkSummary: null,
      riskSignals: [],
    });
    shouldWarmCopilotMock.mockReturnValue(true);

    const response = await request(app)
      .post('/api/copilot/query')
      .send({
        query: 'Explain this provider',
        providerId: '1234567890',
      })
      .expect(200);

    expect(executeCopilotQueryMock).not.toHaveBeenCalled();
    expect(response.body.status).toBe('limited');
    expect(response.body.message).toBe('System warming — data loading');
    expect(response.body.answer).toBe('System warming — data loading');
    expect(response.body.sources).toEqual([]);
    expect(response.body.confidence).toBe(0);
  });

  it('rejects structurally invalid copilot cross-references', async () => {
    const app = buildApp();

    executeCopilotQueryMock.mockResolvedValue({
      answer: 'Broken explanation response',
      sources: ['NPPES'],
      confidence: 0.87,
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
        semanticTopics: ['Cardiology', 'TX'],
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
          summary: 'Cardiology clinician in TX.',
          scores: {
            relevance: 0.91,
            trustScore: 0.91,
            freshness: 0.8,
            sourceCoverage: 0.75,
            total: 0.87,
          },
          sourceCoverage: ['NPPES'],
        },
      ],
      explanations: [
        {
          resultId: 'clinician:does-not-exist',
          title: 'Broken explanation',
          summary: 'Broken explanation',
          because: ['specialty = Cardiology'],
          matchedFilters: [],
          verifiedSources: ['NPPES'],
          scoring: {
            relevance: 0.91,
            trustScore: 0.91,
            freshness: 0.8,
            sourceCoverage: 0.75,
            total: 0.87,
          },
        },
      ],
      graphInsights: [],
    });

    const response = await request(app)
      .post('/api/copilot/query')
      .send({ query: 'cardiologists in texas with high trust score' })
      .expect(200);

    expect(() => copilotQueryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.status).toBe('limited');
    expect(response.body.title).toBe('Copilot source unavailable');
    expect(response.body.document.sections).toHaveLength(6);
  });

  it('returns a limited response for recoverable copilot execution failures', async () => {
    const app = buildApp();
    executeCopilotQueryMock.mockRejectedValue(new Error('downstream source unavailable'));

    const response = await request(app)
      .post('/api/copilot/query')
      .send({ query: 'cardiologists in texas with high trust score' })
      .expect(200);

    expect(() => copilotQueryResponseSchema.parse(response.body)).not.toThrow();
    expect(response.body.status).toBe('limited');
    expect(response.body.message).toContain('live investigation sources were unavailable');
    expect(response.body.document.sections).toHaveLength(6);
  });

  it('preserves non-recoverable http errors from the copilot runtime', async () => {
    const app = buildApp();
    invokeAgentModelMock.mockRejectedValue(new HttpError(403, 'Forbidden'));

    const response = await request(app)
      .post('/api/copilot/query')
      .send({ query: 'cardiologists in texas with high trust score' })
      .expect(403);

    expect(response.body.message ?? response.body.error).toContain('Forbidden');
  });
});
