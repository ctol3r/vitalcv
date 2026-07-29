/**
 * The public provider surfaces sent no Cache-Control at all, so an
 * intermediary was free to cache them heuristically and keep serving a payload
 * after a correction shipped. These routes are reachable unauthenticated on the
 * backend's own public domain, so the web proxy's headers do not cover them.
 *
 * Asserted per response rather than on the middleware function, so the guard
 * survives any refactor that keeps the header but moves where it is set.
 */

import express from 'express';
import request from 'supertest';

jest.mock('../../services/providers/providerSmokeTest', () => ({
  runProviderSmokeTests: jest.fn(),
  runSingleSmokeTest: jest.fn(),
}));

jest.mock('../../services/providers/providerSourceProvenance', () => ({
  getProvenanceChain: jest.fn(() => ({ npi: '1234567890', records: [] })),
  getProvenanceHealth: jest.fn(() => ({ ok: true })),
}));

jest.mock('../../services/providers/connectors/connectorHealthTracker', () => ({
  getConnectorAlerts: jest.fn(() => []),
  getConnectorDiagnostics: jest.fn(() => ({ overall: 'OK', connectors: [] })),
}));

jest.mock('../../services/investigation/investigationWorkbenchService', () => ({
  buildProviderInvestigationPayload: jest.fn(),
}));

jest.mock('../../services/providers/providerDirectory', () => ({
  generateDirectory: jest.fn(async () => ({ entries: [], totalProviders: 0 })),
  exportFHIRDirectory: jest.fn(async () => ({ resourceType: 'Bundle', entry: [] })),
  exportCSVDirectory: jest.fn(async () => ({
    content: 'NPI\n',
    integrityHash: 'h',
    pageInfo: {
      page: 1,
      pageSize: 500,
      returned: 0,
      totalAvailable: 0,
      totalPages: 0,
      hasNextPage: false,
    },
  })),
  publishDirectorySnapshot: jest.fn(),
  getDirectorySnapshot: jest.fn(() => null),
  listDirectorySnapshots: jest.fn(() => []),
  verifyDirectoryIntegrity: jest.fn(() => null),
  generateSignedDirectory: jest.fn(async () => ({ version: '1.0', entries: [] })),
}));

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      count: jest.fn(async () => 0),
      findMany: jest.fn(async () => []),
    },
    graphNode: { findMany: jest.fn(async () => []) },
    graphEdge: { findMany: jest.fn(async () => []) },
  },
}));

import { registerProviderRoutes } from '../providers';
import { registerProviderDirectoryRoutes } from '../providerDirectory';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerProviderRoutes(app);
  registerProviderDirectoryRoutes(app);
  return app;
}

describe('public provider surfaces send Cache-Control: no-store', () => {
  const paths = [
    '/api/providers',
    '/api/providers/provenance/1234567890',
    '/api/directory',
    '/api/directory/fhir',
    '/api/directory/csv',
    '/api/directory/signed',
    '/api/directory/snapshots',
  ];

  it.each(paths)('%s is not cacheable', async (path) => {
    const response = await request(buildApp()).get(path);

    expect(response.status).toBeLessThan(500);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
