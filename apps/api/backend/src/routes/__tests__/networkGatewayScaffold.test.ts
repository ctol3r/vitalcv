/**
 * The unauthenticated network-gateway scaffold is not served, and the one read
 * that has real consumers still is.
 *
 * Four routes were registered with no authentication of any kind:
 * `gateway/connect` minted a gateway token for any organization named in the
 * body, and `webhooks/register` accepted an arbitrary org id and callback URL.
 * None had a caller anywhere in the repository.
 *
 * `gateway/connections` joined them later. #962 kept it served because it
 * "backs `GatewayConnections`" — a component with zero importers, mounted on no
 * page or layout, so the read had no live caller either. A component that names
 * a route is not a consumer of it; only a MOUNTED one is. That component is
 * deleted, so nothing regressed by unwiring the route it never actually called.
 *
 * This asserts the OUTCOME against the booted app — the paths are not routed —
 * rather than asserting how that was achieved, so a later, better fix (real
 * authentication instead of removal) keeps it honest instead of turning it red.
 */
import request from 'supertest';

import app from '../../app';

// The app module boots the full Express surface: route registration, trust-list
// ingestion, and detail-agent init. That is the point — it is the served app
// being interrogated, not a re-registration of one module — but it is slow.
jest.setTimeout(180_000);

/** Every route the scaffold used to serve, with the method it answered. */
const UNWIRED: Array<[('get' | 'post'), string]> = [
  ['post', '/api/network/gateway/connect'],
  ['post', '/api/network/webhooks/register'],
  ['post', '/api/network/webhooks/test'],
  ['get', '/api/network/webhooks'],
  ['get', '/api/network/gateway/connections'],
];

/**
 * Probed with each route's REAL method. A GET against a POST-only path 404s
 * whether or not the route is registered, so it would prove nothing.
 *
 * Bodies are deliberately valid-shaped: every one of these handlers had its own
 * 400 branch for a missing field, so an empty body could 404 for the wrong
 * reason on a route that is still very much registered.
 */
const BODIES: Record<string, Record<string, unknown>> = {
  '/api/network/gateway/connect': { organizationId: 'org_probe', organizationName: 'Probe', type: 'hospital' },
  '/api/network/webhooks/register': {
    organizationId: 'org_probe',
    url: 'https://probe.invalid/hook',
    events: ['credential_verified'],
  },
  '/api/network/webhooks/test': { subscriptionId: 'sub_probe' },
};

describe('the network-gateway scaffold is not served', () => {
  it.each(UNWIRED)('%s %s is not routed', async (method, path) => {
    const req = method === 'post'
      ? request(app).post(path).send(BODIES[path] ?? {})
      : request(app).get(path);
    const res = await req
      // The identity headers a caller would have used. Their presence must not
      // change the answer: these routes never authenticated at all.
      .set('x-org-id', 'org_probe')
      .set('x-clerk-user-id', 'user_probe');

    expect(res.status).toBe(404);
  });

  it('does not mint a gateway token for an arbitrary organization', async () => {
    const res = await request(app)
      .post('/api/network/gateway/connect')
      .set('x-org-id', 'org_probe')
      .send({ organizationId: 'org_victim', organizationName: 'Victim Health', type: 'hospital' });

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/token|secret/i);
  });

  it('does not register a webhook against another organization', async () => {
    const res = await request(app)
      .post('/api/network/webhooks/register')
      .set('x-org-id', 'org_probe')
      .send({
        organizationId: 'org_victim',
        url: 'https://attacker.invalid/collect',
        events: ['credential_verified', 'credential_revoked'],
      });

    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(/secret|subscription/i);
  });
});

describe('the read with a real consumer is still served', () => {
  // Reached by the served Next route handler `app/api/map/institutions/route.ts`,
  // which fetches it to build the institutions map layer. That handler is a live
  // HTTP surface of the web app, so this route has a caller regardless of which
  // pages are mounted, and removing the scaffold must not take it with them.
  //
  // NOT re-asserted here: #962 also named `GlobalTrustMap` and the ops
  // `TrustGraphConsole` as consumers. Checked 2026-08-09 — `GlobalTrustMap` has
  // zero importers, and every chain into `TrustGraphConsole` lands in
  // `app/_archive`, which is unrouted. They are not evidence for anything; the
  // route handler above is.
  //
  // The case here sets x-org-id. The tenant guard answers 401 BEFORE routing
  // when it is absent, and 401 is neither 404 nor 200 — so without the header a
  // "still routed" assertion passes whether the route exists or not, and would
  // keep passing if this cleanup deleted the wrong handler.
  it('GET /api/network/global is still routed', async () => {
    const res = await request(app)
      .get('/api/network/global')
      .set('x-org-id', 'org_probe');

    // 200 with a graph, or 500 if graph generation fails without a database.
    // Both prove it is ROUTED and past the guard, which is what this pins; 404
    // would mean the cleanup took a live surface with it.
    expect([200, 500]).toContain(res.status);
  });
});
