/**
 * Retired-route reference guard — the companion to the public-surface registry.
 *
 * Wave 1080 removed nine measured-dead paths from `publicSurfaceRoutes.ts` and
 * gated the registry so an unlanded promise expires loudly. But the registry
 * only decides which routes get Navbar + Footer chrome. It says nothing about
 * whether anything still *navigates* to them, and three live references
 * outlived that cleanup:
 *
 *   - CommandPalette pushed `/ask` from three places. It mounts in the ROOT
 *     layout, so that was a reachable dead end from every page on the site.
 *   - DeployBadge linked `/updates` (component was orphaned; now deleted).
 *   - next.config redirected `/docs/api` -> `/developers`, a live 307 that
 *     landed on a 404.
 *
 * A path being absent from the chrome registry is not the same as a path being
 * unreachable. This guard asserts the second thing.
 *
 * Two directions, so the guard cannot rot into enforcing retired doctrine:
 *
 *   1. STILL RETIRED — each path below must have no page module. If someone
 *      genuinely ships `/ask`, this fails and they delete the entry, rather
 *      than the guard silently forbidding a route that now exists.
 *   2. UNREFERENCED — no shipped source file may navigate to one of them.
 *
 * Measured 404 against https://vitalcv.com on 2026-08-08; all but /mobile sit
 * retired under `app/_archive/wave119`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { existsSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB = join(__dirname, '..');

/** Paths retired by wave119 / wave 1080, each measured 404 in production. */
const RETIRED_PATHS = [
  '/ask',
  '/clip',
  '/compliance',
  '/developers',
  '/documents',
  '/investors',
  '/mobile',
  '/partners',
  '/updates',
] as const;

/** Directories that are not shipped code — archived, test-only, or generated. */
const SKIP_DIRS = new Set([
  'node_modules', '.next', '_archive', '__tests__', 'tests',
  'coverage', 'dist', '.turbo', 'playwright-report', 'test-results',
]);

const SCAN_EXTS = new Set(['.ts', '.tsx', '.mjs', '.js', '.jsx']);

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, out);
    else if (SCAN_EXTS.has(extname(entry))) out.push(full);
  }
  return out;
}

/**
 * Extract internal navigation targets: the string literal a user is sent to.
 *
 * Deliberately matches only navigation forms, never bare literals. `/ask` is a
 * substring of the live `/api/ask` endpoint and `/compliance` of the live
 * backend `/compliance/emergency/declare` route — matching on substring alone
 * would flag working code. We capture the WHOLE literal and compare it as a
 * path, so `/api/ask` can never be mistaken for `/ask`.
 */
export function navigationTargets(src: string): string[] {
  const withoutComments = src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const targets: string[] = [];
  const forms = [
    /\brouter\.(?:push|replace)\(\s*['"`]([^'"`]+)['"`]/g,  // client nav
    /\bredirect\(\s*['"`]([^'"`]+)['"`]/g,                  // server redirect
    /\bhref=[{\s]*['"`]([^'"`]+)['"`]/g,                    // Link / anchor
    /\bdestination:\s*['"`]([^'"`]+)['"`]/g,                // next.config redirects
  ];
  for (const re of forms) {
    for (const m of withoutComments.matchAll(re)) targets.push(m[1]);
  }
  return targets;
}

/** True when `target` navigates to `path` — exact, sub-path, or with a query. */
export function pointsAt(target: string, path: string): boolean {
  const clean = target.split('#')[0];
  return clean === path || clean.startsWith(`${path}?`) || clean.startsWith(`${path}/`);
}

describe('retired routes stay retired', () => {
  it.each(RETIRED_PATHS)('%s has no page module', (path) => {
    const dir = join(WEB, 'app', path.slice(1));
    const hasPage = ['page.tsx', 'page.ts', 'page.jsx', 'page.js', 'route.ts']
      .some((f) => existsSync(join(dir, f)));

    // If this fails the route genuinely shipped — remove it from RETIRED_PATHS
    // rather than deleting the reference it now legitimately supports.
    expect(hasPage, `${path} now has a page module; drop it from RETIRED_PATHS`).toBe(false);
  });
});

describe('no shipped code navigates to a retired route', () => {
  const files = sourceFiles(WEB);

  it('scans a non-trivial number of source files', () => {
    // Guards that silently scan nothing pass forever. Prove the walk works.
    expect(files.length).toBeGreaterThan(500);
  });

  it('finds no navigation to a retired path', () => {
    const offences: string[] = [];

    for (const file of files) {
      const targets = navigationTargets(readFileSync(file, 'utf8'));
      for (const target of targets) {
        for (const path of RETIRED_PATHS) {
          if (pointsAt(target, path)) {
            offences.push(`${relative(WEB, file)} -> ${target} (retired: ${path})`);
          }
        }
      }
    }

    expect(offences, `dead-end navigation:\n${offences.join('\n')}`).toEqual([]);
  });
});

describe('the matcher separates retired paths from live ones that share a prefix', () => {
  it('does not flag live API routes that contain a retired path as a substring', () => {
    expect(pointsAt('/api/ask', '/ask')).toBe(false);
    expect(pointsAt('/compliance/emergency/declare', '/compliance')).toBe(true);
    expect(pointsAt('/asking', '/ask')).toBe(false);
    expect(pointsAt('/updates-archive', '/updates')).toBe(false);
  });

  it('flags exact, query, and sub-path navigation', () => {
    expect(pointsAt('/ask', '/ask')).toBe(true);
    expect(pointsAt('/ask?q=hello', '/ask')).toBe(true);
    expect(pointsAt('/docs/api', '/docs')).toBe(true);
  });

  it('reads targets out of each navigation form', () => {
    expect(navigationTargets(`router.push('/ask')`)).toContain('/ask');
    expect(navigationTargets(`<Link href="/updates">`)).toContain('/updates');
    expect(navigationTargets(`{ destination: '/developers' }`)).toContain('/developers');
    expect(navigationTargets(`redirect('/mobile')`)).toContain('/mobile');
  });

  it('ignores commented-out navigation', () => {
    expect(navigationTargets(`// router.push('/ask')`)).toEqual([]);
  });
});
