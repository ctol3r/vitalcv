/**
 * `/api/candidates` must stay off the served app.
 *
 * The handler returned clinician records to any caller. It performed no
 * identity check at all — every sibling route in `routes/opportunities.ts`
 * calls `requireClerkUserId` first, and this one did not — so the API origin
 * answered anonymous requests directly. The Next.js proxy in front of it did
 * require a session, which is precisely why the gap was invisible from inside
 * the app: the proxy was the only enforcement, and a proxy can be bypassed by
 * addressing the API host.
 *
 * This is the second instance of the same defect class in this codebase. The
 * Wave 190 verifier-pipeline routes had it too (see
 * `verifierPipelineNotWired.test.ts`), and one of them was also a candidate
 * listing. A guard that lives only in front of the origin is not a guard.
 *
 * WHY THIS ASSERTS 404 AND NOT 401
 * 401 would mean the route is still registered and merely guard-rejected —
 * one code change away from serving again, which is the state this removal
 * exists to leave behind. 404 is the only status that proves the handler is
 * not mounted. Each request below deliberately carries the headers that a
 * caller would forge, so a pass means "no such route", not "the guard held".
 *
 * WHY THE ROUTE WAS DELETED RATHER THAN AUTHORIZED
 * Its only consumer was an archived page. Rebuilding an authorized candidate
 * listing would restore attack surface that no shipping surface asks for. If a
 * candidate-list API is ever genuinely needed, it needs its own security and
 * product review — and this test is supposed to fail then. Rewrite it to
 * assert the new authorization; do not simply delete it.
 *
 * `requireClerkUserId` is also why "just add the guard" was not the fix: it
 * only asserts that an UNSIGNED `x-clerk-user-id` header is present, so adding
 * it would have converted an anonymous read into a forged-header read.
 */
import request from 'supertest';

import app from '../../app';

describe('/api/candidates is not mounted', () => {
  const paths = ['/api/candidates', '/api/candidates?limit=100', '/api/candidates?specialty=207Q00000X&state=CA'];

  for (const path of paths) {
    it(`404s an anonymous GET ${path}`, async () => {
      const res = await request(app).get(path);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(/npi|firstName|lastName|userId/i);
    });

    it(`404s a forged-identity GET ${path}`, async () => {
      const res = await request(app)
        .get(path)
        .set('x-clerk-user-id', 'user_forged_regression')
        .set('x-user-role', 'admin')
        .set('x-org-id', 'org_forged_regression');
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(/npi|firstName|lastName|userId/i);
    });
  }

  it('404s every other verb, so the path cannot be reached sideways', async () => {
    for (const verb of ['post', 'put', 'patch', 'delete'] as const) {
      const res = await request(app)[verb]('/api/candidates');
      expect(res.status).toBe(404);
    }
  });
});
