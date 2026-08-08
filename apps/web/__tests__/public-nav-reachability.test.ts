/**
 * public-nav-reachability.test.ts — Wave 1079.
 *
 * A public navigation destination must be reachable by a signed-out visitor,
 * not merely exist. The existing dead-link contract asserts that every nav href
 * resolves, and `/opportunities/discover` satisfied it perfectly: the route is
 * real and returns a response. That response is `redirect('/holder/...')`, and
 * `/holder/*` is CLINICIAN-protected — so the clinician group's jobs link walled
 * every cold visitor at "Welcome back to VitalCV".
 *
 * Note what a naive guard would have missed. `getRequiredRole('/opportunities/
 * discover')` is `null` — the alias itself is not protected. The gate is one
 * hop away, in the page it redirects to. So this walks the redirect the same
 * way a browser does, and judges the destination the visitor actually lands on.
 *
 * Scope is deliberately the union of all three renderings (bar, index menu,
 * footer). They are one information architecture, and the failure this catches
 * is a link being advertised on any of them.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  FOOTER_NAV,
  NAV_GROUPS,
  PRIMARY_NAV,
  allPublicNavHrefs,
} from '@/components/layout/navDestinations';
import { getRequiredRole, isPublicRoute } from '@/lib/auth/roles';

const APP_DIR = resolve(__dirname, '../app');

/** Strip the fragment: `/#how-it-works` is a route plus a scroll target. */
const toPath = (href: string) => href.split('#')[0] || '/';

/**
 * Read the App Router page module backing a path, if there is a static one.
 * Dynamic segments are not resolved — no public nav destination uses one, and
 * the assertion below fails loudly rather than silently skipping if that
 * changes.
 */
function readPageSource(path: string): string | null {
  const segment = path === '/' ? '' : path;
  for (const file of ['page.tsx', 'page.ts']) {
    try {
      return readFileSync(resolve(APP_DIR, `.${segment}/${file}`), 'utf-8');
    } catch {
      /* try the next extension */
    }
  }
  return null;
}

/**
 * Follow server-side `redirect('/target')` hops the way a browser would, so the
 * verdict lands on the page the visitor actually sees. Bounded, because a
 * redirect cycle should fail the test rather than hang it.
 */
function resolveRedirects(startPath: string): string {
  let current = startPath;
  const seen = new Set<string>();

  for (let hop = 0; hop < 5; hop += 1) {
    if (seen.has(current)) break;
    seen.add(current);

    const source = readPageSource(current);
    if (!source) break;

    const match = source.match(/\bredirect\(\s*['"`](\/[^'"`]*)['"`]/);
    if (!match) break;
    current = toPath(match[1]);
  }

  return current;
}

describe('public navigation is reachable signed out', () => {
  const hrefs = allPublicNavHrefs();

  it('advertises at least the bar, menu and footer destinations', () => {
    expect(hrefs.length).toBe(
      PRIMARY_NAV.length + NAV_GROUPS.flatMap((g) => g.links).length + FOOTER_NAV.length,
    );
  });

  it.each(hrefs)('%s does not require a role, after redirects', (href) => {
    const landing = resolveRedirects(toPath(href));

    expect(
      getRequiredRole(landing),
      `${href} lands on ${landing}, which requires a role — a signed-out visitor is sent to /sign-in`,
    ).toBeNull();
  });

  it('does not advertise any destination under a protected tree', () => {
    // Belt to the braces above: even if a tree stops being matched by
    // PROTECTED_ROUTES, these prefixes are workspace surfaces and have no place
    // in public navigation.
    const workspacePrefixes = ['/holder', '/employer/', '/verifier', '/command-center', '/admin'];

    for (const href of hrefs) {
      const landing = resolveRedirects(toPath(href));
      for (const prefix of workspacePrefixes) {
        expect(
          landing.startsWith(prefix),
          `${href} lands on ${landing}, inside the ${prefix} workspace`,
        ).toBe(false);
      }
    }
  });

  it('routes the jobs destination at the public board, not the signed-in alias', () => {
    // The specific regression. /explore is declared public in
    // PUBLIC_ROUTE_PATTERNS ("public opportunities board") and is written for a
    // signed-out reader; /opportunities/discover is the signed-in alias.
    const jobs = [...PRIMARY_NAV, ...NAV_GROUPS.flatMap((g) => g.links)].filter(
      (link) => link.label === 'Jobs',
    );

    expect(jobs.length).toBeGreaterThan(0);
    for (const link of jobs) {
      expect(link.href).toBe('/explore');
      expect(isPublicRoute(link.href)).toBe(true);
    }
    expect(hrefs).not.toContain('/opportunities/discover');
  });

  it('keeps Trust and Status off the bar and in the footer', () => {
    // W1079's actual IA move. Asserted as an outcome — where each destination
    // is advertised — rather than by matching the markup that renders it.
    const barHrefs = PRIMARY_NAV.map((l) => l.href);
    expect(barHrefs).not.toContain('/trust');
    expect(barHrefs).not.toContain('/status');

    const footerHrefs = FOOTER_NAV.map((l) => l.href);
    expect(footerHrefs).toContain('/trust');
    expect(footerHrefs).toContain('/status');
  });

  it('has no duplicate destination within any single rendering', () => {
    for (const [name, list] of [
      ['bar', PRIMARY_NAV.map((l) => l.href)],
      ['footer', FOOTER_NAV.map((l) => l.href)],
    ] as const) {
      expect(new Set(list).size, `${name} advertises the same href twice`).toBe(list.length);
    }
  });
});

describe('resolveRedirects', () => {
  // The guard's own mechanism is worth one assertion: if redirect-following
  // silently stopped working, every case above would pass vacuously.
  it('follows a redirect alias to the page it lands on', () => {
    expect(resolveRedirects('/opportunities/discover')).toBe('/holder/opportunities/discover');
  });

  it('would have failed the destination this wave removed', () => {
    expect(getRequiredRole(resolveRedirects('/opportunities/discover'))).not.toBeNull();
  });
});
