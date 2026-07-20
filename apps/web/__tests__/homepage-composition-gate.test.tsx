/**
 * Homepage composition gate (deep-audit W0.2).
 *
 * The homepage's system-order problem was many good pieces with overlapping
 * ownership: multiple navigation rails and multiple scroll drivers competing.
 * This gate makes that regression a CI failure instead of a design review
 * finding:
 *
 *  1. At most ONE page-level in-page navigation rail may render.
 *  2. Composition changes must update the manifest doc in the same PR —
 *     the manifest names every section; this test pins the nav invariant the
 *     manifest declares.
 *
 * When W2 mounts HorizontalStoryRail's chapter navigation, this test forces
 * the right-edge dot rail to retire in the same change (deep-audit W2.3),
 * rather than shipping a second competing navigator.
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
 * Every marker that constitutes a PAGE-LEVEL in-page navigator. Local,
 * section-scoped controls (the product story's step buttons, a carousel's
 * pause control) are deliberately not listed — the invariant governs
 * page-level chapter/section navigation only.
 */
const PAGE_LEVEL_NAV_MARKERS = [
  'data-home-section-rail', // right-edge dot rail
  'data-home-outline-panel', // retired left outline (must never return)
  'data-story-rail-nav', // HorizontalStoryRail chapter navigation (W2)
] as const;

describe('homepage composition gate (W0.2)', () => {
  it('renders at most ONE page-level in-page navigation rail', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    const present = PAGE_LEVEL_NAV_MARKERS.filter((marker) => html.includes(marker));
    expect(
      present.length,
      `page-level navigators rendered: [${present.join(', ')}] — the composition ` +
        'manifest allows exactly one; retire the old rail in the same PR that mounts a new one',
    ).toBeLessThanOrEqual(1);
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
