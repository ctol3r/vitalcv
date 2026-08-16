/**
 * `/api/employer-action` must stay off the served app.
 *
 * `routes/employer-action.ts` (wave-122) exported `employerActionRouter`, which
 * was never mounted — `app.ts` imports `./routes/employerActions` (plural), a
 * different file. The unmounted handler was UNAUTHENTICATED: it trusted a
 * caller-supplied `employerId` from the request body, created
 * `EmployerAcceptance` rows with a random UUID as `entityId`, and wrote
 * `AuditEvent` rows whose `hash` was `randomUUID()` — a fabricated integrity
 * value on a table whose whole point is non-repudiation. Its only web caller,
 * `ConsoleWrapper.tsx`, was itself unreachable (nothing imported it).
 *
 * The file was deleted 2026-08-15 along with `ConsoleWrapper.tsx`,
 * `EmployerDecisionConsole.tsx`, and `driftPropagation.ts`. Dead paths invite
 * accidental re-wiring (canonical-transaction-baseline.md, gap G4) — this test
 * exists so that mounting anything at `/api/employer-action` is a deliberate,
 * reviewed act, not a rediscovery of an old branch.
 *
 * LAYERING. The tenant turnstile (`middleware/tenantGuard.ts`) 401s requests
 * that carry no identity headers before routing ever runs, and
 * `/api/employer-action` is not on its skip list. So the probe that actually
 * reaches the router — and therefore proves no handler is mounted — is the one
 * carrying identity headers: it must 404. 404 is the only status that proves
 * absence; 401/403 would mean a handler is registered and merely
 * guard-rejected, one code change away from serving again. The anonymous probe
 * asserts only that the old handler's response shape never appears, because
 * whether the turnstile answers 401 or routing answers 404 is middleware
 * policy, not this closure.
 *
 * IF THIS TEST FAILS because you mounted a new employer-action route on
 * purpose: do not delete this file. Rewrite it to assert the new route's
 * authentication and authorization — the defect being guarded against is an
 * employer-decision write path that trusts the request body for identity.
 */
import request from 'supertest';

import app from '../../app';

/** The old handler's distinctive response fields — success or validation. */
const OLD_HANDLER_SHAPE = /acceptanceId|auditWritten|stateUpdated|nextStep|and action are required|Invalid action/i;

describe('/api/employer-action is not mounted', () => {
  const forgedBody = {
    npi: '1234567890',
    employerId: 'org_forged_regression',
    action: 'accept_head_start',
    loopId: 'loop_forged',
    notes: 'regression probe',
  };

  const forgedIdentity = {
    'x-clerk-user-id': 'user_forged_regression',
    'x-user-role': 'admin',
    'x-org-id': 'org_forged_regression',
  } as const;

  it('404s a forged-identity POST carrying the payload the old handler accepted', async () => {
    const res = await request(app)
      .post('/api/employer-action')
      .set(forgedIdentity)
      .send(forgedBody);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(OLD_HANDLER_SHAPE);
  });

  it('404s a forged-identity request_refresh POST', async () => {
    const res = await request(app)
      .post('/api/employer-action')
      .set(forgedIdentity)
      .send({ ...forgedBody, action: 'request_refresh' });
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(OLD_HANDLER_SHAPE);
  });

  it('404s every other forged-identity verb, so the path cannot be reached sideways', async () => {
    for (const verb of ['get', 'put', 'patch', 'delete'] as const) {
      const res = await request(app)[verb]('/api/employer-action').set(forgedIdentity);
      expect(res.status).toBe(404);
    }
  });

  it('404s forged-identity subpaths, so a nested mount cannot revive it quietly', async () => {
    const res = await request(app)
      .post('/api/employer-action/accept')
      .set(forgedIdentity)
      .send(forgedBody);
    expect(res.status).toBe(404);
  });

  it('never serves the old handler to an anonymous caller, whatever the middleware answers', async () => {
    const res = await request(app).post('/api/employer-action').send(forgedBody);
    expect([401, 403, 404]).toContain(res.status);
    expect(JSON.stringify(res.body)).not.toMatch(OLD_HANDLER_SHAPE);
  });
});
