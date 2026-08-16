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

/** The amendment E figure set — six drawn figures, each self-labelling. */
const FIGURES = [
  'sources-to-profile',
  'match-explanation',
  'owner-routing',
  'approval-boundary',
  'reuse',
  'standing-watch',
] as const;

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

  it('all six amendment E figures render, each labelled illustrative', () => {
    const html = renderHomepageHtml();
    for (const figure of FIGURES) {
      expect(html, `figure "${figure}" missing`).toContain(`data-home-figure="${figure}"`);
    }
    // Each figure's caption self-labels; six captions minimum.
    const captions = html.match(/class="ezh-fig-cap"/g) ?? [];
    expect(captions.length).toBeGreaterThanOrEqual(6);
    expect(html).toMatch(/Illustrative/);
  });

  it('the locked copy rows render: payoff settled word, standing watch, Roles', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('One profile. Every');
    expect(html).toContain('data-home-cycling-word="settled"');
    expect(html).toContain('application');
    expect(html).toContain('data-home-standing-watch');
    expect(html).toContain('Most weeks, you do nothing.');
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

  it('the dark band keeps its seven pinned steps and boundary sentences', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-mobility-sequence');
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
    // The band's drawn material (amendment E): approval boundary as the
    // stage, reuse as step 7's expansion.
    expect(html).toMatch(/data-home-figure="approval-boundary"/);
    expect(html).toMatch(/data-mobility-step-expansion="reuse"/);
  });
});
