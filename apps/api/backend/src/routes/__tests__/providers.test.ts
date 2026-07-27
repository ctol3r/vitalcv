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

  it('returns the structured provider list with NPI and name only', async () => {
    prismaMock.provider.count.mockResolvedValue(1);
    prismaMock.provider.findMany.mockResolvedValue([{
      npi: '1234567890',
      fullName: 'Ada Lovelace',
    }]);

    const response = await request(buildApp())
      .get('/api/providers?limit=10')
      .expect(200);

    expect(response.body).toEqual({
      schema: 'https://vitalcv.com/providers/v2',
      count: 1,
      total: 1,
      providers: [{
        npi: '1234567890',
        fullName: 'Ada Lovelace',
      }],
      fieldsWithheld: [
        'providerType',
        'specialty',
        'taxonomyCode',
        'stateOfPractice',
        'affiliations',
      ],
      disclosure: expect.stringContaining('NPI and name only'),
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

/**
 * P0.1 containment — GET /api/providers must not publicly assert provider type,
 * specialty/taxonomy or practice location for a real NPI.
 *
 * The fixture below is the literal payload production served on 2026-07-27 for
 * the ten NPIs seeded from the head of the NPI registry. `stored` is what sat
 * in the `Provider` row; `nppes` is what the free NPPES registry actually says.
 * Two rows are NPPES NPI-2 organizations that the row labelled `Individual`,
 * all ten shared one taxonomy code, and nine of ten named the wrong state.
 *
 * These tests assert the outcome (no fabricated value reaches a public caller),
 * not the mechanism, so a later provenance-carrying rewrite is free to change
 * how the fields are suppressed as long as unsourced values stay unpublished.
 */
const PRODUCTION_ROWS = [
  { npi: '1003000126', fullName: 'ARDALAN ENKESHAFI, M.D.', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'CA' }, nppes: { type: 'NPI-1', taxonomyCode: '208M00000X', state: 'MD' } },
  { npi: '1003000134', fullName: 'Dr. THOMAS LEE CIBULL, M.D.', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'TX' }, nppes: { type: 'NPI-1', taxonomyCode: '207ZP0102X', state: 'IL' } },
  { npi: '1003000142', fullName: 'RASHID KHALIL, M.D.', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'NY' }, nppes: { type: 'NPI-1', taxonomyCode: '207L00000X', state: 'OH' } },
  { npi: '1003000159', fullName: 'MARSHA SUSAN VOGES, FNP', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'IL' }, nppes: { type: 'NPI-1', taxonomyCode: '363LF0000X', state: 'SC' } },
  { npi: '1003000167', fullName: 'Dr. JULIO EDGARDO ESCOBAR, DDS', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'MA' }, nppes: { type: 'NPI-1', taxonomyCode: '122300000X', state: 'NV' } },
  { npi: '1003000175', fullName: 'Dr. BELINDA REYES-VASQUEZ, D.D.S.', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'FL' }, nppes: { type: 'NPI-1', taxonomyCode: '122300000X', state: 'CA' } },
  { npi: '1003000183', fullName: 'Mr. DENNIS JAMES CYPHERS, L.M.P', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'WA' }, nppes: { type: 'NPI-1', taxonomyCode: '225700000X', state: 'WA' } },
  { npi: '1003000191', fullName: 'ALYSSA WELTMAN', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'GA' }, nppes: { type: 'NPI-1', taxonomyCode: '235Z00000X', state: 'NC' } },
  { npi: '1003000209', fullName: 'KOPELMAN FAMILY CHIROPRACTIC INC', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'AZ' }, nppes: { type: 'NPI-2', taxonomyCode: '111N00000X', state: 'MA' } },
  { npi: '1003000217', fullName: 'TRI-STATE EYE CARE CENTER, LTD.', stored: { providerType: 'Individual', taxonomyCode: '207R00000X', stateOfPractice: 'CO' }, nppes: { type: 'NPI-2', taxonomyCode: '152W00000X', state: 'WV' } },
] as const;

describe('GET /api/providers — P0.1 truth containment', () => {
  beforeEach(() => {
    prismaMock.provider.count.mockReset();
    prismaMock.provider.findMany.mockReset();
    prismaMock.graphNode.findMany.mockReset();
    prismaMock.graphEdge.findMany.mockReset();

    prismaMock.provider.count.mockResolvedValue(PRODUCTION_ROWS.length);
    // The mock hands back the FULL stored row, fabricated columns included, and
    // ignores `select` on purpose. If the fixture returned only the safe columns
    // the withheld values would be `undefined`, JSON.stringify would drop them,
    // and every content assertion below would pass even against a route that
    // happily forwards them. Returning the fabricated values means these tests
    // fail the moment the route maps one into the response.
    prismaMock.provider.findMany.mockResolvedValue(
      PRODUCTION_ROWS.map((row) => ({
        npi: row.npi,
        fullName: row.fullName,
        providerType: row.stored.providerType,
        taxonomyCode: row.stored.taxonomyCode,
        stateOfPractice: row.stored.stateOfPractice,
      })),
    );
    prismaMock.graphNode.findMany.mockResolvedValue([]);
    prismaMock.graphEdge.findMany.mockResolvedValue([]);
  });

  it('publishes NPI and name for every affected record', async () => {
    const response = await request(buildApp()).get('/api/providers?limit=100').expect(200);

    expect(response.body.providers).toHaveLength(PRODUCTION_ROWS.length);
    for (const row of PRODUCTION_ROWS) {
      expect(response.body.providers).toContainEqual({ npi: row.npi, fullName: row.fullName });
    }
  });

  it('omits every withheld key from each published record', async () => {
    const response = await request(buildApp()).get('/api/providers?limit=100').expect(200);

    for (const provider of response.body.providers) {
      expect(Object.keys(provider).sort()).toEqual(['fullName', 'npi']);
    }
  });

  it('never emits a stored provider type, taxonomy or state anywhere in the response', async () => {
    const response = await request(buildApp()).get('/api/providers?limit=100').expect(200);
    const serialized = JSON.stringify(response.body.providers);

    for (const row of PRODUCTION_ROWS) {
      expect(serialized).not.toContain(row.stored.providerType);
      expect(serialized).not.toContain(row.stored.taxonomyCode);
      // A bare two-letter state would collide with substrings of real names, so
      // assert on the field's absence rather than on the literal value.
      expect(serialized).not.toContain(`"stateOfPractice"`);
    }
  });

  it('does not label an NPPES organization as an individual', async () => {
    const response = await request(buildApp()).get('/api/providers?limit=100').expect(200);

    const organizations = PRODUCTION_ROWS.filter((row) => row.nppes.type === 'NPI-2');
    expect(organizations.length).toBeGreaterThan(0);

    for (const org of organizations) {
      const published = response.body.providers.find((p: { npi: string }) => p.npi === org.npi);
      expect(published).toBeDefined();
      expect(JSON.stringify(published)).not.toContain('Individual');
    }
  });

  it('never publishes the shared 207R00000X taxonomy the rows all carried', async () => {
    const response = await request(buildApp()).get('/api/providers?limit=100').expect(200);

    expect(JSON.stringify(response.body)).not.toContain('207R00000X');
    expect(JSON.stringify(response.body)).not.toContain('Internal Medicine');
  });

  it('does not read withheld columns from the database', async () => {
    await request(buildApp()).get('/api/providers?limit=100').expect(200);

    const select = prismaMock.provider.findMany.mock.calls[0][0].select;
    expect(Object.keys(select).sort()).toEqual(['fullName', 'npi']);
  });

  it('does not consult graph metadata for a specialty substitute', async () => {
    await request(buildApp()).get('/api/providers?limit=100').expect(200);

    expect(prismaMock.graphNode.findMany).not.toHaveBeenCalled();
    expect(prismaMock.graphEdge.findMany).not.toHaveBeenCalled();
  });

  it('does not let ?q= act as an oracle for a withheld field', async () => {
    await request(buildApp()).get('/api/providers?q=207R00000X').expect(200);

    const where = prismaMock.provider.findMany.mock.calls[0][0].where;
    const searchedColumns = (where.OR as Array<Record<string, unknown>>).flatMap(Object.keys);

    expect(searchedColumns.sort()).toEqual(['fullName', 'npi']);
    for (const withheld of ['providerType', 'taxonomyCode', 'stateOfPractice']) {
      expect(searchedColumns).not.toContain(withheld);
    }
  });

  it('marks the withheld fields so a caller can tell withheld from empty', async () => {
    const response = await request(buildApp()).get('/api/providers?limit=100').expect(200);

    expect(response.body.fieldsWithheld).toEqual([
      'providerType',
      'specialty',
      'taxonomyCode',
      'stateOfPractice',
      'affiliations',
    ]);
    expect(response.body.disclosure).toContain('not source-backed');
  });
});
