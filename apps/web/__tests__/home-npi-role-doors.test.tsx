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
    expect(first, 'category statement sits inside the product story, not the hero').toBeGreaterThan(
      html.indexOf('data-home-sticky-product-story'),
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

describe('HomePageClient — pinned product story', () => {
  it('renders one scroll-linked five-step story with every product card in the DOM', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-sticky-product-story');
    expect(html).toContain('data-home-loop');
    for (const step of ['recognize', 'prepare', 'match', 'apply', 'accept']) {
      expect(html).toContain(`data-story-card="${step}"`);
    }
  });

  it('preserves the canonical labels and the employer review boundary', () => {
    const html = renderHomepage();
    for (const label of ['Recognize', 'Prepare', 'Match', 'Apply', 'Accept']) {
      expect(html).toContain(label);
    }
    expect(html).toContain('VitalCV Recognition');
    expect(html).toContain('institution review remains the final step');
  });
});

describe('HomePageClient — product carousel and rail', () => {
  it('renders the six carousel cards in a continuous flow with a pause control', () => {
    // Continuous flow (Chris, 2026-07-17) replaced discrete auto-advance. The
    // guard pins the accessibility contract that makes a marquee defensible:
    // a visible pause control ships in the SSR markup, and the server render
    // carries exactly ONE copy of each card (the seam-hiding duplicate is a
    // client-only, aria-hidden presentation detail).
    const html = renderHomepage();
    expect(html).toContain('data-home-product-carousel');
    expect(html).toContain('data-carousel-flow="continuous"');
    for (const product of ['wallet', 'readiness', 'matcha', 'apply', 'recognition', 'reuse']) {
      const occurrences = html.split(`data-carousel-card="${product}"`).length - 1;
      expect(occurrences, `${product} card renders once in SSR`).toBe(1);
    }
    expect(html).toContain('data-carousel-autoplay');
    expect(html).toContain('aria-label="Pause the product flow"');
  });

  it('renders direct section links in the required order', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-section-rail');
    const links = ['#wallet', '#readiness', '#matcha', '#apply', '#employers'];
    let previous = -1;
    for (const href of links) {
      const index = html.indexOf(`href="${href}"`);
      expect(index).toBeGreaterThan(previous);
      previous = index;
    }
  });
});

describe('HomePageClient — consolidated story and truth boundary', () => {
  it('keeps exactly the requested core experiences and removes duplicate legacy grids', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-hero');
    expect(html).toContain('data-home-sticky-product-story');
    expect(html).toContain('data-home-evidence-truth');
    expect(html).toContain('data-home-product-carousel');
    expect(html).toContain('data-home-experience="metrics-and-cta"');

    for (const removed of [
      'data-home-workflow-tabs',
      'data-home-outcome-triad',
      'data-home-moat',
      'data-home-value',
      'data-home-audiences',
      'data-home-role-doors',
      'data-home-proof-strip',
    ]) {
      expect(html).not.toContain(removed);
    }
  });

  it('retains the single technical evidence panel and explicit limits', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-evidence-trace');
    expect(html).toContain('data-home-truth-boundary');
    expect(html).toContain('Evidence trace');
    expect(html).toContain('What this does not mean');
    expect(html).toContain('This is not a completed credentialing, privileging, or employer clearance decision.');
  });

  it('ships the evidence statement complete and unpinned before JavaScript', () => {
    const html = renderHomepage();
    expect(html).toContain('data-scrub-heading="static"');
    expect(html).toContain('Every claim shows its source.');
    // The heading now inks in place (variant="ink") — no scene, and crucially
    // no pinned runway. The pin's 124vh of blank paper was the homepage's "too
    // much empty space"; it must not return.
    expect(html).not.toContain('data-scrub-scene');
    expect(html).not.toContain('data-scrub-pin=""');
  });

  it('keeps only real metrics and the dual-audience close', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-metric-strip');
    expect(html).toContain('NPPES · OIG/LEIE · PECOS');
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
