/**
 * Wave 0.2 — session routes must never be shared-cacheable.
 *
 * Production 18c9311 served /onboarding and /employer/dashboard as prerendered
 * pages with `s-maxage=31536000`: a year-long SHARED cache of session-dependent
 * output. Two layers prevent recurrence — segment config (`force-dynamic` on
 * each tree's layout) and a middleware belt stamping `private, no-store`.
 * This suite pins both at the source level; tests/e2e/cache-headers.spec.ts
 * asserts the live response headers on a production build.
 */

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const SESSION_TREES = [
  'onboarding',
  'sign-in',
  'sign-up',
  'auth',
  'holder',
  'clinician',
  'employer',
  'review',
] as const;

const layoutPath = (tree: string) =>
  new URL(`../app/${tree}/layout.tsx`, import.meta.url).pathname;

describe('session trees force dynamic rendering', () => {
  for (const tree of SESSION_TREES) {
    it(`/${tree} layout exports dynamic = 'force-dynamic'`, () => {
      const source = readFileSync(layoutPath(tree), 'utf8');
      expect(source).toMatch(/export const dynamic = 'force-dynamic'/);
    });
  }
});

describe('middleware no-store belt', () => {
  const middleware = readFileSync(new URL('../middleware.ts', import.meta.url).pathname, 'utf8');

  it('covers every session prefix, including /apply for when Wave 5 builds it', () => {
    for (const prefix of [...SESSION_TREES, 'apply']) {
      expect(middleware, `middleware must list /${prefix}`).toContain(`'/${prefix}'`);
    }
  });

  it('stamps private, no-store on session responses', () => {
    expect(middleware).toContain("headers.set('Cache-Control', 'private, no-store')");
  });
});
