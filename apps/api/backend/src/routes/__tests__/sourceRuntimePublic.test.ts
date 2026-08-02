/**
 * E0 source-runtime is reachable on the SERVED app, without an organization.
 *
 * `tenantGuard.test.ts` asserts the predicate; this asserts the wiring. Those
 * are different claims, and only this one would have caught the original
 * defect: the predicate was never consulted for this path, because the path was
 * not in the list at all.
 *
 * This boots the real app rather than grepping `app.ts`, so it keeps holding if
 * the guard is ever re-ordered or the routes are mounted through a different
 * helper. It follows `verifierPipelineNotWired.test.ts`, which pays the same
 * ~50s module-init cost for the same reason.
 *
 * WHAT "REACHABLE" MEANS HERE
 * Not 200. Under jest there is no seeded source data, so the honest answers are
 * 200 (computed) or 503 (could not compute). What must never come back is 401
 * `organization_context_required` — that status, and only that status, means the
 * tenant guard rejected an anonymous caller before the handler ever ran.
 */
import request from 'supertest';

import app from '../../app';

jest.setTimeout(180_000);

const PUBLIC_PATHS = [
  '/api/system/source-runtime',
  '/api/system/source-runtime/NPPES_API',
  '/api/system/source-runtime/OIG_LEIE',
];

describe('E0 source-runtime is served without an organization', () => {
  it.each(PUBLIC_PATHS)('%s does not answer 401 to an anonymous caller', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).not.toBe(401);
    expect(res.body?.error).not.toBe('organization_context_required');
    expect([200, 404, 503]).toContain(res.status);
  });

  it('never publishes lastArtifactId to an anonymous caller', async () => {
    // Belt and braces over the unit test: that one drives the route module in
    // isolation, this one drives whatever the app actually serves.
    const res = await request(app).get('/api/system/source-runtime');

    if (res.status === 200) {
      for (const source of res.body.sources ?? []) {
        expect(source).not.toHaveProperty('lastArtifactId');
      }
    }
    expect(JSON.stringify(res.body)).not.toContain('lastArtifactId');
  });
});

describe('the neighbouring /api/system routes stay guarded', () => {
  // The fix is two exact matches, not a `/api/system/` prefix. If someone
  // later "simplifies" it to a prefix, these go red rather than silently
  // publishing operational telemetry.
  it.each([
    '/api/system/telemetry',
    '/api/system/telemetry/pilot',
    '/api/system/trust-health',
    '/api/system/trust-health/graph',
    '/api/system/trust-health/orphans',
  ])('%s still requires an organization', async (path) => {
    const res = await request(app).get(path);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('organization_context_required');
  });
});
