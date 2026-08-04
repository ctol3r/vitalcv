// Wire-level pin for the identity-failure contract, kept beside the service
// tests it belongs to.
//
// The failure kind is only worth anything if it reaches the caller: GET
// /api/identity/bootstrap/:npi answers HTTP 200 for every upstream outcome, so
// the response BODY is the only place a consumer can tell "this NPI does not
// exist" from "CMS is down". This suite mounts the real route on a real Express
// app and mocks only the network boundary.
const prismaMock = {
  personProfile: { findUnique: jest.fn() },
  organizationProfile: { findFirst: jest.fn() },
};

const fetchWithRetryMock = jest.fn();

jest.mock('../../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

jest.mock('../../../obs/logger', () => ({
  log: jest.fn(),
  reqLogFields: () => ({}),
}));

jest.mock('../../../utils/fetchWithRetry', () => ({
  fetchWithRetry: (...args: unknown[]) => fetchWithRetryMock(...args),
}));

jest.mock('../../../modules/identity', () => ({
  fetchNpiFromCMS: jest.requireActual('../../../modules/identity/nppes.service')
    .fetchNpiFromCMS,
  normalizeProvider: jest.requireActual('../../../modules/identity/nppes.validator')
    .normalizeProvider,
}));

import express from 'express';
import request from 'supertest';
import { registerWorkspaceRoutes } from '../../../routes/workspace';
import { resetNppesCacheForTests } from '../../../modules/identity/nppes.service';

const NPI = '1003000126';

function buildApp() {
  const app = express();
  app.use(express.json());
  registerWorkspaceRoutes(app);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
  resetNppesCacheForTests();
  prismaMock.personProfile.findUnique.mockResolvedValue(null);
  prismaMock.organizationProfile.findFirst.mockResolvedValue(null);
});

describe('GET /api/identity/bootstrap/:npi — failure kind on the wire', () => {
  it('an unknown NPI answers 200 with identityFailure not_found', async () => {
    fetchWithRetryMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ result_count: 0, results: [] }),
    });

    const res = await request(buildApp()).get(`/api/identity/bootstrap/${NPI}`);

    expect(res.status).toBe(200);
    expect(res.body.identitySource).toBe('UNAVAILABLE');
    expect(res.body.identityFailure).toBe('not_found');
  });

  it('a CMS outage answers 200 with identityFailure source_unavailable', async () => {
    fetchWithRetryMock.mockRejectedValue(new TypeError('fetch failed'));

    const res = await request(buildApp()).get(`/api/identity/bootstrap/${NPI}`);

    expect(res.status).toBe(200);
    // Same identitySource as the case above — the two are only separable via
    // identityFailure, which is the whole point of the field.
    expect(res.body.identitySource).toBe('UNAVAILABLE');
    expect(res.body.identityFailure).toBe('source_unavailable');
  });

  it('a resolved NPI answers the pre-existing payload with no extra key', async () => {
    fetchWithRetryMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          result_count: 1,
          results: [
            {
              number: NPI,
              enumeration_type: 'NPI-1',
              basic: { status: 'A', first_name: 'ARDALAN', last_name: 'ENKESHAFI' },
            },
          ],
        }),
    });

    const res = await request(buildApp()).get(`/api/identity/bootstrap/${NPI}`);

    expect(res.status).toBe(200);
    expect(res.body.identitySource).toBe('NPPES_API');
    expect(res.body).not.toHaveProperty('identityFailure');
  });
});
