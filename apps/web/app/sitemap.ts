import type { MetadataRoute } from 'next';

import { isCanonicalProductionProcess } from '@/lib/deployment/canonicalProduction';

/**
 * `lastModified` is a claim about a specific page, so each entry carries its
 * own real date — the commit date of the route's own source, read from git.
 *
 * Two wrong answers preceded this one. The original stamped `new Date()` on
 * every entry, relabeling the whole site "modified today" on every crawl. The
 * fix for that swapped in one shared `RELEASE` constant, which is still a
 * fabrication in both directions: on 2026-08-02 it claimed `/for/cvo` (last
 * touched 2026-05-05) had changed on 2026-07-15, and claimed `/` and
 * `/employers` (both changed 2026-08-01) had *not* changed since 2026-07-15.
 * A single date cannot be true of thirteen pages that change independently.
 *
 * Dates below are `git log -1 --format=%cs` for each route's source directory,
 * and `__tests__/sitemap-freshness.test.ts` recomputes them from git and fails
 * on drift — so a route edited without updating its stamp is caught here
 * rather than shipped as a false freshness signal.
 *
 * THE RULE when you change a route: set its stamp to **today's UTC date**, in
 * the same commit. Not the date git currently reports — that is the *previous*
 * commit, and your commit is about to replace it. (Getting this backwards is
 * what the drift test catches; it caught it on the commit that introduced it.)
 *
 * Only real, public, polished routes are listed. Absent on purpose: routes
 * that 404 (/explore, /developers, /compliance, /updates, /about), the
 * robots-disallowed /review, and any named health-system page implying a
 * partnership.
 */
interface SitemapRoute {
  /** Path under https://vitalcv.com — '' is the homepage. */
  path: string;
  /** Route source, relative to apps/web — what the freshness test reads from git. */
  source: string;
  /** Commit date (YYYY-MM-DD, UTC) of that source's last change. */
  lastModified: string;
  changeFrequency: 'daily' | 'weekly' | 'monthly';
  priority: number;
}

export const SITEMAP_ROUTES: readonly SitemapRoute[] = [
  { path: '', source: 'app/page.tsx', lastModified: '2026-08-08', changeFrequency: 'weekly', priority: 1 },
  { path: '/onboarding', source: 'app/onboarding', lastModified: '2026-08-08', changeFrequency: 'weekly', priority: 0.9 },
  { path: '/employers', source: 'app/employers', lastModified: '2026-08-08', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/employers/how-it-works', source: 'app/employers/how-it-works', lastModified: '2026-08-07', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/employers/request-access', source: 'app/employers/request-access', lastModified: '2026-08-07', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/solutions', source: 'app/solutions', lastModified: '2026-07-15', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/pilot', source: 'app/pilot', lastModified: '2026-07-30', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/trust', source: 'app/trust', lastModified: '2026-08-08', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/pricing', source: 'app/pricing', lastModified: '2026-07-16', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/contact', source: 'app/contact', lastModified: '2026-07-16', changeFrequency: 'monthly', priority: 0.6 },
  { path: '/for/cvo', source: 'app/for/cvo', lastModified: '2026-05-06', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/for/payer', source: 'app/for/payer', lastModified: '2026-05-06', changeFrequency: 'monthly', priority: 0.5 },
  {
    path: '/for/staffing-exchange',
    source: 'app/for/staffing-exchange',
    lastModified: '2026-05-06',
    changeFrequency: 'monthly',
    priority: 0.5,
  },
  { path: '/status', source: 'app/status', lastModified: '2026-07-30', changeFrequency: 'daily', priority: 0.4 },
];

/**
 * Evaluated per REQUEST — see the note on `app/robots.ts`. Statically
 * generating this would bake the build machine's environment into production's
 * sitemap, emptying it.
 */
export const dynamic = 'force-dynamic';

export default function sitemap(): MetadataRoute.Sitemap {
  // Only canonical production advertises the site. A review deployment already
  // sends `Disallow: /` and `X-Robots-Tag: noindex`, so serving the full route
  // inventory here would contradict both. `SITEMAP_ROUTES` stays exported
  // unchanged, so the freshness guard still measures every entry.
  if (!isCanonicalProductionProcess()) return [];

  return SITEMAP_ROUTES.map((route) => ({
    url: `https://vitalcv.com${route.path}`,
    // Midnight UTC of the commit day. A commit-time-of-day would imply a
    // precision the daily stamp does not have.
    lastModified: new Date(`${route.lastModified}T00:00:00Z`),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
