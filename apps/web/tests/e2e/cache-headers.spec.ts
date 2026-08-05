import { expect, test } from '@playwright/test';

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
      expect(cacheControl, `${route} missing no-store: "${cacheControl}"`).toContain('no-store');
      expect(cacheControl, `${route} carries private: "${cacheControl}"`).toContain('private');
      expect(cacheControl, `${route} still shared-cacheable: "${cacheControl}"`).not.toContain('s-maxage');
      expect(response.headers()['x-nextjs-prerender'], `${route} was prerendered`).toBeUndefined();
    });
  }
});

test('public homepage bounds shared-cache staleness', async ({ request }) => {
  /*
   * The #680 contract is a bound on STALENESS. This demanded an `s-maxage`
   * header specifically, and went red in Wave 1075 on a change that made the
   * homepage strictly fresher: `/` is force-dynamic (so the rollback variant
   * switches on redeploy rather than rebuild), which serves no-store — 0s of
   * shared staleness rather than up to 300s.
   *
   * Either is acceptable. An absent directive is not: that is the unbounded
   * case this exists to catch.
   */
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const cacheControl = (response.headers()['cache-control'] ?? '').toLowerCase();

  const sMaxAge = cacheControl.match(/s-maxage=(\d+)/);
  const staleness = /no-store/.test(cacheControl)
    ? 0
    : sMaxAge
      ? Number(sMaxAge[1])
      : Number.POSITIVE_INFINITY;

  expect(
    Number.isFinite(staleness),
    `homepage shared caching is unbounded: "${cacheControl}"`,
  ).toBe(true);
  expect(staleness, `homepage shared staleness too high: "${cacheControl}"`).toBeLessThanOrEqual(300);
});
