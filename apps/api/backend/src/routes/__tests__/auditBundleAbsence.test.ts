import request from 'supertest';
import express from 'express';
import { registerAuditRoutes } from '../audit';
import { buildAuditBundleProof } from '../../services/audit/auditBundleProof';
import { HttpError } from '../../utils/httpError';

jest.mock('../../services/audit/auditBundleProof', () => ({
  __esModule: true,
  buildAuditBundleProof: jest.fn(),
}));

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {},
}));

const mockedBuild = buildAuditBundleProof as jest.MockedFunction<
  typeof buildAuditBundleProof
>;

function makeApp() {
  const app = express();
  registerAuditRoutes(app);
  return app;
}

/**
 * An NPI with no artifacts has no audit bundle. That is absence, and absence is
 * a 404 — it used to surface as a 500 because the service threw a bare Error
 * whose wording ("missing credential artifacts") did not contain the substring
 * the route sniffed for ("not found").
 *
 * These assert the status the caller receives, so they stay honest if the
 * message wording changes again.
 */
describe('GET /api/audit/bundle/:npi — absence is not a server fault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 when the bundle has no artifacts', async () => {
    mockedBuild.mockRejectedValueOnce(
      new HttpError(404, 'Audit bundle not found for 1234567893'),
    );

    const res = await request(makeApp()).get('/api/audit/bundle/1234567893');

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');
  });

  it('still returns 500 for a genuine fault', async () => {
    mockedBuild.mockRejectedValueOnce(new Error('database connection lost'));

    const res = await request(makeApp()).get('/api/audit/bundle/1234567893');

    expect(res.status).toBe(500);
  });

  it('rejects a malformed NPI before doing any work', async () => {
    const res = await request(makeApp()).get('/api/audit/bundle/not-an-npi');

    expect(res.status).toBe(400);
    expect(mockedBuild).not.toHaveBeenCalled();
  });
});
