/**
 * Homepage composition gate (deep-audit W0.2; rewritten for amendment F —
 * the founder's Homepage v4, directive of 2026-08-16: "Implement: VitalCV
 * Homepage v4.html").
 *
 * The gate pins:
 *
 *  1. No page-level in-page navigation rail may render (the founder's v4
 *     floating glass rail was NOT ported — shared chrome is founder-gated,
 *     EC-10; recorded as a gap in amendment F).
 *  2. Composition changes must update the manifest doc in the same PR.
 *  3. The F register holds: drawn-ink figures (never frost), the v4 section
 *     set, the five-state legend (no sixth state — the product produces no
 *     "adverse · under dispute"), the masked NPI, the load-bearing tally
 *     caption, the duration honesty note, and the text-node budget.
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
 * uses document order and direct anchors instead.
 */
const PAGE_LEVEL_NAV_MARKERS = [
  'data-home-section-rail', // right-edge dot rail
  'data-home-outline-panel', // retired left outline (must never return)
  'data-story-rail-nav', // retired HorizontalStoryRail chapter navigation
] as const;

/** The amendment F figure set — the v4 evidence-geometry drawings. */
const FIGURES = [
  'hero-folio',
  'trust-flow',
  'arc-beats',
  'packet-shape',
  'requirement-ledger',
] as const;

/**
 * Count the customer-prose text nodes in the server render: text between
 * tags, excluding SVG subtrees (drawn art labels belong to their figure and
 * are aria-hidden with adjacent transcripts) and the JSON-LD script. Same
 * measurement as the Direction D copy-halving and the E/E.1 budgets.
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

describe('homepage composition gate (W0.2 / amendment F)', () => {
  it('renders no page-level in-page navigation rail', () => {
    const html = renderHomepageHtml();
    const present = PAGE_LEVEL_NAV_MARKERS.filter((marker) => html.includes(marker));
    expect(
      present.length,
      `page-level navigators rendered: [${present.join(', ')}] — the composition ` +
        'manifest prohibits them; keep the journey in ordinary document flow',
    ).toBe(0);
  });

  it('the founder v4 glass rail was not ported: no fixed floating nav container', () => {
    // EC-10 bans the floating rounded container form; the v4 rail needs its
    // own founder chrome ruling before anything like it may mount.
    const html = renderHomepageHtml();
    expect(html).not.toContain('class="rail');
    expect(html).not.toContain('vt-rail');
  });

  it('the composition manifest exists and names the enforcing test', () => {
    const manifestPath = join(
      __dirname,
      '../../../docs/design/homepage-composition-manifest.md',
    );
    expect(existsSync(manifestPath), 'docs/design/homepage-composition-manifest.md').toBe(true);
    const manifest = readFileSync(manifestPath, 'utf8');
    expect(manifest).toContain('homepage-composition-gate.test.tsx');
    expect(manifest).toContain('page-level in-page navigation');
  });

  it('the hero folio is drawn ink on flat paper — no frost, no photograph', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-work-surface');
    expect(html).toContain('data-visual-material="drawn-ink"');
    expect(html).not.toContain('data-visual-material="frosted-glass"');
    expect(html).not.toContain('backdrop-filter');
    for (const resolved of ['Hired', 'Offer accepted', 'You got the job']) {
      expect(html, `the employer boundary resolved itself: "${resolved}"`).not.toContain(resolved);
    }
  });

  it('all five v4 figures render, and the composition self-labels illustrative', () => {
    const html = renderHomepageHtml();
    for (const figure of FIGURES) {
      expect(html, `figure "${figure}" missing`).toContain(`data-home-figure="${figure}"`);
    }
    expect(html).toMatch(/Illustrative/);
  });

  it('the v4 sections render in order: resolution, flow, arc, roles, packet, employers, limits', () => {
    const html = renderHomepageHtml();
    const order = [
      'data-home-hero',
      'data-home-resolution',
      'id="flow"',
      'id="arc"',
      'data-home-opportunity-horizon',
      'data-home-truth-boundary',
      'id="packet"',
      'id="employers"',
      'id="limits"',
      'data-home-source-cadence',
    ];
    let cursor = -1;
    for (const marker of order) {
      const at = html.indexOf(marker);
      expect(at, `section marker ${marker} missing`).toBeGreaterThan(-1);
      expect(at, `section marker ${marker} out of order`).toBeGreaterThan(cursor);
      cursor = at;
    }
  });

  it('the locked F copy rows render', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('Start working');
    expect(html).toContain('sooner.');
    expect(html).toContain('One record, once');
    expect(html).toContain('every job after it');
    expect(html).toContain('The record, as sources return it');
    expect(html).toContain('what it refuses');
    expect(html).toContain('Ten digits. Then');
  });

  it('the tally caption is verbatim and the durations carry the honesty note', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('Counts are of lanes, not a score. VitalCV does not grade clinicians.');
    expect(html).toContain('data-home-duration-note');
    expect(html).toContain('Durations are pilot targets, not returned data');
  });

  it('teaches five states, no others — the sixth (adverse · under dispute) never returns', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('data-home-state-legend');
    expect(html).toContain('Five states, no others');
    expect(html).not.toMatch(/adverse/i);
    expect(html).not.toMatch(/under dispute/i);
    // Every stamp pairs glyph and word (EC-4): the legend carries all five.
    for (const word of ['Source-confirmed', 'Snapshot', 'Needs you', 'Access required', 'Not checked']) {
      expect(html, `legend state word "${word}" missing`).toContain(word);
    }
  });

  it('every illustrative NPI is masked — no ten-digit sequence in the idle render', () => {
    const html = renderHomepageHtml();
    expect(html).toContain('NPI ··· ··· ····');
    expect(html).not.toMatch(/\d{10}/);
  });

  it('names no real employer, source fixture, or founder-file specific', () => {
    const html = renderHomepageHtml();
    for (const stripped of [
      'Meridian Health', 'UCSF', 'ABIM', 'ABMS', 'A-96421', 'MD187254',
      'PKT-2026', 'sha256', 'vitalcv.com/verify/', '1043002765',
    ]) {
      expect(html, `founder-file fixture "${stripped}" survived the port`).not.toContain(stripped);
    }
    // The category stays ours: VitalCV is not a job board (founder UX audit,
    // 2026-08-16), and NPDB is never a customer-facing noun (EC-3).
    expect(html.toLowerCase()).not.toContain('job board');
    expect(html).not.toContain('NPDB');
  });

  /**
   * Amendment F action semantics: the page action is the paper-inverse ink
   * instrument; the signal is indigo; the reserved severity red never renders
   * on `/`, and the stylesheet may not reference it.
   */
  it('severity red never reaches the homepage register', () => {
    const html = renderHomepageHtml();
    expect(html).not.toContain('--vt-severity-critical');
    expect(html).not.toMatch(/#B91C1C/i);
    const css = readFileSync(join(__dirname, '../styles/easy-home.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    expect(css).not.toContain('--vt-severity-critical');
    expect(css).not.toContain('backdrop-filter');
    expect(css).not.toContain('--vt-home-d-');
    expect(css).not.toContain('--vt-home-e-');
  });

  it('holds the amendment F text-node budget', () => {
    const html = renderHomepageHtml();
    const count = countTextNodes(html);
    console.info(`[composition gate] homepage prose text nodes: ${count} / 285`);
    // Measured 259 on 2026-08-16 at the F recomposition's landing. The v4
    // document is deliberately denser than E.1 (the founder's composition
    // carries the resolution scene, trust flow, arc, packet shape and
    // employer ledger), so amendment F supersedes the E.1 ceiling of 110
    // with the measured value plus ~10% headroom. Fund additions with cuts
    // from here — the ceiling only ever goes down between amendments.
    expect(
      count,
      `the homepage renders ${count} prose text nodes — the amendment F budget is 285; ` +
        'fund new copy with duplication cuts, not growth',
    ).toBeLessThanOrEqual(285);
  });
});
