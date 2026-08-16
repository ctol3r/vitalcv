/**
 * Homepage composition gate (deep-audit W0.2; rewritten for amendment E).
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
 *  3. The Direction A register holds: drawn-ink figures (never frost), the
 *     locked copy rows, the six-figure set, the severity-red ban, and the
 *     ≤145 text-node budget the recomposition was cut to.
 *
 * The journey is intentionally ordinary document flow: no carousel or
 * chapter navigator should return in a later composition change.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
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

/** The amendment E.1 figure set — the two figures that explain a mechanism
 * a visitor actually acts on. The other four retired with their sections
 * (founder directive, 2026-08-16). */
const FIGURES = ['sources-to-profile', 'match-explanation'] as const;

/**
 * Count the customer-prose text nodes in the server render: text between
 * tags, excluding SVG subtrees (drawn art labels belong to their figure and
 * are aria-hidden with adjacent transcripts) and the JSON-LD script. This is
 * the measurement the Direction D copy-halving used; amendment E's
 * recomposition must not creep past the same ceiling — duplication cuts fund
 * the figure captions, not net growth.
 */
function countTextNodes(html: string): number {
  const withoutSvg = html
    .replace(/<svg[\s\S]*?<\/svg>/g, '')
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '');
  const nodes = [...withoutSvg.matchAll(/>([^<>]+)</g)]
    .map((m) => m[1])
    .filter((t) => /\S/.test(t));
  return nodes.length;
}

describe('homepage composition gate (W0.2 / amendment E)', () => {
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
   * Competitive-mandate guardrails 5 and 6: no visible section taxonomy and
   * no marketing-number theatre (giant counters, `01–06` step eyebrows,
   * percentage rings). Cheap to reach for again, so pinned here.
   */
  it('prints no chapter index on any homepage section eyebrow', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('mz-eyebrow-index');
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
   * Amendment E, Material + Illustration rows — the hero is a drawn figure,
   * never frost, and the figure leaves an open row instead of inventing an
   * answer.
   */
  it('the work surface is the drawn Figure 1, flat paper, with the open row', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-work-surface');
    expect(html).toContain('data-visual-material="drawn-ink"');
    expect(html).not.toContain('data-visual-material="frosted-glass"');
    expect(html).not.toContain('backdrop-filter');
    expect(html).toContain('no source answered');
    for (const resolved of ['Hired', 'Offer accepted', 'You got the job']) {
      expect(html, `the employer boundary resolved itself: "${resolved}"`).not.toContain(resolved);
    }
  });

  it('both surviving figures render, each labelled illustrative', () => {
    const html = renderHomepageHtml();
    for (const figure of FIGURES) {
      expect(html, `figure "${figure}" missing`).toContain(`data-home-figure="${figure}"`);
    }
    // Each figure's caption self-labels.
    const captions = html.match(/class="ezh-fig-cap"/g) ?? [];
    expect(captions.length).toBeGreaterThanOrEqual(2);
    expect(html).toMatch(/Illustrative/);
  });

  it('the locked copy rows render: payoff settled word, promises, Roles', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('One profile. Every');
    expect(html).toContain('data-home-cycling-word="settled"');
    expect(html).toContain('application');
    // E.2 folded the standing-watch payoff into one sentence; the claim holds.
    expect(html).toMatch(/most\s+weeks,\s+nothing\s+does/i);
    expect(html).toContain('data-home-opportunity-horizon');
  });

  /**
   * Amendment E, action-colour semantics: the reserved severity red never
   * renders on the `/` scene register, and the page's own stylesheet may not
   * reference it. The action red and the revoked-red are distinguished by
   * rule, not hue distance.
   */
  it('severity red never reaches the homepage register', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('--vt-severity-critical');
    expect(html).not.toMatch(/#B91C1C/i);
    // Declarations only — the stylesheet's own comments may NAME the banned
    // things (that is how a file documents its bans) without declaring them.
    const css = readFileSync(join(__dirname, '../styles/easy-home.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toContain('--vt-severity-critical');
    expect(css).not.toContain('backdrop-filter');
    expect(css).not.toContain('--vt-home-d-');
  });

  it('holds the ≤145 text-node budget the recomposition was cut to', () => {
    const html = renderHomepageHtml();
    const count = countTextNodes(html);
    console.info(`[composition gate] homepage prose text nodes: ${count} / 145`);
    expect(
      count,
      `the homepage renders ${count} prose text nodes — the amendment E budget is 145; ` +
        'fund new copy with duplication cuts, not growth',
    ).toBeLessThanOrEqual(145);
  });

  it('amendment E.1: the bottom half is three promises, three answers, two doors', () => {
    const html = renderHomepageHtml();
    // The founder's 2026-08-16 directive retired the seven-step band, the
    // standing-watch timeline, the attribution ledger, and the accordion FAQ:
    // "the user doesn't even need to know the information presented."
    expect(html).not.toContain('data-home-mobility-sequence');
    expect(html).not.toContain('data-home-standing-watch');
    expect(html).not.toContain('Only what you approved crosses over');
    expect(html).not.toContain('Every line says how it got there');
    expect(html).not.toContain('01 / 07');
    // What replaced it — once each, benefit-led:
    expect(html).toContain('Three things. That');
    expect(html).toContain('Build it once. Take it everywhere.');
    expect(html).toContain('You say what gets shared.');
    expect(html).toContain('Nothing leaves your record until you say so.');
    expect(html).toMatch(/We keep watch, so you don/);
    expect(html).toMatch(/most\s+weeks,\s+nothing\s+does/i);
    // Flat answers, not accordions; the credentialing boundary survives.
    expect(html).toContain('Quick answers');
    expect(html).toContain('Is this credentialing?');
    expect(html).toContain('those decisions always stay with the employer');
    // The two doors close the page.
    expect(html).toContain('Ready when you are.');
    expect(html).toContain('Hiring clinicians?');
  });

  it('the page stays SHORT — the E.2 budget is a hard ceiling', () => {
    const html = renderHomepageHtml();
    const count = countTextNodes(html);
    // The E budget was 145; E.1 cut four sections (110); E.2's "less text"
    // pass tightens the whole page to 90. Fund additions with cuts.
    expect(
      count,
      `the homepage renders ${count} prose text nodes — the amendment E.2 budget is 90`,
    ).toBeLessThanOrEqual(90);
  });

  it('amendment E.2: the clinical pictograms are drawn objects inside aria-hidden art', () => {
    const html = renderHomepageHtml();
    // The badge framing and pictograms live inside the figures' aria-hidden
    // SVG art or the promises' aria-hidden glyphs — never as raster assets.
    expect(html).not.toMatch(/<img[^>]*(?:badge|caduceus|stethoscope|hospital)/i);
    // The motion system is an enhancement: the server frame carries NO arming
    // attribute (hydration adds it outside reduced motion), so SSR, no-JS,
    // and crawlers get the finished page.
    expect(html).not.toContain('data-ezh-motion=');
    // Sections opt into the one-shot entrance; the server frame ships them
    // complete (the hidden state exists only under the armed attribute).
    expect((html.match(/data-ezh-reveal/g) ?? []).length).toBeGreaterThanOrEqual(5);
  });
});
