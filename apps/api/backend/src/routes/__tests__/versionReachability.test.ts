/**
 * GET /api/version is reachable on the SERVED app, without an organization.
 *
 * The handler (app.ts, `registerComplianceRoutes`) is three lines and has never
 * been wrong. The route was still dead in production: `requireTenantContextOrReadAccess`
 * is mounted globally ahead of every route, and its skip-list had no entry for
 * `/api/version`, so an anonymous caller got 401 `organization_context_required`
 * before routing ever happened. `/health` answered 200 on the same host, so the
 * service looked up and the version check looked like an auth problem.
 *
 * That is the third time this exact shape has shipped — the W3C Bitstring
 * Status List, then `/api/ledger/*` (#1248 → #1260), now this. Every instance
 * had a passing handler test, because the standard route-test idiom mounts a
 * router on a bare `express()` app and is structurally blind to global
 * middleware. This file boots the real app instead, so it sees what a caller
 * sees. It follows `sourceRuntimePublic.test.ts`, which pays the same ~50s
 * module-init cost for the same reason.
 *
 * WHAT IS ASSERTED
 * The OUTCOME — an anonymous caller reaches the handler and gets the version
 * payload — not the mechanism. Nothing here names the skip-list, so the test
 * keeps holding if the guard is reimplemented, re-ordered, or the exemption is
 * expressed some other way. It goes red only if `/api/version` stops being
 * answerable by the caller it exists for.
 */
import request from 'supertest';

import app from '../../app';

// Module init (trust-list ingestion, detail-agent setup) dominates; the
// requests themselves are single-digit milliseconds.
jest.setTimeout(180_000);

describe('GET /api/version is served to an anonymous caller', () => {
  it('answers 200 with the version payload, never the guard', async () => {
    const res = await request(app).get('/api/version');

    expect(res.status).toBe(200);
    // Belt and braces: a future guard that answered 200 with a rejection body
    // would satisfy the status assertion alone.
    expect(res.body?.error).toBeUndefined();
    expect(res.body).toEqual({
      buildVersion: expect.any(String),
      commitHash: expect.any(String),
      nodeVersion: expect.any(String),
      prismaVersion: expect.any(String),
    });
  });

  it('answers the same whether or not the caller asserts an organization', async () => {
    // The failure mode this closes is "reachable, but only if you guess a
    // header". `x-org-id` is caller-supplied and unauthenticated (G1), so a
    // route that needs it is not actually public — and a deploy monitor has
    // no org to send.
    const anonymous = await request(app).get('/api/version');
    const asserted = await request(app).get('/api/version').set('x-org-id', 'probe-org');

    expect(anonymous.status).toBe(200);
    expect(asserted.body).toEqual(anonymous.body);
  });

  it('publishes nothing beyond the four build constants', async () => {
    // The exemption is only defensible because the payload has no request,
    // org or subject input. If a tenant-scoped field is ever added to
    // VERSION_INFO, this is where it gets caught — before it is served to
    // everyone on the internet.
    const res = await request(app).get('/api/version');

    expect(Object.keys(res.body).sort()).toEqual([
      'buildVersion',
      'commitHash',
      'nodeVersion',
      'prismaVersion',
    ]);
  });
});

describe('the exemption does not leak past /api/version', () => {
  // The entry is an exact match, not a `/api/version` prefix. If someone
  // later "simplifies" it, this goes red rather than silently exempting a
  // route nobody reviewed.
  it.each([
    '/api/versions',
    '/api/version/history',
  ])('%s still requires an organization', async (path) => {
    const res = await request(app).get(path);

    // 404 would also mean "not exempted", but it would pass for a route that
    // does not exist — which is not the claim. These paths are unrouted, so
    // the guard is what answers, and 401 proves the guard still runs here.
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('organization_context_required');
  });

  // `registerComplianceRoutes` mounts three routes; only one was exempted.
  // The other two are NOT reporting facts about the running process — they
  // serve hardcoded `true` claims (COMPLIANCE_SUMMARY.ncqaAlignment,
  // SECURITY_POSTURE.internalRouteProtection, app.ts:490-503) that nothing
  // measures. Publishing self-graded compliance and security assertions to
  // anonymous callers is a different decision from publishing a commit SHA,
  // and it has not been made. scripts/verifyProduction.ts expects 200 from
  // both against the API base and is wired into no workflow, so if someone
  // reaches for the skip-list to make that script pass, this is the tripwire.
  it.each([
    '/api/compliance/summary',
    '/api/security/posture',
  ])('%s was NOT exempted alongside it', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('organization_context_required');
  });
});
