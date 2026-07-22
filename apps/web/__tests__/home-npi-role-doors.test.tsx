/** Homepage Motion Convergence Wave structural and truth-contract guards. */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@clerk/nextjs', () => ({
  SignedIn: ({ children }: { children: React.ReactNode }) => null,
}));

import HomePageClient from '@/app/HomePageClient';

const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\binstant\s+credentialing\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\bautomatically\s+verified\b/i,
  /\blegally\s+accepted\b/i,
  /\brisk\s+transferred\b/i,
  /\bcertified\s+compliant\b/i,
  /\bHIPAA\s+compliant\b/i,
  /\bSOC2\s+certified\b/i,
  /\bNCQA\s+certified\b/i,
  /\bGet\s+verified\b/i,
  /\baccepted\s+everywhere\b/i,
];

function renderHomepage(): string {
  return renderToStaticMarkup(<HomePageClient />);
}

describe('HomePageClient — hero and live NPI moment (HERO-RESET-1)', () => {
  it('leads with the clinician outcome and the exact NPI action', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-hero');
    // The outcome IS the headline. Category language is banned above the fold.
    expect(html).toMatch(/<h1[^>]*>Get hired <em[^>]*>faster\.<\/em><\/h1>/);
    expect(html).toContain('Start with your NPI');
    expect(html).toContain('aria-label="NPI number"');
    expect(html).toContain('data-home-primary-cta');
    expect(html).toContain('Check what’s ready');
    expect(html).toContain('Free for clinicians · No account required');
  });

  it('ships a static mechanism line — the scroll-scrub narrative is deleted', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-hero-subhead');
    expect(html).toContain(
      'Start with your NPI. See what employers can confirm, fix what is missing, and reuse your career profile for every job.',
    );
    // The compact-hero contract survives the reset; no runway returns.
    expect(html).toContain('hero-compact');
    expect(html).toContain('data-home-hero-stage');
    // The deleted effect and its sentence cannot linger in any form.
    expect(html).not.toContain('data-narrative-');
    expect(html).not.toContain('VitalCV recognizes your identity');
    for (const phrase of [
      'recognizes your identity',
      'checks the primary sources',
      'shows what still needs review',
      'matches the right opportunity',
      'carries your evidence forward',
    ]) {
      expect(html).not.toContain(phrase);
    }
  });

  it('moves the category statement below the fold, exactly once, in the story', () => {
    const html = renderHomepage();
    expect(html).not.toContain('data-home-eyebrow');
    const category = 'The clinician career evidence network';
    const first = html.indexOf(category);
    expect(first, 'category statement still exists on the page').toBeGreaterThan(-1);
    expect(first, 'category statement sits inside the journey story, not the hero').toBeGreaterThan(
      html.indexOf('data-home-journey'),
    );
    expect(html.indexOf(category, first + 1), 'category statement appears once').toBe(-1);
  });

  it('sits on the scoped Cloud Dancer paper without retheming anything else', () => {
    const html = renderHomepage();
    expect(html).toContain('mz-cloud-paper');
    // Route-scoped body paper: the style tag ships with the page and unmounts
    // with it, so no other surface inherits Cloud Dancer.
    expect(html).toContain('body{background:var(--vt-cloud-dancer,#F0EEE9)}');
  });
});

describe('HomePageClient — career journey rail (W2)', () => {
  it('renders the four journey chapters in DOM order with every card present', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-journey');
    expect(html).toContain('data-story-rail');
    let previous = -1;
    for (const id of ['readiness', 'matcha', 'apply', 'start']) {
      const index = html.indexOf(`data-journey-card="${id}"`);
      expect(index, `chapter card ${id} renders`).toBeGreaterThan(previous);
      previous = index;
    }
    // The retired story systems cannot linger in any form (W2.1/W2.3).
    for (const removed of [
      'data-home-sticky-product-story',
      'data-home-loop',
      'data-home-section-rail',
      'data-home-outline-panel',
      'data-story-card=',
    ]) {
      expect(html, `${removed} is retired`).not.toContain(removed);
    }
  });

  it('preserves the journey labels and the employer review boundary', () => {
    const html = renderHomepage();
    for (const label of ['See what is ready', 'Find roles that fit', 'Apply with proof', 'Start faster']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('VitalCV Recognition');
    expect(html).toContain('Institution review remains');
    expect(html).toContain('institution review remains the final step');
  });

  it('SSR is the vertical fallback: no pin, no transforms, chapters in flow', () => {
    const html = renderHomepage();
    expect(html).toContain('data-rail-pinned="false"');
    expect(html).toContain('story-rail-chapter-vertical');
    expect(html).not.toContain('story-rail-runway');
    // The chapter navigator is a pinned-mode enhancement — never in SSR.
    expect(html).not.toContain('data-story-rail-nav');
  });
});

describe('HomePageClient — product carousel and rail', () => {
  it('does NOT mount the product carousel — the rail already tells that story', () => {
    // ProductCarousel ("One career record. Six reusable surfaces.") is retired
    // from the composition. It was the third pass at "look what the record can
    // do", after the journey rail had already walked the same ground in four
    // chapters, and a six-panel feature carousel is a product-tour device on a
    // page whose job is one argument.
    //
    // The component stays on disk and keeps its own tests: its evidence-state
    // glyph grammar (a check glyph may appear ONLY on source-backed/checked
    // rows, never on gated or review rows) is a real truth contract, and
    // homepage-truth-pass.test.tsx renders ProductCarousel DIRECTLY to guard
    // it. That guard is unaffected by this section leaving the homepage.
    const html = renderHomepage();
    expect(html).not.toContain('data-home-product-carousel');
  });

  it('keeps the journey deep-link anchors resolvable in document order', () => {
    const html = renderHomepage();
    // The dot rail is retired (W2.3); the ids themselves remain the deep-link
    // contract — each journey chapter section carries its anchor.
    let previous = -1;
    for (const id of ['wallet', 'readiness', 'matcha', 'apply', 'employers']) {
      const index = html.indexOf(`id="${id}"`);
      expect(index, `#${id} anchor exists`).toBeGreaterThan(previous);
      previous = index;
    }
  });
});

describe('HomePageClient — consolidated story and truth boundary', () => {
  it('keeps exactly the requested core experiences and removes duplicate legacy grids', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-hero');
    expect(html).toContain('data-home-journey');
    expect(html).toContain('data-home-proof-moment');
    expect(html).toContain('data-home-truth-boundary');
    expect(html).toContain('data-home-experience="metrics-and-cta"');

    for (const removed of [
      'data-home-workflow-tabs',
      'data-home-outcome-triad',
      'data-home-moat',
      'data-home-value',
      'data-home-audiences',
      'data-home-role-doors',
      'data-home-proof-strip',
      // Retired in the homepage rebuild: each made an argument the page was
      // already making. ProblemStatBand restated the problem section, and
      // EvidenceTruthPanel restated HomeProofMoment immediately after it —
      // together ~1.4k px and two extra H2s for zero new information.
      'data-home-evidence-truth',
      'data-home-product-carousel',
    ]) {
      expect(html).not.toContain(removed);
    }
  });

  it('states each argument exactly once — one H2 per section', () => {
    // The redundancy this page kept regrowing was structural: two headings for
    // "the problem" and two for "the proof". Pin the shape, not the prose, so a
    // future section cannot quietly restate a neighbour.
    const html = renderHomepage();
    const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/g)].map((m) =>
      m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
    );
    expect(new Set(headings).size, `duplicate H2s: ${headings.join(' | ')}`).toBe(headings.length);
    expect(headings.length, `H2s rendered: ${headings.join(' | ')}`).toBeLessThanOrEqual(4);
  });

  it('mounts the interactive proof moment: illustrative, employer boundary, real-flow CTA (W4.2)', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-proof-moment');
    // The real, tested inspector — not a fresh mock dashboard.
    expect(html).toContain('data-proof-packet-inspector');
    // Explicitly illustrative, never a live result.
    expect(html).toContain('Illustrative — not a live result');
    // The employer-final boundary is stated in the proof moment.
    expect(html).toContain('remain with the institution');
    // Links the REAL clinician flow, not a dead-end demo.
    const ctaAt = html.indexOf('data-home-proof-cta');
    expect(ctaAt, 'proof CTA renders').toBeGreaterThan(-1);
    expect(html.slice(0, ctaAt).lastIndexOf('href="/onboarding"')).toBeGreaterThan(-1);
    // The proof moment sits after the journey, before the metrics/CTA close.
    expect(html.indexOf('data-home-proof-moment')).toBeGreaterThan(html.indexOf('data-home-journey'));
    expect(html.indexOf('data-home-proof-moment')).toBeLessThan(
      html.indexOf('data-home-experience="metrics-and-cta"'),
    );
  });

  it('keeps the explicit limits even though the panel that owned them is gone', () => {
    // This is the guard that matters most in the rebuild. EvidenceTruthPanel
    // was retired as redundant ARGUMENT, but it was the only place carrying the
    // enumerated limitation — and removing the wrapper silently removed the
    // sentence with it. A section being a redundant argument does not make its
    // disclaimers redundant guarantees, so the boundary moved to a shared
    // component mounted under the surviving proof section.
    const html = renderHomepage();
    expect(html).toContain('data-home-truth-boundary');
    expect(html).toContain('What VitalCV knows');
    expect(html).toContain('What this does not mean');
    expect(html).toContain(
      'This is not a completed credentialing, privileging, or employer clearance decision.',
    );
    expect(html).toContain('Institution review remains the final step.');
  });

  it('ships the boundary complete and unpinned before JavaScript', () => {
    const html = renderHomepage();
    // The pin's 124vh of blank paper was the homepage's "too much empty
    // space"; it must not return in any form.
    expect(html).not.toContain('data-scrub-scene');
    expect(html).not.toContain('data-scrub-pin=""');
    // The limitation is server-rendered text, not something a reveal or a
    // client effect can withhold.
    expect(html).toContain('What this does not mean');
  });

  it('keeps only real metrics and the dual-audience close', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-metric-strip');
    // The three federal lanes are named WITH their real freshness: only NPPES
    // is a live read, OIG/LEIE and PECOS are dated snapshots. The previous
    // pin ('NPPES · OIG/LEIE · PECOS') sat under a "lanes, live" label that
    // overclaimed all three as live.
    expect(html).toContain('NPPES live · OIG/LEIE + PECOS snapshot');
    expect(html).not.toContain('federal source lanes, live');
    expect(html).toContain('No pilot outcomes are claimed');
    expect(html).toContain('data-home-dual-cta');
    expect(html).toContain('final credentialing authority');
  });

  it('contains no banned public claims', () => {
    const html = renderHomepage();
    for (const pattern of BANNED_PATTERNS) {
      expect(pattern.test(html), `Banned phrase /${pattern.source}/${pattern.flags} matched`).toBe(false);
    }
  });
});
