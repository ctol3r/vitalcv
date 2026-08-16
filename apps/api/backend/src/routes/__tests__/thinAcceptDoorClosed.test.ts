/**
 * `POST /api/hiring/accept` must not be served.
 *
 * It recorded an `EmployerAcceptance` carrying employerId, clinicianNpi,
 * artifactId, status and acceptedAt — and nothing else. No entityId, no
 * organization, no applicationId, no packetHash, no source snapshot. An
 * acceptance with no record of what was accepted.
 *
 * The live employer accept does not use it. `/review/[entityId]` and
 * `/verify/[npi]` go through `POST /api/employer-review/:entityId/accept`,
 * which records all of the above plus a frozen snapshot of the source coverage
 * the reviewer saw at that moment. The only caller of the thin route was
 * `components/employer/StartClinicianAction.tsx`, rendered exclusively from
 * `app/_archive/verifier/inbox/page.tsx` — an underscore-prefixed folder Next
 * excludes from routing, so nothing reachable ever called it.
 *
 * Its `employerId` also came from the request body behind `apiKeyAuth`, so any
 * holder of the shared key could record an acceptance naming any employer. The
 * web proxy in front of it derived `employerId` from the authenticated org
 * context, but the backend route never required that.
 *
 * Founder ruling 2026-08-11: close it. An unused door that writes decision
 * records is a liability, and reopening it deliberately later is cheap.
 *
 * ON THE AUDIT EVENT
 * This route was the only emitter of `EMPLOYER_ACCEPTANCE_CREATED`. Nothing
 * read that type. The live path emits `EMPLOYER_REVIEW_ACCEPTED` instead —
 * which `auditService.ts` misdescribed, claiming both paths emitted the former.
 * That comment is corrected in this change; the correction is of a statement
 * that was already false, not a consequence of closing the route.
 *
 * WHY 404 AND NOT 401/400
 * The former handler answered 401 without an API key and 400 for a malformed
 * body. Asserting either would pass while the route was fully registered and
 * merely rejecting one request. 404 is the only status that proves the handler
 * is not mounted, so the request below carries a well-formed body.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import request from 'supertest';

import app from '../../app';

// The app's module init dominates; the requests themselves are milliseconds.
jest.setTimeout(180_000);

describe('the thin acceptance door is closed', () => {
  it('POST /api/hiring/accept is not routed', async () => {
    const res = await request(app)
      .post('/api/hiring/accept')
      .send({
        employerId: 'employer-of-my-choosing',
        clinicianNpi: '1234567893',
        artifactId: null,
      })
      .set('x-org-id', 'not-a-real-org');

    expect(res.status).toBe(404);
  });

  it('answers with and without an api key identically', async () => {
    // The former handler distinguished these: 401 without a key, 4xx/2xx with
    // one. Identical answers prove no handler is left to care.
    //
    // BOTH requests must carry x-org-id. The global
    // `requireTenantContextOrReadAccess` answers 401 *before routing* when it is
    // absent, so a bare probe returns 401 whether or not the route exists — it
    // would assert nothing. This bit on the first run of this test.
    const unkeyed = await request(app)
      .post('/api/hiring/accept')
      .set('x-org-id', 'not-a-real-org')
      .send({ employerId: 'e', clinicianNpi: '1234567893' });
    const keyed = await request(app)
      .post('/api/hiring/accept')
      .set('x-org-id', 'not-a-real-org')
      .set('x-api-key', 'any-key-at-all')
      .send({ employerId: 'e', clinicianNpi: '1234567893' });

    expect(unkeyed.status).toBe(404);
    expect(keyed.status).toBe(404);
  });

  it('no longer writes an acceptance from the hiring route', () => {
    // Source-level, because the behavioural case above cannot distinguish
    // "route gone" from "route present but the write removed", and the write is
    // the thing that mattered.
    const code = readFileSync(join(__dirname, '..', 'hiring.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/employerAcceptance\s*\.\s*create/);
    expect(code).not.toMatch(/EMPLOYER_ACCEPTANCE_CREATED/);
  });

  it('leaves the start route as an adapter to the canonical application command', () => {
    // Closing the accept door is not authorisation to close the start one —
    // that is a separate decision. If this fails, the change overreached.
    const code = readFileSync(join(__dirname, '..', 'hiring.ts'), 'utf8');
    expect(code).toMatch(/'\/api\/hiring\/start'/);
    expect(code).toMatch(/confirmStartByAcceptance\s*\(/);
  });
});
