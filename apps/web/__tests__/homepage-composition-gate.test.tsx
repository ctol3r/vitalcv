/**
 * Homepage composition gate (deep-audit W0.2).
 *
 * The homepage's system-order problem was many good pieces with overlapping
 * ownership: multiple navigation rails and multiple scroll drivers competing.
 * This gate makes that regression a CI failure instead of a design review
 * finding:
 *
 *  1. No page-level in-page navigation rail may render.
 *  2. Composition changes must update the manifest doc in the same PR —
 *     the manifest names every section; this test pins the nav invariant the
 *     manifest declares.
 *
 * The journey is intentionally ordinary document flow: no carousel or
 * chapter navigator should return in a later composition change.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => null,
}));

import HomePageClient from '@/app/HomePageClient';

/**
 * Every marker that constitutes a PAGE-LEVEL in-page navigator. The homepage
 * uses document order and direct chapter anchors instead.
 */
const PAGE_LEVEL_NAV_MARKERS = [
  'data-home-section-rail', // right-edge dot rail
  'data-home-outline-panel', // retired left outline (must never return)
  'data-story-rail-nav', // retired HorizontalStoryRail chapter navigation
] as const;

describe('homepage composition gate (W0.2)', () => {
  it('renders no page-level in-page navigation rail', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    const present = PAGE_LEVEL_NAV_MARKERS.filter((marker) => html.includes(marker));
    expect(
      present.length,
      `page-level navigators rendered: [${present.join(', ')}] — the composition ` +
        'manifest prohibits them; keep the journey in ordinary document flow',
    ).toBe(0);
  });

  it('the composition manifest exists and names the enforcing test', () => {
    const manifestPath = join(
      __dirname,
      '../../../docs/design/homepage-composition-manifest.md',
    );
    expect(existsSync(manifestPath), 'docs/design/homepage-composition-manifest.md').toBe(true);
    const manifest = readFileSync(manifestPath, 'utf8');
    expect(manifest).toContain('homepage-composition-gate.test.tsx');
    // The manifest's core rule stays stated in the document itself.
    expect(manifest).toContain('page-level in-page navigation');
  });
});
