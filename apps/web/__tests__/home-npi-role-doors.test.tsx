/**
 * home-npi-role-doors.test.tsx — Visible Product Wave coverage.
 *
 * Asserts the homepage renders:
 *   - the Career Evidence Network eyebrow + clinician-value headline + subhead,
 *   - "Check readiness" as the primary NPI CTA label,
 *   - a "Sign in" secondary link,
 *   - the five-step "how it works" loop,
 *   - the "what you get" value cards (wallet / readiness / recognition /
 *     proof / opportunities / time-to-start),
 *   - three role doors (Clinician / Verifier≡Employer / Issuer)
 *     each with the documented action label,
 *   - a three-column proof strip (Source / State / Review boundary),
 *   - a trust footer row (Status / Source attribution / Trust),
 *   - zero banned phrases anywhere on the rendered surface.
 *
 * The component is a client component that depends on `next/navigation`
 * and `@clerk/nextjs`. We render the inner content by reaching into the
 * exported component via a server-side static render — Clerk providers
 * are not exercised in vitest, so SignedIn returns null, which matches
 * the unauthenticated public surface.
 */

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Stub next/navigation — server-side render does not need real router.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: () => undefined, replace: () => undefined }),
}));

// Stub @clerk/nextjs — SignedIn returns null when no provider in scope.
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

function assertNoBannedPhrases(html: string): void {
  for (const pattern of BANNED_PATTERNS) {
    expect(
      pattern.test(html),
      `Banned phrase /${pattern.source}/${pattern.flags} matched`,
    ).toBe(false);
  }
}

describe('HomePageClient — clinician-value hero', () => {
  it('renders the clinician-value eyebrow and the career-velocity headline', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    // Sprint 1 (2026-07-15, Chris): clinician-led hero. The strategic category
    // ("Provider Career Evidence Network") moved lower on the page — it still
    // renders as "career evidence network" in the compounding-moat section.
    expect(html).toContain('data-home-eyebrow');
    expect(html).toContain('Your career evidence, ready before your next job.');
    expect(html).toContain('Your credentials should move as fast as');
    expect(html).toContain('your career.');
    expect(html).toContain('career evidence network');
  });

  it('renders the NPI-first subhead (clarity pass — one confident sentence)', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-hero-subhead');
    expect(html).toContain('Enter your NPI to see what employers can confirm today');
    expect(html).toContain('still needs review');
    expect(html).toContain('the next step toward being ready to start');
  });

  it('renders "Check readiness" as the primary CTA label', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-primary-cta');
    expect(html).toMatch(/Check readiness[^<]*<svg/);
  });

  it('renders a "Sign in" secondary link', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-secondary-cta');
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('>Sign in<');
  });
});

describe('HomePageClient — how-it-works loop', () => {
  it('renders the five loop steps', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-loop');
    for (const n of ['1', '2', '3', '4', '5']) {
      expect(html).toContain(`data-home-loop-step="${n}"`);
    }
  });

  it('names the canonical clinician path in the loop copy', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Start with your NPI');
    expect(html).toContain('We check primary sources');
    expect(html).toContain('Get your readiness snapshot');
    expect(html).toContain('Share an employer-ready packet');
    expect(html).toContain('Get accepted as a head start');
  });
});

describe('HomePageClient — value cards', () => {
  it('renders the six value cards', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-value');
    for (const key of [
      'wallet',
      'readiness',
      'recognition',
      'proof',
      'opportunities',
      'time-to-start',
    ]) {
      expect(html).toContain(`data-home-value-card="${key}"`);
    }
  });

  it('communicates the clinician product in the value copy', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('A free career wallet you own');
    expect(html).toContain('NPI-first readiness');
    expect(html).toContain('VitalCV Recognition');
    expect(html).toContain('Shareable proof');
    expect(html).toContain('Opportunity matching');
    expect(html).toContain('Start working faster');
    // MATCHA named as the matching engine (a substrate, not the headline).
    expect(html).toContain('MATCHA');
  });
});

describe('HomePageClient — compounding-network (moat) section', () => {
  it('renders the moat section with its three compounding cards', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-moat');
    expect(html).toContain('data-home-moat-card="own"');
    expect(html).toContain('data-home-moat-card="compound"');
    expect(html).toContain('data-home-moat-card="network"');
  });

  it('makes the moat legible: owned evidence, compounding acceptance, network velocity', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Career evidence that');
    expect(html).toContain('makes every move faster than the last');
    expect(html).toContain('Nothing resets when you move');
    expect(html).toContain('Every yes makes the next yes easier');
    expect(html).toContain('Time-to-Start');
    expect(html).toContain('re-answering what a primary source already answered');
  });

  it('states the shared loop and frames 10× strictly as the goal, not a claim', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('RECOGNITION → ACCEPTANCE → START');
    expect(html).toContain('the loop every VitalCV user shares');
    // Honesty guard: the 10× line must stay framed as the goal we build
    // against — never an achieved/promised outcome.
    expect(html).toContain(
      'The goal we build against: starting your next role 10× faster than the credentialing status quo.',
    );
    expect(/10×\s+faster\s+guaranteed/i.test(html)).toBe(false);
  });
});

describe('HomePageClient — role doors', () => {
  it('renders three role doors (verifier ≡ employer are one group)', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-role-doors');
    expect(html).toContain('data-home-role-door="clinician"');
    expect(html).toContain('data-home-role-door="verifier"');
    expect(html).toContain('data-home-role-door="issuer"');
    // Employer is folded into the verifier door — not a separate door.
    expect(html).not.toContain('data-home-role-door="employer"');
  });

  it('states the shared outcome all three roles converge on', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain(
      'Three doors, one shared outcome — a clinician hired and started, faster.',
    );
  });

  it('each role door advertises its canonical action label', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Claim my NPI record'); // clinician
    expect(html).toContain('Look up an NPI'); // verifier / employer (merged blurb)
    expect(html).toContain('Review a passport'); // verifier / employer (action)
    expect(html).toContain('Connect a source'); // issuer
  });
});

describe('HomePageClient — proof strip', () => {
  it('renders the three proof-strip columns', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-proof-strip');
    expect(html).toContain('data-home-proof-col="source"');
    expect(html).toContain('data-home-proof-col="state"');
    expect(html).toContain('data-home-proof-col="review-boundary"');
  });

  it('proof-strip copy names source / state / review boundary in operator-honest language', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Every field names the primary source');
    // "Source-backed" appears in the state column as part of operator-honest copy.
    expect(html).toMatch(/Source-backed,\s+gated,\s+or\s+temporarily\s+unavailable/);
    expect(html).toContain(
      'Institution review remains the final step.',
    );
  });
});

describe('HomePageClient — trust footer row', () => {
  it('renders the footer trust row with three links', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-trust-footer');
    expect(html).toContain('href="/status"');
    expect(html).toContain('href="/trust/attribution"');
    expect(html).toContain('href="/trust"');
  });
});

describe('HomePageClient — banned-phrase scan', () => {
  it('contains no banned phrases anywhere in the rendered HTML', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    assertNoBannedPhrases(html);
  });

  it('does NOT contain "Get verified" (per Wave I hard constraint)', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(/\bGet\s+verified\b/i.test(html)).toBe(false);
  });

  it('does NOT contain "accepted everywhere" (per Wave I hard constraint)', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(/\baccepted\s+everywhere\b/i.test(html)).toBe(false);
  });
});
