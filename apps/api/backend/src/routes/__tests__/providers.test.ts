import express from 'express';
import request from 'supertest';

jest.mock('../../services/providers/providerSmokeTest', () => ({
  runProviderSmokeTests: jest.fn(),
  runSingleSmokeTest: jest.fn(),
}));

jest.mock('../../services/providers/providerSourceProvenance', () => ({
  getProvenanceChain: jest.fn(),
  getProvenanceHealth: jest.fn(),
}));

jest.mock('../../services/providers/connectors/connectorHealthTracker', () => ({
  getConnectorAlerts: jest.fn(),
  getConnectorDiagnostics: jest.fn(),
}));

jest.mock('../../services/investigation/investigationWorkbenchService', () => ({
  buildProviderInvestigationPayload: jest.fn(),
}));

import { buildProviderInvestigationPayload } from '../../services/investigation/investigationWorkbenchService';
import { registerProviderRoutes } from '../providers';

const buildProviderInvestigationPayloadMock =
  buildProviderInvestigationPayload as jest.MockedFunction<typeof buildProviderInvestigationPayload>;

function buildApp() {
  const app = express();
  app.use(express.json());
  registerProviderRoutes(app);
  return app;
}

describe('provider routes', () => {
  beforeEach(() => {
    buildProviderInvestigationPayloadMock.mockReset();
  });

  it('returns the provider investigation payload', async () => {
    buildProviderInvestigationPayloadMock.mockResolvedValue({
      generatedAt: '2026-03-15T12:00:00.000Z',
      providerId: '1234567890',
      providerSummary: {
        npi: '1234567890',
        providerName: 'Ada Lovelace',
        primarySpecialty: 'Cardiology',
        secondarySpecialties: [],
        state: 'TX',
        affiliations: ['Mayo Clinic'],
        trustBreakdown: {
          npi: '1234567890',
          methodology: 'trust-score/v1',
          score: 91,
          band: 'L3',
          bandLabel: 'Trusted',
          confidence: 0.91,
          totalPenalty: 0,
          dimensions: [],
          contradictions: [],
          gaps: [],
          trustLimits: [],
          recommendations: [],
          timeline: [],
        },
        anomalySummary: {
          anomalyCount: 0,
          overallSeverity: 'NONE',
        },
        networkHighlights: [],
        searchEvidence: [],
        copilotDigest: null,
        graphSummary: null,
        intelligenceSummary: {
          graphInsights: [],
          sourceReliability: [],
        },
      },
      findingsInbox: {
        generatedAt: '2026-03-15T12:00:00.000Z',
        total: 0,
        rows: [],
      },
      storylines: [],
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
    } as Awaited<ReturnType<typeof buildProviderInvestigationPayload>>);

    const response = await request(buildApp())
      .get('/api/providers/1234567890/investigation')
      .expect(200);

    expect(response.body.schema).toBe('https://vitalcv.com/providers/investigation/v1');
    expect(response.body.providerId).toBe('1234567890');
  });

  it('rejects invalid NPIs for provider investigation', async () => {
    await request(buildApp())
      .get('/api/providers/not-an-npi/investigation')
      .expect(400);
  });
});
