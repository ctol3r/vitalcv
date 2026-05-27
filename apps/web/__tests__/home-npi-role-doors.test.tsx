/**
 * home-npi-role-doors.test.tsx — Wave I coverage.
 *
 * Asserts the homepage renders:
 *   - the canonical NPI-first headline + subhead,
 *   - "Look up an NPI" as the primary CTA label,
 *   - a "Sign in" secondary link,
 *   - four role doors (Verifier / Clinician / Employer / Issuer)
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

describe('HomePageClient — NPI-first hero', () => {
  it('renders the canonical hero headline and subhead', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Look up an NPI.');
    expect(html).toContain('data-home-hero-subhead');
    expect(html).toContain(
      'See what is source-backed, what is gated, and what still needs institution review.',
    );
  });

  it('renders "Look up an NPI" as the primary CTA label', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-primary-cta');
    expect(html).toMatch(/Look up an NPI[^<]*<svg/);
  });

  it('renders a "Sign in" secondary link', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-secondary-cta');
    expect(html).toContain('href="/sign-in"');
    expect(html).toContain('>Sign in<');
  });
});

describe('HomePageClient — role doors', () => {
  it('renders four role doors', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('data-home-role-doors');
    expect(html).toContain('data-home-role-door="verifier"');
    expect(html).toContain('data-home-role-door="clinician"');
    expect(html).toContain('data-home-role-door="employer"');
    expect(html).toContain('data-home-role-door="issuer"');
  });

  it('each role door advertises its canonical action label', () => {
    const html = renderToStaticMarkup(<HomePageClient />);
    expect(html).toContain('Look up an NPI'); // verifier (also matches the primary CTA above the doors)
    expect(html).toContain('Claim my NPI record'); // clinician
    expect(html).toContain('Review a passport'); // employer
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
