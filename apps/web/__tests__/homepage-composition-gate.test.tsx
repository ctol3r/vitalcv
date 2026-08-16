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
   * Direction D — the server frame presents an illustrative record and a
   * clinician-controlled disclosure boundary without turning the homepage
   * into a fictional employer outcome.
   */
  /**
   * Retargeted from D.7's frosted work surface to amendment E's drawn figures.
   *
   * What changed is the CARRIER, not the contract. The old assertions named
   * WorkSurface's internals — `data-home-work-surface`, `data-motion-display`,
   * and `data-visual-material="frosted-glass"`. E retires the folio and bans
   * frost on this route, so pinning those would pin the superseded material.
   * The invariants they existed to protect are all still asserted below: the
   * record is illustrative, the consent boundary is stated in prose, and the
   * employer side never resolves.
   */
  it('the illustrated record stays unresolved and clinician-controlled', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-register="direction-a"');
    expect(html).toContain('ezh-fig-hero');
    expect(html).toContain('Illustrative');
    expect(html).toContain('Your employer receives the exact record you approve.');
    // E bans frost on `/`; the folio's material must not come back with it.
    expect(html).not.toContain('data-visual-material="frosted-glass"');
    for (const resolved of ['Hired', 'Offer accepted', 'You got the job']) {
      expect(html, `the employer boundary resolved itself: "${resolved}"`).not.toContain(resolved);
    }
  });

  it('the server frame carries visible source states and a consent boundary', () => {
    const html = renderHomepageHtml();
    // The state vocabulary now comes from Attribution's ledger and the mobility
    // track rather than the folio's rows — four distinct words for four
    // distinct things, never flattened into one (EC-3/EC-4).
    for (const state of [
      'Source-confirmed',
      'You reported it',
      'Access required',
      'Not checked',
      'Your record',
    ]) {
      expect(html, `record state "${state}" missing from the server frame`).toContain(state);
    }
    expect(html).toContain('Your employer receives the exact record you approve.');
    // The approval boundary must be readable as prose, not only drawn (EC-4).
    expect(html).toContain('Only what you approved crosses over.');
    expect(html).toContain('Reuse is not standing consent.');
  });

  it('the career opportunity and full acceptance loop stay visible', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('data-home-human-scene');
    expect(html).toContain('data-home-opportunity-horizon');
    expect(html).toContain('data-home-mobility-sequence');
    // Amendment E's two composition additions. The Roles frame is the answer to
    // "why isnt job opportunities mentioned once on homepage??" and must not be
    // quietly dropped back to a bare feed.
    expect(html).toContain('data-home-roles');
    expect(html).toContain('data-home-standing-watch');
    for (const step of [
      'Your record',
      'Opportunity',
      'Your choice',
      'Exact packet',
      'Employer review',
      'Accepted head start',
      'Reuse',
    ]) {
      expect(html, `career-mobility step "${step}" missing`).toContain(step);
    }
    expect(html).toContain('Only after the employer records that decision.');
    expect(html).toContain('Fresh clinician consent is required next time.');
    expect(html).toContain('01 / 07');
    expect(html).toContain('07 / 07');
    expect(html).toMatch(/data-home-mobility-sequence=""[^>]*data-header-theme="dark"/);
  });
});
