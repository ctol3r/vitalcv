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

describe('HomePageClient — hero and live NPI moment', () => {
  it('keeps the clinician-led headline, live NPI control, and immediate lookup action', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-hero');
    expect(html).toContain('Find the opportunity. Prove your career');
    expect(html).toContain('aria-label="NPI number"');
    expect(html).toContain('data-home-primary-cta');
    expect(html).toContain('Check readiness');
    expect(html).toContain('No account required');
  });

  it('keeps the complete five-part scroll narrative in the DOM', () => {
    const html = renderHomepage();
    expect(html).toContain('data-home-hero-subhead');
    // The complete narrative remains present without reserving a pinned hero
    // runway; the NPI action belongs in the opening viewport.
    expect(html).toContain('hero-compact');
    expect(html).toContain('data-home-hero-stage');
    for (const phrase of [
      'recognizes your identity',
      'checks the primary sources',
      'shows what still needs review',
      'matches the right opportunity',
      'carries your evidence forward',
    ]) {
      expect(html).toContain(phrase);
    }
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
  it('renders the six requested carousel cards with accessible auto-advance', () => {
    // Auto-advance deliberately reverses the wave's original no-autoplay rule
    // (Chris, 2026-07-16). The guard now pins the accessibility contract that
    // makes it defensible: a visible pause control ships in the SSR markup.
    const html = renderHomepage();
    expect(html).toContain('data-home-product-carousel');
    for (const product of ['wallet', 'readiness', 'matcha', 'apply', 'recognition', 'reuse']) {
      expect(html).toContain(`data-carousel-card="${product}"`);
    }
    expect(html).toContain('data-carousel-autoplay');
    expect(html).toContain('aria-label="Pause auto-advance"');
    expect(html).toContain('aria-label="Previous product"');
    expect(html).toContain('aria-label="Next product"');
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

  it('ships the cinematic statement complete and unpinned before JavaScript', () => {
    const html = renderHomepage();
    expect(html).toContain('data-scrub-scene');
    expect(html).toContain('data-scrub-heading="static"');
    expect(html).toContain('Every claim carries\nits source, its state,\nand its limits.');
    // The runway only exists after hydration confirms motion is allowed.
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
