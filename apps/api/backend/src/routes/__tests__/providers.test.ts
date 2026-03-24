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

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    graphNode: {
      findMany: jest.fn(),
    },
    graphEdge: {
      findMany: jest.fn(),
    },
  },
}));

import { buildProviderInvestigationPayload } from '../../services/investigation/investigationWorkbenchService';
import prisma from '../../graphql/prisma_client';
import {
  getConnectorAlerts,
  getConnectorDiagnostics,
} from '../../services/providers/connectors/connectorHealthTracker';
import { registerProviderRoutes } from '../providers';

const buildProviderInvestigationPayloadMock =
  buildProviderInvestigationPayload as jest.MockedFunction<typeof buildProviderInvestigationPayload>;
const getConnectorAlertsMock = getConnectorAlerts as jest.MockedFunction<typeof getConnectorAlerts>;
const getConnectorDiagnosticsMock = getConnectorDiagnostics as jest.MockedFunction<typeof getConnectorDiagnostics>;
const prismaMock = prisma as unknown as {
  provider: {
    count: jest.Mock;
    findMany: jest.Mock;
  };
  graphNode: {
    findMany: jest.Mock;
  };
  graphEdge: {
    findMany: jest.Mock;
  };
};

function buildApp() {
  const app = express();
  app.use(express.json());
  registerProviderRoutes(app);
  return app;
}

describe('provider routes', () => {
  beforeEach(() => {
    buildProviderInvestigationPayloadMock.mockReset();
    getConnectorAlertsMock.mockReset();
    getConnectorDiagnosticsMock.mockReset();
    prismaMock.provider.count.mockReset();
    prismaMock.provider.findMany.mockReset();
    prismaMock.graphNode.findMany.mockReset();
    prismaMock.graphEdge.findMany.mockReset();
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

  it('returns the structured provider list with affiliations', async () => {
    prismaMock.provider.count.mockResolvedValue(1);
    prismaMock.provider.findMany.mockResolvedValue([{
      npi: '1234567890',
      fullName: 'Ada Lovelace',
      providerType: 'Physician',
      taxonomyCode: '207RC0000X',
      stateOfPractice: 'TX',
    }]);
    prismaMock.graphNode.findMany.mockResolvedValue([{
      id: 'graph-provider-1',
      metadata: {
        npi: '1234567890',
        specialty: 'Cardiology',
        institution: 'Mayo Clinic',
      },
    }]);
    prismaMock.graphEdge.findMany.mockResolvedValue([
      {
        sourceNodeId: 'graph-provider-1',
        targetNode: {
          label: 'Mayo Clinic',
        },
      },
      {
        sourceNodeId: 'graph-provider-1',
        targetNode: {
          label: 'Cleveland Clinic',
        },
      },
    ]);

    const response = await request(buildApp())
      .get('/api/providers?limit=10')
      .expect(200);

    expect(response.body).toEqual({
      schema: 'https://vitalcv.com/providers/v1',
      count: 1,
      total: 1,
      providers: [{
        npi: '1234567890',
        fullName: 'Ada Lovelace',
        providerType: 'Physician',
        specialty: 'Cardiology',
        taxonomyCode: '207RC0000X',
        stateOfPractice: 'TX',
        affiliations: ['Mayo Clinic', 'Cleveland Clinic'],
      }],
    });
  });

  it('rejects invalid NPIs for provider investigation', async () => {
    await request(buildApp())
      .get('/api/providers/not-an-npi/investigation')
      .expect(400);
  });

  it('returns connector diagnostics from the health endpoint', async () => {
    getConnectorDiagnosticsMock.mockReturnValue({
      overall: 'DEGRADED',
      generatedAt: '2026-03-24T12:00:00.000Z',
      connectors: [{
        connector: 'OIG',
        status: 'DEGRADED',
        statusReasons: ['Connector is near its quota limit (85% used).'],
        nextAction: 'Slow polling or spread traffic before hard blocking begins.',
        health: {} as never,
        quota: {} as never,
        schema: {} as never,
        recentAlerts: [],
        recommendations: [],
      }],
    });

    const response = await request(buildApp())
      .get('/api/providers/health/diagnostics')
      .expect(200);

    expect(response.body.overall).toBe('DEGRADED');
    expect(response.body.connectors[0].statusReasons[0]).toContain('quota');
  });

  it('returns connector alerts from the health alerts endpoint', async () => {
    getConnectorAlertsMock.mockReturnValue([{
      id: 'alert-1',
      connector: 'NPDB',
      type: 'QUARANTINE',
      severity: 'CRITICAL',
      message: 'NPDB quarantined after critical schema drift',
      createdAt: '2026-03-24T12:00:00.000Z',
    }]);

    const response = await request(buildApp())
      .get('/api/providers/health/alerts')
      .expect(200);

    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0]).toMatchObject({
      connector: 'NPDB',
      severity: 'CRITICAL',
    });
  });
});
