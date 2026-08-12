/**
 * `POST /api/omega/:npi` must not be served.
 *
 * The handler took `employerId` and `orgId` **from the request body** and, via
 * `OmegaOrchestrator.evaluateAction`, wrote two decision-grade rows:
 * an `EmployerAcceptance` and — when the activation graph allowed it — a
 * `StartActivation`. So a caller chose the organization on whose behalf an
 * acceptance and a start were recorded.
 *
 * The only guard in front of it was the global
 * `requireTenantContextOrReadAccess`, whose org binding is staged
 * (`off` | `shadow` | `enforce`) and defaults to **off** — a no-op. Even in
 * `shadow` it never blocks. And the org context it reads is itself
 * caller-supplied (`x-org-id` / `?organizationId=`), which is the same
 * one-header bypass recorded in `verifierPipelineNotWired.test.ts`.
 *
 * The entity the acceptance was attached to was resolved by
 * `displayName: { contains: orgId }` with an **all-zero UUID fallback**, so a
 * row could also land against the wrong entity or a placeholder one.
 *
 * The route had no callers. The only reference to `/api/omega` anywhere in the
 * web, marketing or mobile apps is an archived page
 * (`apps/web/app/_archive/wave119/p/[slug]/page.tsx`) calling the **GET**.
 *
 * VCD-00 recorded acceptance as having five wired emitters across three models.
 * This retires one of them; the read-only `GET /api/omega/:npi` is untouched.
 *
 * WHY THIS ASSERTS 404 AND NOT 400/401
 * The former handler validated its own body and answered 400 for a bad NPI or
 * missing fields. If this asserted anything but 404, it would pass while the
 * route was fully re-registered and merely rejecting this particular request.
 * 404 is the only status that proves the handler is not mounted. The request
 * below deliberately carries a well-formed NPI, a complete body, and the
 * headers that used to satisfy the tenant guard — so a pass means "no such
 * route", not "guard held" and not "validation rejected me".
 *
 * If a real, authorized omega decision path is ever built, this test is
 * supposed to fail. Give the new route server-derived org context from verified
 * membership, then rewrite this to assert that — do not simply delete it.
 */
import request from 'supertest';

import app from '../../app';

// The app's module init (trust-list ingestion, detail-agent setup) dominates;
// the requests themselves are single-digit milliseconds.
jest.setTimeout(180_000);

describe('POST /api/omega/:npi is not served', () => {
  it('is not routed, even with a well-formed body and the bypass headers', async () => {
    const res = await request(app)
      .post('/api/omega/1234567893')
      .send({
        employerId: 'employer-of-my-choosing',
        orgId: 'org-of-my-choosing',
        role: 'reviewer',
        action: 'accept',
        comment: 'should never reach a handler',
      })
      .set('x-org-id', 'not-a-real-org')
      .set('x-verifier-org-id', 'SOME_OTHER_ORG');

    expect(res.status).toBe(404);
  });

  it('still serves the read-only GET', async () => {
    const res = await request(app)
      .get('/api/omega/1234567893')
      .set('x-org-id', 'not-a-real-org');

    // Any status but 404 proves the GET is still mounted. It may legitimately
    // answer 200 or 500 depending on what the read path finds; this test is
    // about routing, not about that result.
    expect(res.status).not.toBe(404);
  });
});
