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

import { renderHomepageHtml } from './helpers/render-homepage';

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
    const html = renderHomepageHtml();
    const present = PAGE_LEVEL_NAV_MARKERS.filter((marker) => html.includes(marker));
    expect(
      present.length,
      `page-level navigators rendered: [${present.join(', ')}] — the composition ` +
        'manifest prohibits them; keep the journey in ordinary document flow',
    ).toBe(0);
  });

  /**
   * Competitive-mandate guardrails 5 and 6. A numbered 01–06 eyebrow sequence
   * shipped on 2026-07-21 to give the body one spine instead of five competing
   * theses. The mandate — authored the same day — already forbade it:
   *   guardrail 5: "No visible section taxonomy or generic feature headers."
   *   guardrail 6: "No marketing-number theatre. No giant counters,
   *                 steps `01–06`, percentage rings…"
   * It is cheap to reach for again, so it is pinned here rather than left to
   * review. The composition answer is the six-scene film, not a printed index.
   */
  it('prints no chapter index on any homepage section eyebrow', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('mz-eyebrow-index');
    // Catch a hand-rolled equivalent: a 2-digit index opening an eyebrow.
    const numberedEyebrow = /class="[^"]*mz-eyebrow[^"]*"[^>]*>\s*(?:<[^>]+>\s*)?0[1-9]\b/;
    expect(
      numberedEyebrow.test(html),
      'a section eyebrow starts with a 01-style step number — guardrail 6 retires step sequences',
    ).toBe(false);
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

  /**
   * D-01A — Profile in Motion's boundary and layer contract, pinned.
   *
   * 1. The story ends at the employer's REVIEW. The scene renders the review
   *    desk with an open, undecided outcome — no "hired", no "accepted", no
   *    resolved employer decision. The boundary is the point of the frame.
   * 2. The layered record and the consent gate exist in the SERVER frame:
   *    the completed story is what crawlers and no-JS visitors receive.
   */
  it('the work surface ends at employer review, undecided (D-01A)', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('ezh-desk-out');
    expect(html).toContain('This is where VitalCV stops');
    for (const resolved of ['Hired', 'Offer accepted', 'You got the job']) {
      expect(html, `the employer boundary resolved itself: "${resolved}"`).not.toContain(resolved);
    }
  });

  it('the server frame carries the layered record and the consent gate (D-01A)', () => {
    const html = renderHomepageHtml();
    for (const layer of ['identity', 'sourced', 'yours', 'consent']) {
      expect(html, `record layer "${layer}" missing from the server frame`).toContain(
        `data-layer="${layer}"`,
      );
    }
    expect(html).toContain('ezh-gate');
    expect(html).toContain('Your approval');
  });
});
