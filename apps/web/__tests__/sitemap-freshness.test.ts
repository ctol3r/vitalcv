import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import sitemap, { SITEMAP_ROUTES } from '@/app/sitemap';

/**
 * The sitemap's `lastModified` is a factual claim about each page, and the only
 * thing that can falsify it is the repository itself.
 *
 * This recomputes every stamp from git and fails on drift, in both directions:
 * a route edited without updating its date (stale — the page really did change)
 * and a date pushed ahead of the source (overclaimed freshness, the `new Date()`
 * bug's whole failure mode). Asserting against git rather than against a
 * hand-written expectation is what makes it a measurement instead of a
 * restatement of the same constant.
 */

const webRoot = join(__dirname, '..');

/**
 * A shallow checkout cannot answer "when did this path last change".
 *
 * `actions/checkout` clones at depth 1 by default. With one commit and no
 * parent, git reports every tracked path as introduced by that commit — so
 * `git log -1 -- <path>` returns the tip's date for ALL routes, and the
 * comparison degrades into "13 routes all changed today", failing every stamp
 * for a reason that has nothing to do with the sitemap. (My first version of
 * this test shipped that bug and CI caught it.)
 *
 * Declining to measure is the honest response to an unmeasurable environment.
 * The history-free assertions below still run everywhere.
 */
function isShallowRepository(): boolean {
  try {
    return (
      execFileSync('git', ['rev-parse', '--is-shallow-repository'], {
        cwd: webRoot,
        encoding: 'utf8',
      }).trim() === 'true'
    );
  } catch {
    return true;
  }
}

/** Commit date (YYYY-MM-DD, UTC) of a path's last change, or null if unknown. */
function lastCommitDate(relativeSource: string): string | null {
  const out = execFileSync(
    'git',
    ['log', '-1', '--date=format-local:%Y-%m-%d', '--format=%cd', '--', relativeSource],
    { cwd: webRoot, encoding: 'utf8', env: { ...process.env, TZ: 'UTC' } },
  ).trim();
  return out || null;
}

describe('sitemap freshness is measured, not asserted', () => {
  it('lists at least one route', () => {
    expect(SITEMAP_ROUTES.length).toBeGreaterThan(0);
  });

  it('every listed route has real source on disk', () => {
    for (const route of SITEMAP_ROUTES) {
      expect(existsSync(join(webRoot, route.source)), `${route.path} → ${route.source} missing`).toBe(true);
    }
  });

  it.skipIf(isShallowRepository())('every lastModified matches its source’s last commit date', () => {
    const drift: string[] = [];
    for (const route of SITEMAP_ROUTES) {
      const actual = lastCommitDate(route.source);
      // Untracked or otherwise unreadable — no fact to compare against.
      if (!actual) continue;
      if (actual !== route.lastModified) {
        drift.push(
          `${route.path || '/'} — sitemap says ${route.lastModified}, ` +
            `git says ${actual} (set lastModified: '${actual}')`,
        );
      }
    }
    expect(drift, `sitemap lastModified drifted from git:\n  ${drift.join('\n  ')}`).toEqual([]);
  });

  it('does not stamp every route with one shared date', () => {
    // The regression this replaced: a single RELEASE constant, which cannot be
    // true of pages that change independently.
    const distinct = new Set(SITEMAP_ROUTES.map((r) => r.lastModified));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('never stamps a future date', () => {
    const today = new Date().toISOString().slice(0, 10);
    for (const route of SITEMAP_ROUTES) {
      expect(route.lastModified <= today, `${route.path} is stamped in the future`).toBe(true);
    }
  });

  it('emits absolute vitalcv.com URLs with real Date objects', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(SITEMAP_ROUTES.length);
    for (const entry of entries) {
      expect(entry.url.startsWith('https://vitalcv.com')).toBe(true);
      expect(entry.lastModified).toBeInstanceOf(Date);
      expect(Number.isNaN((entry.lastModified as Date).getTime())).toBe(false);
    }
  });

  it('does not list routes that are known to 404 or are robots-disallowed', () => {
    const listed = new Set(SITEMAP_ROUTES.map((r) => r.path));
    for (const gone of ['/explore', '/developers', '/compliance', '/updates', '/about', '/review']) {
      expect(listed.has(gone), `${gone} must not be advertised in the sitemap`).toBe(false);
    }
  });
});
