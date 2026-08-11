/**
 * `POST /api/pilot/acceptance` must not be served, and no metric may present
 * its rows as acceptances.
 *
 * The endpoint sat behind `walletRateLimit` and nothing else — no
 * authentication, no org binding — and wrote a `VerifierAcceptance` row from a
 * caller-supplied `organization` string. The model has three columns (`id`,
 * `organization`, `acceptedAt`): no clinician, no packet, no employer identity,
 * no link to anything. It could not represent a head-start acceptance because
 * it recorded nothing to accept.
 *
 * It was nonetheless counted. `prisma.verifierAcceptance.count()` ran inside
 * `loadYcMetrics`'s `Promise.all` **without** the `organizationFilter` that
 * every sibling query in that same call applies, so it was a global figure
 * shown identically to every organization, surfaced at `GET /api/metrics/yc`
 * and `GET /api/pilot/report` as `verifierAcceptances`.
 *
 * So the number that reads as "employers accepted" was unauthenticated,
 * unscoped, and unlinked to any packet — inflatable to any value with a loop of
 * curl requests. VCD-00 counted it as one of five acceptance emitters; it was
 * never one.
 *
 * Nothing in production wrote it (only this suite's predecessor) and nothing
 * live read the field — the only readers were `apps/web/app/_archive/wave119/`
 * pages, which Next excludes from routing as private folders. The marketing
 * app's own `/api/pilot/report` is an unrelated implementation that never
 * touched this table.
 *
 * The `VerifierAcceptance` model is deliberately left in place. Dropping it is
 * a destructive migration and a separate, explicitly authorised decision;
 * unwiring the writer and the metric is what stops the overstatement.
 *
 * WHY 404 AND NOT 400/401
 * The former handler answered 400 for a missing `organization`. Asserting
 * anything but 404 would pass while the route was fully registered and merely
 * rejecting one shape of request.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import request from 'supertest';

import app from '../../app';

// The app's module init dominates; the requests themselves are milliseconds.
jest.setTimeout(180_000);

describe('the unauthenticated acceptance counter is retired', () => {
  it('POST /api/pilot/acceptance is not routed', async () => {
    const res = await request(app)
      .post('/api/pilot/acceptance')
      .send({ organization: 'Any Organization I Care To Name' });

    expect(res.status).toBe(404);
  });

  it('answers a well-formed request identically — no handler is left to validate it', async () => {
    // The former handler distinguished these two: 201 for the first, 400 for
    // the second. Identical answers prove nothing is parsing the body.
    const named = await request(app).post('/api/pilot/acceptance').send({ organization: 'X' });
    const empty = await request(app).post('/api/pilot/acceptance').send({});

    expect(named.status).toBe(404);
    expect(empty.status).toBe(404);
  });

  it.each([['/api/metrics/yc'], ['/api/pilot/report']])(
    '%s presents no acceptance count',
    async (path) => {
      const res = await request(app).get(path).set('x-org-id', 'any-org');

      // The endpoint may legitimately fail without a database; what must never
      // happen is a 200 that still carries the field. This case is therefore
      // vacuous without Postgres — the source assertion below is what holds
      // the line in every environment.
      if (res.status === 200) {
        expect(res.body).not.toHaveProperty('verifierAcceptances');
      }
    },
  );

  it('no longer counts the table into any metrics payload', () => {
    // A behavioural assertion needs a live database to mean anything, and
    // passes vacuously without one — the exact condition under which this
    // regression would return unnoticed. So assert the coupling is absent at
    // the source, with comments stripped so the explanation above does not
    // satisfy its own test.
    const code = readFileSync(join(__dirname, '..', '..', 'app.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

    expect(code).not.toMatch(/verifierAcceptance\s*\.\s*count/);
    expect(code).not.toMatch(/verifierAcceptances/);
  });
});
