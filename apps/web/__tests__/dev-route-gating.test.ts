/**
 * Every `/dev/*` page is gated out of canonical production.
 *
 * Finding F9 of the 2026-08-09 page consistency audit. `/dev/graph/[entityId]`
 * carried the sentence "Not a production surface" in its own header and served
 * **HTTP 200 to anonymous visitors** on https://www.vitalcv.com. It was the
 * single `/dev` route with no gate; every sibling already had one, and
 * `/design/*` is covered by a layout gate written precisely so a new reference
 * is gated the moment it exists.
 *
 * The lesson the gate encodes is that `robots: { index: false }` is not a gate.
 * It removes a route from search results and leaves it fully reachable, which
 * is why the drift survived: the route looked deliberate from every angle
 * except the one that mattered.
 *
 * This is a directory sweep rather than a per-file assertion, so a tenth
 * reference added later is covered without anyone remembering to extend it.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const devRoot = join(__dirname, '..', 'app', 'dev');

function pageFilesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...pageFilesUnder(full));
    else if (entry === 'page.tsx') out.push(full);
  }
  return out;
}

const DEV_PAGES = pageFilesUnder(devRoot);

describe('/dev/* production gating', () => {
  it('finds the dev route tree', () => {
    expect(DEV_PAGES.length).toBeGreaterThan(0);
  });

  /**
   * Asserted as an OUTCOME, not a mechanism. These routes gate three different
   * ways — a direct `NODE_ENV` check (page-stack, story-rail, compete-film,
   * graph), a preview-payload loader that returns null off-env (matcha-deck,
   * matcha-workspaces), a feature check (career-garden) — and all three are
   * legitimate. Pinning one spelling would fail honest siblings and teach
   * people to work around the gate.
   *
   * What every one of them must share is a refusal path. `/dev/graph` had no
   * `notFound()` at all, which is precisely what this catches.
   */
  it.each(DEV_PAGES.map((p) => [p.slice(p.indexOf('app/dev')), p] as const))(
    '%s has a refusal path',
    (_label, file) => {
      const src = readFileSync(file, 'utf8');

      expect(src, 'must be able to refuse, not merely hide').toContain('notFound()');

      // noindex is not a gate — it removes a route from search results and
      // leaves it fully reachable. A route may carry it, but never *instead*.
      const hasNoindex = /robots:\s*\{[^}]*index:\s*false/.test(src);
      if (hasNoindex) {
        expect(
          src.includes('notFound()'),
          'noindex present with no refusal path — exactly the F9 shape',
        ).toBe(true);
      }
    },
  );
});
