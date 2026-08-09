import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  PREFIX_MATCHERS,
  PUBLIC_SURFACE_PATHS,
  isOpsSurfacePath,
  isPublicSurfacePath,
} from '@/components/layout/publicSurfaceRoutes';

/**
 * The chrome registry contract (2026-08-07 headerless-routes sweep).
 *
 * Eyebrow and Footer both `return null` off this registry, so membership IS
 * the header decision. Before this suite existed nothing pinned it, and the
 * sweep found 56 public routes headerless — including sitemap-indexed
 * marketing (/pricing) and the indexable registry page (/directory/[npi]).
 *
 * Two directions are pinned on purpose:
 *   - additions, so a refactor cannot silently drop a chromed route;
 *   - deliberate exclusions, so "helpfully" chroming an interstitial, a
 *     printable evidence artifact, or the dark onboarding StepShell — all
 *     classified chromeless by the sweep's disposition table
 *     (docs/design/shared-header-recovery/headerless-routes-disposition.md)
 *     — fails a test instead of shipping.
 */

describe('public surface registry — routes the chrome must cover', () => {
  const chromed = [
    '/',
    '/pricing',
    '/concierge',
    '/employers',
    '/employers/request-access',
    '/trust',
    '/onboarding',
    '/evidence-network',
    '/profile/activate',
    // Parameterized public-record surfaces (path params are synthetic
    // strings — matching is textual, no NPI semantics in scope here).
    '/directory/0000000000',
    '/profile/0000000000',
    '/investigate/0000000000',
    // Bucket E decision (2026-08-07): WorkspaceNav surfaces nest under the
    // site header — the pill-nav is local, the header is global.
    '/activity/some-entity',
    '/career-map/some-entity',
    '/packet/some-entity',
    '/ecosystem/some-entity',
    '/recruiter/candidate/some-entity',
    '/search/some-entity',
  ];

  it.each(chromed)('%s renders with the public chrome', (route) => {
    expect(isPublicSurfacePath(route)).toBe(true);
    expect(isOpsSurfacePath(route)).toBe(false);
  });
});

describe('public surface registry — deliberate exclusions hold', () => {
  // Bucket B of the sweep disposition: chrome would break these.
  const chromeless = [
    '/auth/error', // redirect interstitial
    '/auth/resolving', // role-resolution interstitial (middleware target)
    '/onboarding/identity', // dark full-viewport StepShell composition
    '/onboarding/readiness',
    '/onboarding/fetching',
    '/receipt/some-receipt-id', // standalone printable/QR evidence artifact
    '/snapshot/some-share-id', // share-once artifact, fail-closed on 410
  ];

  it.each(chromeless)('%s stays chromeless', (route) => {
    expect(isPublicSurfacePath(route)).toBe(false);
  });

  it('keeps /status/technical a bare standalone console — neither chrome class', () => {
    // Bucket E decision (2026-08-07). Public chrome would put the paper
    // journey header over a dark mono console (scene-system violation); ops
    // classification would mount VCommandBar — ungated intelligence
    // tooling — on a publicly reachable route. Bare on purpose, linked from
    // the chromed /status page for technical readers. The parent stays
    // public chrome.
    expect(isPublicSurfacePath('/status/technical')).toBe(false);
    expect(isOpsSurfacePath('/status/technical')).toBe(false);
    expect(isPublicSurfacePath('/status')).toBe(true);
    expect(isOpsSurfacePath('/status')).toBe(false);
  });

  it('keeps /onboarding chromed while its step children stay immersive', () => {
    // The registry matches exactly, so the parent carries chrome and the
    // dark steps do not — this asymmetry is intentional, not drift.
    expect(isPublicSurfacePath('/onboarding')).toBe(true);
    expect(isPublicSurfacePath('/onboarding/identity')).toBe(false);
  });

  it('covers /profile/activate via the /profile prefix, not a stale exact entry', () => {
    // Both the activation surface and the shared career profile ride the
    // same prefix; if the prefix is ever removed, both assertions fail.
    expect(isPublicSurfacePath('/profile/activate')).toBe(true);
    expect(isPublicSurfacePath('/profile/1234567893')).toBe(true);
  });
});

/**
 * Registry liveness (Wave 1080 hygiene, 2026-08-08).
 *
 * Eyebrow and Footer both `return null` off this registry, so a path listed
 * here is a claim that a chromed page exists at it. Nine of those claims were
 * false: /developers, /documents, /mobile, /ask, /investors, /partners,
 * /updates and /compliance in the Set, plus /compliance and /clip in the
 * prefix list — all measured 404 against production on 2026-08-08, and all
 * but /mobile still retired under app/_archive/wave119. Nothing failed,
 * because the file's own doc comment blessed listing not-yet-existing paths
 * with no expiry.
 *
 * A separate class was redundancy rather than rot: /search, /employers and
 * /trust sat in the Set AND in PREFIX_MATCHERS, where the prefix form is a
 * strict superset. Those routes are live; only the duplicate entries went.
 *
 * Registering a path ahead of its page is still allowed; it just has to be
 * signed. An entry passes if EITHER
 *   - it resolves to a page module under app/, OR
 *   - a `pending:` comment above it names the PR (#1234) or wave (W1079)
 *     that lands it.
 *
 * The resolver mirrors App Router semantics: `(group)` dirs are transparent,
 * `_private` and `@parallel` dirs are never routable — so an `_archive/`
 * copy of a retired page does NOT resurrect its route. Both the resolver and
 * the comment parser carry negative controls below, so a regex regression
 * cannot silently pass everything.
 */

const WEB_ROOT = resolve(__dirname, '..');
const APP_ROOT = join(WEB_ROOT, 'app');
const REGISTRY_SRC = join(WEB_ROOT, 'components/layout/publicSurfaceRoutes.ts');

const PAGE_FILES = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'page.mdx'];

const isRouteGroup = (name: string) => name.startsWith('(') && name.endsWith(')');
const isUnroutable = (name: string) => name.startsWith('_') || name.startsWith('@');

const hasPage = (dir: string) => PAGE_FILES.some((f) => existsSync(join(dir, f)));

function childDirs(dir: string): Array<{ name: string; path: string }> {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .map((name) => ({ name, path: join(dir, name) }))
    .filter((c) => {
      try {
        return statSync(c.path).isDirectory();
      } catch {
        return false;
      }
    });
}

/**
 * Directories a literal route path can land in. Route groups are transparent,
 * so `/trust` may live at `app/trust` or `app/(marketing)/trust`.
 */
function resolveDirs(routePath: string, root = APP_ROOT): string[] {
  const segments = routePath.split('/').filter(Boolean);
  let frontier = [root];
  for (const segment of segments) {
    const next: string[] = [];
    // Route groups contribute no URL segment, so the same segment is retried
    // one level deeper. Walk a queue rather than mutating `frontier` in place.
    const queue = [...frontier];
    while (queue.length > 0) {
      const dir = queue.shift() as string;
      for (const child of childDirs(dir)) {
        if (isUnroutable(child.name)) continue;
        if (isRouteGroup(child.name)) {
          queue.push(child.path);
          continue;
        }
        if (child.name === segment) next.push(child.path);
      }
    }
    frontier = next;
    if (frontier.length === 0) return [];
  }
  return frontier;
}

/** Does a literal path have a page module? */
const staticRouteExists = (routePath: string, root = APP_ROOT) =>
  routePath === '/' ? hasPage(root) : resolveDirs(routePath, root).some(hasPage);

/** Does a prefix have at least one page anywhere beneath it? */
function subtreeHasPage(dir: string): boolean {
  if (hasPage(dir)) return true;
  return childDirs(dir).some((c) => !isUnroutable(c.name) && subtreeHasPage(c.path));
}

const prefixHasAnyPage = (prefix: string, root = APP_ROOT) =>
  resolveDirs(prefix, root).some(subtreeHasPage);

/**
 * Entries of a literal array/Set block in the registry source, each paired
 * with the contiguous `//` comment block directly above it.
 */
function parseEntries(source: string, openMarker: string) {
  const start = source.indexOf(openMarker);
  if (start === -1) throw new Error(`could not find ${openMarker} in registry source`);
  const end = source.indexOf(']', start);
  const body = source.slice(start + openMarker.length, end);

  const entries: Array<{ path: string; comment: string }> = [];
  let pendingComment: string[] = [];
  for (const rawLine of body.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('//')) {
      pendingComment.push(line.replace(/^\/\/\s?/, ''));
      continue;
    }
    const match = line.match(/^['"`]([^'"`]+)['"`]\s*,/);
    if (match) {
      entries.push({ path: match[1], comment: pendingComment.join('\n') });
      pendingComment = [];
      continue;
    }
    if (line.length > 0) pendingComment = [];
  }
  return entries;
}

/** A pending marker must name the PR or wave that lands the page. */
const PENDING_RE = /pending:/i;
const NAMES_LANDING_RE = /(#\d+|\bW\d{3,}\b|\bwave\s+\w+)/i;
const isSignedPending = (comment: string) =>
  PENDING_RE.test(comment) && NAMES_LANDING_RE.test(comment);

describe('public surface registry — every entry is live or signed', () => {
  const source = readFileSync(REGISTRY_SRC, 'utf8');
  const setEntries = parseEntries(source, 'PUBLIC_SURFACE_PATHS = new Set([');

  it('parses the registry source it is asserting on', () => {
    // Guards the parser: if the Set literal is ever reformatted into a shape
    // the regex misses, this fails instead of vacuously passing zero entries.
    expect(setEntries.length).toBeGreaterThanOrEqual(10);
    expect(setEntries.map((e) => e.path)).toEqual([...PUBLIC_SURFACE_PATHS]);
  });

  it.each([...PUBLIC_SURFACE_PATHS])(
    '%s has a page module in app/ (or a signed pending marker)',
    (route) => {
      if (staticRouteExists(route)) return;
      const entry = setEntries.find((e) => e.path === route);
      expect(
        entry && isSignedPending(entry.comment),
        `${route} is registered for public chrome but has no page module under apps/web/app. ` +
          'Either land the page, remove the entry, or mark it with a comment like ' +
          '"// pending: <what lands it> (PR #1234)".',
      ).toBe(true);
    },
  );

  it.each([...PREFIX_MATCHERS])('%s prefix has at least one routable page', (prefix) => {
    expect(
      prefixHasAnyPage(prefix),
      `${prefix} chromes a namespace with no page anywhere beneath it — retired debris.`,
    ).toBe(true);
  });

  it('lists no duplicate matchers', () => {
    expect(PREFIX_MATCHERS.length).toBe(new Set(PREFIX_MATCHERS).size);
    // The Set self-dedupes, so a repeated literal is invisible at runtime —
    // catch it in the source text instead.
    const setPaths = setEntries.map((e) => e.path);
    expect(setPaths.length).toBe(new Set(setPaths).size);
  });

  it('does not list a path the prefix matchers already cover', () => {
    // '/search' sat in both: harmless at runtime, but two places to change
    // and only one of them is the real chrome decision.
    const redundant = [...PUBLIC_SURFACE_PATHS].filter((p) =>
      PREFIX_MATCHERS.some((prefix) => p === prefix || p.startsWith(`${prefix}/`)),
    );
    expect(redundant).toEqual([]);
  });
});

describe('public surface registry — the liveness check is itself under test', () => {
  it('resolves real routes and rejects retired ones', () => {
    expect(staticRouteExists('/')).toBe(true);
    expect(staticRouteExists('/pricing')).toBe(true);
    expect(staticRouteExists('/design/z1-home')).toBe(true);
    // Retired to app/_archive/wave119 — an underscore dir is never routable,
    // so the archived copy must not count as a live route.
    expect(existsSync(join(APP_ROOT, '_archive/wave119/developers'))).toBe(true);
    expect(staticRouteExists('/developers')).toBe(false);
    expect(staticRouteExists('/ask')).toBe(false);
    expect(staticRouteExists('/definitely-not-a-route')).toBe(false);
  });

  it('counts a parameterized namespace as a live prefix but not a live exact path', () => {
    // Why /career-map may stay a prefix while bare /career-map 404s.
    expect(prefixHasAnyPage('/career-map')).toBe(true);
    expect(staticRouteExists('/career-map')).toBe(false);
    expect(prefixHasAnyPage('/clip')).toBe(false);
  });

  it('accepts a signed pending marker and rejects an unsigned one', () => {
    // The escape hatch has no live users right now, so prove it works here
    // rather than discovering it is broken the first time a wave needs it.
    expect(isSignedPending('pending: activation surface (PR #1081)')).toBe(true);
    expect(isSignedPending('pending: ships with wave W1079')).toBe(true);
    expect(isSignedPending('pending: coming soon')).toBe(false);
    expect(isSignedPending('a normal descriptive comment (PR #1081)')).toBe(false);
    expect(isSignedPending('')).toBe(false);
  });
});
