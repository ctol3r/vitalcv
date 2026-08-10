import { expect, test } from '@playwright/test';

import { classifyCachePolicy } from '../../../../scripts/lib/cachePolicy.mjs';

/**
 * Wave 0.2 — live cache-header contract, asserted against a production build
 * (`next start`), which is what Railway serves.
 *
 * Session-dependent routes must be private and non-storable: no shared cache
 * may ever hold one user's session-dependent output. Public marketing pages
 * keep BOUNDED shared caching (the #680 freshness work) — this suite pins
 * both directions so neither regresses into the other.
 */

const SESSION_ROUTES = [
  '/onboarding',
  '/sign-in',
  '/sign-up',
  '/auth/error',
  '/holder/home',
  // Owner-scoped: renders the NPI linked to THIS account and that clinician's
  // CMS filing. Sat outside SESSION_PATH_PREFIXES until the RD-2 guard fix, so the
  // anonymous response carried no Cache-Control at all.
  '/clinician/profile',
  '/employer/dashboard',
  '/review',
] as const;

test.describe('session routes are never shared-cacheable', () => {
  for (const route of SESSION_ROUTES) {
    test(`${route} responds private + no-store, with no s-maxage`, async ({ request }) => {
      const response = await request.get(route, { maxRedirects: 0 });
      // Redirects (signed-out gating) are valid responses — their headers
      // must be uncacheable too, so a shared cache can't pin the redirect.
      expect([200, 307, 308]).toContain(response.status());
      const cacheControl = (response.headers()['cache-control'] ?? '').toLowerCase();
      // Personalized: no shared lifetime is acceptable, however short.
      const policy = classifyCachePolicy(cacheControl, { personalized: true });
      expect(policy.ok, `${route} cache policy: ${policy.reason}`).toBe(true);
      expect(cacheControl, `${route} carries private: "${cacheControl}"`).toContain('private');
      expect(response.headers()['x-nextjs-prerender'], `${route} was prerendered`).toBeUndefined();
    });
  }
});

test('public homepage bounds shared-cache staleness', async ({ request }) => {
  /*
   * The #680 contract is a bound on STALENESS, satisfied by either a bounded
   * shared lifetime or no-store. Interpreted by scripts/lib/cachePolicy.mjs —
   * the same module the deploy smoke test and the vitest contract use, so
   * "fresh enough" has exactly one definition. Three private copies of this
   * rule is what made a strictly-fresher homepage read as a regression and
   * turned `vitalcv/web-deploy-converged` red on a converged deployment.
   */
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const policy = classifyCachePolicy(response.headers()['cache-control']);
  expect(policy.ok, `homepage cache policy: ${policy.reason}`).toBe(true);
});
