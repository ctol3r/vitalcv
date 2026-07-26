/**
 * design-reference-guard.test.tsx — BASE-0 follow-up.
 *
 * DECISION (recorded in docs/audits/base-0-current-state-2026-07-20.md):
 * `/design/*` pages are DELIBERATE public reference surfaces — living design
 * documentation of the trust system (provenance chips, verdicts, freshness,
 * transcript, proof packet). They stay reachable in production, unlinked from
 * product navigation, and every one of them must:
 *   1. opt out of indexing (`robots: { index: false }`), and
 *   2. carry no per-clinician data path (they are static references; the
 *      public-claims gate already scans their copy).
 *
 * This test turns rule 1 from convention into CI fact, so a new /design page
 * cannot silently become an indexed marketing surface. If a page should be
 * indexed, that is a product decision — update BASE-0 first, then this guard.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DESIGN_DIR = path.resolve(process.cwd(), 'app/design');

function designPages(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...designPages(p));
    else if (entry.name === 'page.tsx') out.push(p);
  }
  return out;
}

describe('/design reference surfaces — BASE-0 guard', () => {
  const pages = designPages(DESIGN_DIR);

  it('finds the design reference pages (guard cannot rot to a no-op)', () => {
    expect(pages.length).toBeGreaterThanOrEqual(7);
  });

  it('every /design page opts out of indexing', () => {
    for (const page of pages) {
      const src = fs.readFileSync(page, 'utf8');
      const rel = path.relative(process.cwd(), page);
      expect(
        /index:\s*false/.test(src),
        `${rel} must export robots: { index: false } — /design pages are unindexed public references (BASE-0 decision)`,
      ).toBe(true);
    }
  });

  it('no /design page fetches per-clinician data', () => {
    for (const page of pages) {
      const src = fs.readFileSync(page, 'utf8');
      const rel = path.relative(process.cwd(), page);
      expect(
        /fetch\(\s*[`'"].*\/api\/(passport|identity|trust-state)/.test(src),
        `${rel} must stay a static reference — no live clinician reads on /design`,
      ).toBe(false);
    }
  });
});
