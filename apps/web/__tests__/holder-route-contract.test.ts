/**
 * Holder route contract — every internal link rendered by the clinician
 * holder surfaces must resolve to a real App Router route.
 *
 * Why: dead links have shipped repeatedly (5× `/opportunities/[id]`,
 * `/get-ready` referenced by 5 surfaces before it existed, `/documents` ×2).
 * This test extracts href literals from the holder/mobile surface sources
 * and asserts each internal path maps to an existing page.tsx (or dynamic
 * segment) under apps/web/app, so the golden path can never silently 404.
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const WEB_ROOT = resolve(__dirname, '..');
const APP_ROOT = join(WEB_ROOT, 'app');

/** Surface sources whose links form the clinician golden path. */
const SURFACE_FILES = [
  'app/holder/page.tsx',
  'app/holder/readiness/ReadinessSurface.tsx',
  'components/mobile/ClinicianHomeSurface.tsx',
  'components/mobile/ClinicianOpportunitiesSurface.tsx',
  'components/mobile/ClinicianApplicationsSurface.tsx',
  'components/mobile/ClinicianApplicationDetailSurface.tsx',
  'components/mobile/ClinicianPanels.tsx',
  'components/clinician/MobileBottomNav.tsx',
  'components/recognition/RecognitionCard.tsx',
  'components/recognition/RecognitionSurface.tsx',
];

/** Extract internal href path literals (static + template-literal heads). */
function extractInternalHrefs(source: string): string[] {
  const hrefs = new Set<string>();

  // href="/path" | href='/path'
  for (const match of source.matchAll(/href=["'](\/[^"'#?]*)["'#?]/g)) {
    hrefs.add(match[1]);
  }
  // href={`/path/${expr}`} — take the static head and mark the dynamic tail
  for (const match of source.matchAll(/href=\{`(\/[^`$]*)\$\{/g)) {
    hrefs.add(`${match[1]}__DYNAMIC__`);
  }
  // href={"/path"} / href={'/path'}
  for (const match of source.matchAll(/href=\{["'](\/[^"'#?]*)["']\}/g)) {
    hrefs.add(match[1]);
  }
  // data-driven nav/action definitions: href: '/path' | href: `/path/${expr}`
  for (const match of source.matchAll(/href:\s*["'](\/[^"'#?]*)["']/g)) {
    hrefs.add(match[1]);
  }
  for (const match of source.matchAll(/href:\s*`(\/[^`$]*)\$\{/g)) {
    hrefs.add(`${match[1]}__DYNAMIC__`);
  }

  return [...hrefs].filter((href) => href.startsWith('/'));
}

/** Does a concrete route path resolve to a page in the app dir? */
function routeExists(routePath: string): boolean {
  const segments = routePath.split('/').filter(Boolean);
  let candidates: string[] = [APP_ROOT];

  for (const segment of segments) {
    const next: string[] = [];
    for (const dir of candidates) {
      const literal = join(dir, segment);
      if (existsSync(literal) && statSync(literal).isDirectory()) {
        next.push(literal);
      }
      // dynamic segments: [x], [...x], [[...x]] at this level
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('[') && entry.endsWith(']')) {
          const dynamicDir = join(dir, entry);
          if (statSync(dynamicDir).isDirectory()) {
            next.push(dynamicDir);
          }
        }
      }
    }
    if (next.length === 0) return false;
    candidates = next;
  }

  return candidates.some((dir) => existsSync(join(dir, 'page.tsx')) || existsSync(join(dir, 'page.ts')));
}

/** A dynamic href head (e.g. /holder/opportunities/) must have a dynamic child route. */
function dynamicRouteExists(head: string): boolean {
  const segments = head.split('/').filter(Boolean);
  let candidates: string[] = [APP_ROOT];

  for (const segment of segments) {
    const next: string[] = [];
    for (const dir of candidates) {
      const literal = join(dir, segment);
      if (existsSync(literal) && statSync(literal).isDirectory()) next.push(literal);
      for (const entry of readdirSync(dir)) {
        if (entry.startsWith('[') && entry.endsWith(']')) {
          const dynamicDir = join(dir, entry);
          if (statSync(dynamicDir).isDirectory()) next.push(dynamicDir);
        }
      }
    }
    if (next.length === 0) return false;
    candidates = next;
  }

  // The dynamic tail: at least one candidate must contain a dynamic child with a page.
  return candidates.some((dir) =>
    readdirSync(dir).some((entry) => {
      if (!entry.startsWith('[') || !entry.endsWith(']')) return false;
      const dynamicDir = join(dir, entry);
      return (
        statSync(dynamicDir).isDirectory() &&
        (existsSync(join(dynamicDir, 'page.tsx')) || existsSync(join(dynamicDir, 'page.ts')))
      );
    }),
  );
}

describe('holder route contract — no dead links on the clinician golden path', () => {
  for (const rel of SURFACE_FILES) {
    it(`${rel}: every internal href resolves to a real route`, () => {
      const source = readFileSync(join(WEB_ROOT, rel), 'utf-8');
      const hrefs = extractInternalHrefs(source);
      // Some surfaces render links only via child components — zero own
      // hrefs is fine; the contract is that none of the ones present 404.

      const dead: string[] = [];
      for (const href of hrefs) {
        if (href.endsWith('__DYNAMIC__')) {
          const head = href.replace('__DYNAMIC__', '');
          if (!dynamicRouteExists(head)) dead.push(`${head}\${…}`);
        } else if (!routeExists(href)) {
          dead.push(href);
        }
      }

      expect(dead, `dead links in ${rel}: ${dead.join(', ')}`).toEqual([]);
    });
  }
});
