/**
 * The /api/internal/* family refuses anonymous callers — every route, discovered
 * from the SERVED app rather than a hand-maintained list.
 *
 * The defect this generalises: 20 of the 22 `/api/internal/*` GET routes gated
 * on the operator secret and two did not (`funnel-report`, `verifier-funnel`).
 * Both were org-scoped, so an anonymous caller who set `x-org-id` got 200 —
 * that org's funnel metrics. Nothing caught it because nothing asserted the
 * family as a family; each route was only ever reviewed on its own.
 *
 * So this walks the real Express router and asserts the property over whatever
 * is mounted TODAY. A new `/api/internal/*` route added without a guard fails
 * here without anyone remembering to update a list — which is the only version
 * of this test worth having.
 *
 * `MONITORING_SECRET` is set before the app is required, because `app.ts` reads
 * it at module load. Without that the guard denies everything unconditionally
 * (fail-closed) and the suite would pass trivially while proving nothing.
 */
process.env.MONITORING_SECRET = 'internal-family-test-secret';

import request from 'supertest';
import type { Express } from 'express';

// Required (not imported) so the env assignment above lands first — ES import
// bindings hoist above statements and would run app.ts with the var unset.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const app = require('../../app').default as Express;

jest.setTimeout(180_000);

type RouteLayer = {
  route?: { path: unknown; methods: Record<string, boolean> };
};

/** Every GET path under /api/internal, read off the live router stack. */
function internalGetPaths(): string[] {
  const stack = (app as unknown as { _router?: { stack: RouteLayer[] } })._router?.stack ?? [];
  const paths = new Set<string>();

  for (const layer of stack) {
    const route = layer.route;
    if (!route || !route.methods?.get) continue;
    const path = route.path;
    if (typeof path !== 'string') continue;
    if (path.toLowerCase().startsWith('/api/internal')) paths.add(path);
  }

  return [...paths].sort();
}

/** Substitute a concrete value for any :param so the request actually routes. */
function concrete(path: string): string {
  return path.replace(/:[^/]+/g, '11111111-1111-4111-8111-111111111111');
}

describe('/api/internal/* refuses anonymous callers', () => {
  it('discovers the family from the served app', () => {
    // Guards the discovery itself: if the walk silently found nothing, every
    // it.each below would vacuously pass.
    expect(internalGetPaths().length).toBeGreaterThanOrEqual(15);
  });

  it.each(internalGetPaths())('%s does not answer 200 anonymously', async (path) => {
    const res = await request(app).get(concrete(path));
    expect(res.status).not.toBe(200);
  });

  it.each(internalGetPaths())(
    '%s does not answer 200 to the x-org-id bypass',
    async (path) => {
      // The exact production request that worked on 2026-08-08.
      const res = await request(app)
        .get(concrete(path))
        .set('x-org-id', '00000000-0000-4000-8000-000000000000');
      expect(res.status).not.toBe(200);
    },
  );

  // A "never 200" assertion can pass for the wrong reason — a route that 500s
  // with no database looks identical to a route that refused. These two were
  // the actual defect, so pin the refusal itself.
  it.each([
    '/api/internal/funnel-report',
    '/api/internal/verifier-funnel',
  ])('%s refuses with 403, not an incidental error', async (path) => {
    const res = await request(app)
      .get(path)
      .set('x-org-id', '00000000-0000-4000-8000-000000000000');

    expect(res.status).toBe(403);
  });

  it('serves an operator holding the secret (the guard is a lock, not a wall)', async () => {
    const res = await request(app)
      .get('/api/internal/funnel-report')
      .set('x-monitoring-secret', 'internal-family-test-secret');

    // 200 (computed) or 500 (no seeded data under jest) — both prove the guard
    // let the caller reach the handler, which 403 would not.
    expect(res.status).not.toBe(403);
  });
});
