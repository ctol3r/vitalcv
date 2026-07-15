/**
 * auth-disclosure-card.test.tsx — Wave J coverage.
 *
 * Asserts the calm-disclosure chrome wraps Clerk's <SignIn /> / <SignUp />
 * primitives with the canonical operator-honest disclosure copy, the trust
 * footer links, and nothing that implies credentialing.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  AuthDisclosureCard,
  SIGN_IN_DISCLOSURE,
  SIGN_UP_DISCLOSURE,
  TRUST_FOOTER_LINKS,
} from '@/components/auth/AuthDisclosureCard';

const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\binstant\s+credentialing\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\bautomatically\s+verified\b/i,
  /\bGet\s+verified\b/i,
  /\bverify\s+your\s+email\s+to\s+get\s+verified\b/i,
  /\bHIPAA\s+compliant\b/i,
  /\bSOC2\s+certified\b/i,
  /\bNCQA\s+certified\b/i,
  /\baccepted\s+everywhere\b/i,
  /\bcleared\b/i,
  /\bapproved\b/i,
];

function assertNoBannedPhrases(html: string, context: string): void {
  for (const pattern of BANNED_PATTERNS) {
    expect(
      pattern.test(html),
      `Banned phrase /${pattern.source}/${pattern.flags} matched in ${context}`,
    ).toBe(false);
  }
}

describe('AuthDisclosureCard — sign-in mode', () => {
  it('renders the canonical sign-in disclosure copy', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-in">
        <div data-clerk-placeholder="" />
      </AuthDisclosureCard>,
    );
    expect(html).toContain('data-auth-disclosure-card="sign-in"');
    expect(html).toContain('data-auth-disclosure-copy="sign-in"');
    expect(html).toContain(SIGN_IN_DISCLOSURE);
  });

  it('sign-in disclosure names what signing in accesses (clinician-facing, Sprint 1)', () => {
    expect(SIGN_IN_DISCLOSURE.toLowerCase()).toContain('wallet');
    expect(SIGN_IN_DISCLOSURE.toLowerCase()).toContain('readiness');
    expect(SIGN_IN_DISCLOSURE.toLowerCase()).toContain('shared evidence');
  });

  it('sign-in disclosure confirms public passport pages remain readable without an account', () => {
    expect(SIGN_IN_DISCLOSURE.toLowerCase()).toContain('public passport pages');
    expect(SIGN_IN_DISCLOSURE.toLowerCase()).toContain('without an account');
  });

  it('mounts the supplied children (Clerk <SignIn /> placeholder)', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-in">
        <div data-clerk-placeholder="signin" />
      </AuthDisclosureCard>,
    );
    expect(html).toContain('data-auth-clerk-mount');
    expect(html).toContain('data-clerk-placeholder="signin"');
  });

  it('contains no banned phrases in sign-in mode', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-in">
        <div data-clerk-placeholder="" />
      </AuthDisclosureCard>,
    );
    assertNoBannedPhrases(html, 'sign-in card');
  });
});

describe('AuthDisclosureCard — sign-up mode', () => {
  it('renders the canonical sign-up disclosure copy', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-up">
        <div data-clerk-placeholder="" />
      </AuthDisclosureCard>,
    );
    expect(html).toContain('data-auth-disclosure-card="sign-up"');
    expect(html).toContain('data-auth-disclosure-copy="sign-up"');
    expect(html).toContain(SIGN_UP_DISCLOSURE);
  });

  it('sign-up disclosure says sign-up does NOT credential a clinician', () => {
    expect(SIGN_UP_DISCLOSURE.toLowerCase()).toContain('does not credential');
    expect(SIGN_UP_DISCLOSURE.toLowerCase()).toContain('clinician');
  });

  it('sign-up disclosure says sign-up does NOT contact employers', () => {
    expect(SIGN_UP_DISCLOSURE.toLowerCase()).toContain('does not contact');
    expect(SIGN_UP_DISCLOSURE.toLowerCase()).toContain('employers');
  });

  it('contains no banned phrases in sign-up mode', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-up">
        <div data-clerk-placeholder="" />
      </AuthDisclosureCard>,
    );
    assertNoBannedPhrases(html, 'sign-up card');
  });

  it('does NOT contain "verify your email to get verified" anywhere', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-up">
        <div data-clerk-placeholder="" />
      </AuthDisclosureCard>,
    );
    expect(/verify\s+your\s+email\s+to\s+get\s+verified/i.test(html)).toBe(false);
  });
});

describe('AuthDisclosureCard — trust footer', () => {
  it('renders three trust footer links', () => {
    const html = renderToStaticMarkup(
      <AuthDisclosureCard mode="sign-in">
        <div />
      </AuthDisclosureCard>,
    );
    expect(html).toContain('data-auth-trust-footer');
    for (const link of TRUST_FOOTER_LINKS) {
      expect(html).toContain(`href="${link.href}"`);
      expect(html).toContain(`>${link.label}<`);
    }
  });

  it('exports exactly the three Status / Source attribution / Trust links', () => {
    expect(TRUST_FOOTER_LINKS.map((l) => l.label)).toEqual([
      'Status',
      'Source attribution',
      'Trust',
    ]);
  });
});

describe('AuthDisclosureCard — copy review constants', () => {
  it('SIGN_IN_DISCLOSURE constant has no banned phrases', () => {
    assertNoBannedPhrases(SIGN_IN_DISCLOSURE, 'SIGN_IN_DISCLOSURE constant');
  });

  it('SIGN_UP_DISCLOSURE constant has no banned phrases', () => {
    assertNoBannedPhrases(SIGN_UP_DISCLOSURE, 'SIGN_UP_DISCLOSURE constant');
  });
});
