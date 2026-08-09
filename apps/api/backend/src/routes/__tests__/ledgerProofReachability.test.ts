import express from 'express';
import request from 'supertest';

/**
 * Anchor-witness proof routes — reachability through the REAL guard stack.
 *
 * ledgerProof.test.ts mounts the router on a bare Express app, which proves
 * the handler contract but says nothing about whether a request survives the
 * global middleware in app.ts. It did not: production 401'd every call to
 * /api/ledger/* because the tenant guard's skip-list had no entry for them,
 * and a route whose entire audience is unauthenticated third parties is
 * worthless if it 401s them. Handler-only tests cannot see that class of
 * bug — this file exists to.
 *
 * The assertion is the OUTCOME (an anonymous caller reaches the handler and
 * gets its status), not the mechanism, so it keeps working if the guard is
 * ever reimplemented.
 */

const prismaMock = {
  anchorRoot: { findUnique: jest.fn() },
  auditEvent: { findUnique: jest.fn(), findMany: jest.fn() },
};

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: prismaMock,
}));

import { requireTenantContextOrReadAccess, shouldSkipTenantContext } from '../../middleware/tenantGuard';
import { registerLedgerProofRoutes } from '../ledgerProof';

/** The guard as app.ts mounts it: globally, ahead of every route. */
function buildGuardedApp() {
  const app = express();
  app.use(requireTenantContextOrReadAccess);
  registerLedgerProofRoutes(app);
  return app;
}

const HEX = 'a'.repeat(64);

afterEach(() => jest.clearAllMocks());

describe('ledger proof routes survive the global tenant guard', () => {
  it('the skip-list covers the whole /api/ledger/ family', () => {
    expect(shouldSkipTenantContext('/api/ledger/anchors/' + HEX)).toBe(true);
    expect(shouldSkipTenantContext('/api/ledger/events/x/proof')).toBe(true);
  });

  it('an anonymous anchor lookup reaches the handler (404), never a 401', async () => {
    prismaMock.anchorRoot.findUnique.mockResolvedValue(null);
    const res = await request(buildGuardedApp()).get(`/api/ledger/anchors/${HEX}`);
    expect(res.status).toBe(404); // the handler's answer, not the guard's
    expect(prismaMock.anchorRoot.findUnique).toHaveBeenCalled();
  });

  it('an anonymous malformed root reaches the handler (400), never a 401', async () => {
    const res = await request(buildGuardedApp()).get('/api/ledger/anchors/nothex');
    expect(res.status).toBe(400);
  });

  it('an anonymous event proof lookup reaches the handler, never a 401', async () => {
    prismaMock.auditEvent.findUnique.mockResolvedValue(null);
    const res = await request(buildGuardedApp()).get(
      '/api/ledger/events/00000000-0000-4000-8000-000000000000/proof',
    );
    expect(res.status).toBe(404);
    expect(prismaMock.auditEvent.findUnique).toHaveBeenCalled();
  });

  it('the exemption is scoped to /api/ledger/ and does not leak to neighbours', () => {
    expect(shouldSkipTenantContext('/api/ledgerx/anchors')).toBe(false);
    expect(shouldSkipTenantContext('/api/clinician/activate')).toBe(false);
  });
});
