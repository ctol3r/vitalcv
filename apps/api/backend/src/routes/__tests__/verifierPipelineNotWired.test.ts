/**
 * Wave 190 verifier-pipeline routes must stay off the served app.
 *
 * All six were reachable in production with no authentication. The global
 * `requireTenantContextOrReadAccess` did run in front of them, but the org
 * context it demands comes from a caller-supplied `x-org-id` header or
 * `?organizationId=` query param — middleware/organizationContext.ts documents
 * that source as "unauthenticated ... tracked as gap G1". So the guard cost an
 * attacker exactly one header. Measured against production at fab96fc41: a bare
 * GET /api/verifier/candidates returned 401, and the same request carrying
 * `x-org-id: probe-org` returned 200.
 *
 * The full defect list, and what a restore has to implement, is in the header of
 * routes/verifierPipeline.ts.
 *
 * WHY THIS ASSERTS 404 AND NOT 401
 * 401 would mean the routes are still registered and merely guard-rejected —
 * one header away from serving again, which is the exact state this change
 * exists to leave behind. 404 is the only status that proves the handlers are
 * not mounted at all. Each request below deliberately carries the headers that
 * used to bypass the guard, so a pass means "no such route", not "guard held".
 *
 * This boots the real app rather than grepping app.ts, so it keeps holding if
 * the routes are ever re-registered indirectly (a different helper, a router
 * mounted elsewhere). That costs ~50s of module init; the suite already runs
 * sequentially with --forceExit, so it is a one-time cost, not a per-test one.
 *
 * If you are restoring the widget (roadmap H1) WITH real authentication, this
 * test is supposed to fail. Fix all four defects listed in the verifierPipeline.ts
 * header, then rewrite this to assert the new auth — do not simply delete it.
 */
import request from 'supertest';

import app from '../../app';

// The app's module init (trust-list ingestion, detail-agent setup) dominates;
// the requests themselves are single-digit milliseconds.
jest.setTimeout(180_000);

type Case = { method: 'get' | 'post'; path: string; body?: Record<string, unknown> };

const FORMER_ROUTES: Case[] = [
  { method: 'post', path: '/api/widget/apply', body: { npi: '0000000000', opportunityId: 'op_1', verifierOrgId: 'ANY_ORG' } },
  { method: 'get', path: '/api/verifier/candidates' },
  { method: 'get', path: '/api/verifier/candidates/pool' },
  { method: 'post', path: '/api/verifier/offers/send', body: { npi: '0000000000', opportunityId: 'op_1' } },
  // Empty body ON PURPOSE. This handler answers 404 by itself for an unknown
  // offerId, so a well-formed request cannot distinguish "route is gone" from
  // "route is live and the offer wasn't found" — the assertion would pass while
  // the endpoint was fully re-registered. An empty body hits the handler's own
  // 400 validation branch instead, so 404 can only mean "not routed". Do not
  // "fix" this by supplying an offerId.
  { method: 'post', path: '/api/verifier/offers/respond', body: {} },
  { method: 'get', path: '/api/holder/applications?npi=0000000000' },
];

describe('Wave 190 verifier-pipeline routes are not served', () => {
  it.each(FORMER_ROUTES)('$method $path is not routed', async ({ method, path, body }) => {
    const res = await (method === 'get'
      ? request(app).get(path)
      : request(app).post(path).send(body ?? {}))
      // The two headers that previously satisfied the tenant guard and selected
      // another org's scope. Sending them is the point: a 404 here means the
      // route is gone, not that a guard happened to reject this caller.
      .set('x-org-id', 'not-a-real-org')
      .set('x-verifier-org-id', 'SOME_OTHER_ORG');

    expect(res.status).toBe(404);
  });
});
