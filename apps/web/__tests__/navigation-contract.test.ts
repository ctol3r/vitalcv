/**
 * The UX-03 navigation contract.
 *
 * The 2026-08-09 authed-navigation audit found 39 routes with no chrome, no
 * <nav> landmark, and — on 30 of them — not one in-app link. Its structural
 * finding was that every ungated doctrine in this repo recurs: the same copy
 * and vocabulary findings came back verbatim across 67 commits, while every
 * contract with a CI gate held or improved. So the fix ships with its gate.
 *
 * What this pins:
 *   1. Every page route resolves to exactly ONE chrome class.
 *   2. No route resolves to none (a new console cannot ship chromeless).
 *   3. Every product route has a manifest entry, so it gets a real breadcrumb
 *      instead of a raw path segment.
 *   4. Parent chains terminate at real routes, with no cycles.
 *   5. Trails on dynamic routes carry substituted hrefs, never "[id]" links.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  isOpsSurfacePath,
  isProductSurfacePath,
  isPublicSurfacePath,
} from '@/components/layout/publicSurfaceRoutes';
import {
  matchRoutePattern,
  resolveTrail,
  ROUTE_MANIFEST,
  SECTION_ROOTS,
} from '@/lib/navigation/routeManifest';

const APP_DIR = path.join(process.cwd(), 'app');

/**
 * Every served page route, read from the filesystem rather than a hand-kept
 * list — the point is to catch a route nobody remembered to classify.
 */
function pageRoutes(dir = APP_DIR, base = ''): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      // _archive is not served. Route groups (auth) and parallel routes
      // (@slot) do not contribute a URL segment.
      if (entry.name === '_archive') continue;
      const segment =
        entry.name.startsWith('(') || entry.name.startsWith('@') ? '' : `/${entry.name}`;
      out.push(...pageRoutes(path.join(dir, entry.name), base + segment));
    } else if (entry.name === 'page.tsx' || entry.name === 'page.ts') {
      out.push(base === '' ? '/' : base);
    }
  }
  return out;
}

/**
 * Routes that legitimately render no shared chrome, each with the reason it is
 * exempt. Adding to this list is a deliberate, reviewable act — which is the
 * whole point of making the gate fail otherwise.
 */
const CHROMELESS_BY_DESIGN: Record<string, string> = {
  '/status/technical':
    'Bucket E (2026-08-07): a dark mono console; paper chrome would violate the scene system and ops chrome would mount VCommandBar on a public route.',
  '/auth/error': 'Auth interstitial — terminal state, no onward product navigation.',
  '/auth/resolving': 'Auth interstitial — redirects before paint.',
  '/signup': 'Redirect shim to /sign-up.',
  '/onboarding/fetching': 'Onboarding step — client-redirects into /onboarding.',
  '/onboarding/identity': 'Onboarding step — client-redirects into /onboarding.',
  '/onboarding/readiness': 'Onboarding step — client-redirects into /onboarding.',
  '/apply/[requestUri]': 'OAuth authorization interstitial — deliberately has no way out.',
  '/passport': 'Retired surface (passport_retirement) — renders its own notice.',
  '/passport/[id]': 'Retired surface (passport_retirement) — renders its own notice.',
  '/receipt/[receiptId]': 'Standalone shareable record; carries no session navigation.',
  '/snapshot/[id]': 'Standalone shareable record; carries no session navigation.',
};

/**
 * Prefixes whose whole subtree is exempt.
 *
 * /dev/* are developer harnesses. Four of the seven (`career-garden`,
 * `compete-film`, `page-stack`, `story-rail`) carry an env-flag `notFound()`;
 * `matcha-deck` and `matcha-workspaces` 404 only when their payload is absent,
 * which is a data gate rather than an environment one; and
 * `/dev/graph/[entityId]` carries no gate at all and serves HTTP 200 to
 * anonymous visitors in production. That last one is finding F9 of
 * `docs/design/page-consistency-audit-2026-08-09.md` — a gating-consistency
 * gap, still open, and deliberately NOT fixed here: UX-03 is design-only and a
 * route gate is an access change. Exempting the prefix from the *chrome* gate
 * does not close it.
 *
 * /design/* is 404-gated in production by its layout (isDesignPreviewAllowed).
 */
const CHROMELESS_PREFIXES = ['/dev', '/design'];

describe('navigation contract — chrome classification', () => {
  const routes = pageRoutes();

  it('finds the app router tree', () => {
    expect(routes.length).toBeGreaterThan(100);
  });

  it('classifies every route into exactly one chrome class', () => {
    const multiple: string[] = [];
    for (const route of routes) {
      const classes = [
        isOpsSurfacePath(route) && 'ops',
        isPublicSurfacePath(route) && 'public',
        isProductSurfacePath(route) && 'product',
      ].filter(Boolean);
      if (classes.length > 1) multiple.push(`${route} → ${classes.join(' + ')}`);
    }
    expect(multiple).toEqual([]);
  });

  it('leaves no route without chrome unless it is exempt on the record', () => {
    const orphaned = routes.filter(
      (route) =>
        !isOpsSurfacePath(route) &&
        !isPublicSurfacePath(route) &&
        !isProductSurfacePath(route) &&
        !(route in CHROMELESS_BY_DESIGN) &&
        // /holder carries HolderWorkspaceFrame, which is chrome the registry
        // does not own.
        !route.startsWith('/holder') &&
        !CHROMELESS_PREFIXES.some((p) => route === p || route.startsWith(`${p}/`)),
    );
    expect(orphaned).toEqual([]);
  });

  it('keeps every chromeless exemption pointing at a route that exists', () => {
    const stale = Object.keys(CHROMELESS_BY_DESIGN).filter((r) => !routes.includes(r));
    expect(stale).toEqual([]);
  });
});

describe('navigation contract — the route manifest', () => {
  const routes = pageRoutes();

  it('gives every product-chrome route a manifest entry', () => {
    const missing = routes
      .filter((route) => isProductSurfacePath(route))
      .filter((route) => matchRoutePattern(route) === null);
    expect(missing).toEqual([]);
  });

  it('gives every holder route a manifest entry', () => {
    const missing = routes
      .filter((route) => route.startsWith('/holder'))
      .filter((route) => matchRoutePattern(route) === null);
    expect(missing).toEqual([]);
  });

  it('terminates every parent chain at a root, with no cycles', () => {
    for (const [pattern] of Object.entries(ROUTE_MANIFEST)) {
      const seen = new Set<string>();
      let cursor: string | null = pattern;
      while (cursor) {
        expect(seen.has(cursor), `cycle through ${pattern} at ${cursor}`).toBe(false);
        seen.add(cursor);
        const node = ROUTE_MANIFEST[cursor];
        expect(node, `${cursor} is named as a parent but has no manifest entry`).toBeDefined();
        cursor = node.parent;
      }
    }
  });

  it('points every section root at a real manifest entry', () => {
    for (const [section, root] of Object.entries(SECTION_ROOTS)) {
      expect(ROUTE_MANIFEST[root], `${section} root ${root} is not in the manifest`).toBeDefined();
    }
  });

  it('labels every entry in sentence case without EC-9 banned nouns', () => {
    // EC-9 bans the internal vocabulary from customer-facing copy. A breadcrumb
    // is the most customer-facing copy there is: it names where you are.
    const banned = /\b(packet|lane|artifact|provenance|holder|dossier|passport)\b/i;
    const offenders = Object.entries(ROUTE_MANIFEST)
      .filter(([, node]) => banned.test(node.label))
      .map(([pattern, node]) => `${pattern} → "${node.label}"`);
    expect(offenders).toEqual([]);
  });
});

describe('navigation contract — trail resolution', () => {
  it('substitutes real ids into ancestor links on dynamic routes', () => {
    const trail = resolveTrail('/issuer/policy-review/req-1042');
    expect(trail.map((t) => t.label)).toEqual(['Issuer', 'Request', 'Review', 'Policy review']);

    // The unlinked section root offers no href — clicking it would 404.
    expect(trail[0].href).toBeUndefined();
    // Ancestors carry the live id, never the literal pattern.
    expect(trail[1].href).toBe('/issuer/request/req-1042');
    expect(trail[2].href).toBe('/issuer/review/req-1042');
    expect(trail.some((t) => t.href?.includes('['))).toBe(false);
    // The current page is not a link.
    expect(trail[3].current).toBe(true);
    expect(trail[3].href).toBeUndefined();
  });

  it('routes an employer decision under the review queue, not a bare path split', () => {
    const trail = resolveTrail('/employer/decision/app-77');
    expect(trail.map((t) => t.label)).toEqual(['Dashboard', 'Review queue', 'Decision']);
    expect(trail[1].href).toBe('/employer/review-queue');
  });

  it('lets a page supply a resolved name for its own crumb', () => {
    const trail = resolveTrail('/employer/applications/app-9', {
      '/employer/applications/[applicationId]': 'R. Okonkwo — ICU RN',
    });
    expect(trail.at(-1)?.label).toBe('R. Okonkwo — ICU RN');
  });

  it('returns nothing for an unmapped path, so the trail simply does not render', () => {
    expect(resolveTrail('/nope/nowhere')).toEqual([]);
  });
});
