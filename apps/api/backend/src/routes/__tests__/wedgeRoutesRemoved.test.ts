/**
 * The wedge lane must stay off the served app (ADR 0007 — retirement executed).
 *
 * `routes/wedge.ts` carried the machine-keyed parallel lane: POST
 * /recognitions, /acceptances and /starts wrote the parallel
 * Recognition/Acceptance/Start models behind apiKeyAuth, and GET
 * /status/:subject_id and GET /trust-state read them back. It had ZERO live
 * callers — only `apps/web/app/_archive/*` pages (excluded from routing) and
 * its own tests — and ADR 0007 point 6 scheduled its retirement, executed
 * under the founder's confirmation. The root `/trust-state/:clinician_id`
 * alias in app.ts was a URL-rewriting shim whose only terminal handler was the
 * wedge's GET /trust-state, so it retired with it. The parallel Prisma models
 * remain (removing them is a founder-tier schema migration, deferred); the
 * canonical lane is EmployerAcceptance/StartAttestation via
 * `applicationStartCommandService`.
 *
 * Dead paths invite accidental re-wiring — this test exists so that mounting
 * anything at these paths is a deliberate, reviewed act, not a rediscovery of
 * the retired lane.
 *
 * LAYERING. The tenant turnstile 401s requests with no org context before
 * routing runs, and these paths are no longer on its skip list (their skip
 * entries were removed with the routes — a skip for a dead path is the
 * re-wiring hazard class). So the probe that actually reaches the router — and
 * therefore proves no handler is mounted — is the one carrying org + identity
 * headers: it must 404. 404 is the only status that proves absence; 401/403
 * would mean a handler is registered and merely guard-rejected. The anonymous
 * probes assert only that the old handlers' response shapes never appear,
 * because whether the turnstile answers 401 or routing answers 404 is
 * middleware policy, not this closure.
 *
 * IF THIS TEST FAILS because you mounted a new route at one of these paths on
 * purpose: do not delete this file. Rewrite it to assert the new route's
 * authentication and authorization, and record the writer in ADR 0007's
 * allowlists if it creates acceptance or start rows.
 */
import request from 'supertest';

import app from '../../app';

/** Distinctive response fields of the old wedge handlers — success or domain error. */
const OLD_HANDLER_SHAPE =
  /recognitionId|acceptanceId|startId|eventReplayHash|blocking_reasons|timeline_preview|Unable to record|RecognitionEvent not found|EmployerAcceptance not found/i;

const forgedIdentity = {
  'x-api-key': 'forged-machine-key',
  'x-clerk-user-id': 'user_forged_regression',
  'x-org-id': 'org_forged_regression',
} as const;

describe('the wedge routes are not mounted', () => {
  it.each([
    ['/recognitions', { recognition: { subjectId: 'did:x', employerId: 'did:y' } }],
    ['/acceptances', { acceptance: { recognitionId: 'rec-1' } }],
    ['/starts', { start: { acceptanceId: 'acc-1' } }],
  ] as const)(
    'POST %s 404s a forged-identity request carrying the payload the old handler accepted',
    async (path, body) => {
      const res = await request(app).post(path).set(forgedIdentity).send(body);
      expect(res.status).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(OLD_HANDLER_SHAPE);
    },
  );

  it.each([
    ['/recognitions/rec-001'],
    ['/status/did:example:practitioner'],
    ['/trust-state?clinician_id=did:example:practitioner'],
    // The app.ts alias that rewrote into the wedge's GET /trust-state handler.
    ['/trust-state/did:example:practitioner'],
  ] as const)('GET %s 404s a forged-identity request', async (path) => {
    const res = await request(app).get(path).set(forgedIdentity);
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toMatch(OLD_HANDLER_SHAPE);
  });

  it('never serves an old handler to an anonymous caller, whatever the middleware answers', async () => {
    for (const [method, path] of [
      ['post', '/recognitions'],
      ['post', '/acceptances'],
      ['post', '/starts'],
      ['get', '/trust-state?clinician_id=did:example:practitioner'],
    ] as const) {
      const res = method === 'post'
        ? await request(app).post(path).send({})
        : await request(app).get(path);
      expect([401, 403, 404]).toContain(res.status);
      expect(JSON.stringify(res.body)).not.toMatch(OLD_HANDLER_SHAPE);
    }
  });
});
