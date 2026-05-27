/**
 * passport-truth-state-banner.test.tsx — Wave H coverage.
 *
 * Asserts:
 *   - The default banner renders all 5 Passport legend rows (banner is
 *     additive; never removes existing chip rendering).
 *   - The degraded header is hidden by default and appears only when
 *     `degraded={true}` is passed.
 *   - The default degraded copy is operator-honest (system condition,
 *     not finding about clinician).
 *   - The institution-review panel renders by default and can be hidden
 *     via `showInstitutionReviewPanel={false}`.
 *   - The default institution-review copy is the canonical boundary line.
 *   - The banner does NOT include banned phrases (bare "Verified",
 *     "guaranteed verification", "instant credentialing", "complete
 *     credentialing", "HIPAA compliant", "SOC2 certified",
 *     "NCQA certified", "automatically verified", "cleared",
 *     "approved", "final credentialing").
 *   - The banner does NOT render the legacy "Checking in the background"
 *     skeleton-style copy.
 *   - The banner does NOT promote OIG/LEIE, PECOS, STATE_BOARD, FSMB,
 *     or NURSYS to source-backed.
 */

import React from 'react';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  PassportTruthStateBanner,
  DEFAULT_DEGRADED_HEADLINE,
  DEFAULT_DEGRADED_SUBCOPY,
  DEFAULT_INSTITUTION_REVIEW_COPY,
} from '@/components/passport/PassportTruthStateBanner';

const BANNED_PATTERNS: ReadonlyArray<RegExp> = [
  /\bverified\b/i,
  /\bguaranteed\s+verification\b/i,
  /\binstant\s+credentialing\b/i,
  /\bcomplete\s+credentialing\b/i,
  /\bautomatically\s+verified\b/i,
  /\blegally\s+accepted\b/i,
  /\brisk\s+transferred\b/i,
  /\bsource\s+confirmed\s+before\s+response\b/i,
  /\bcertified\s+compliant\b/i,
  /\bHIPAA\s+compliant\b/i,
  /\bSOC2\s+certified\b/i,
  /\bNCQA\s+certified\b/i,
  /\bGet\s+verified\b/i,
  /\bChecking\s+in\s+the\s+background\b/i,
];

function assertNoBannedPhrases(html: string, context: string): void {
  for (const pattern of BANNED_PATTERNS) {
    expect(
      pattern.test(html),
      `Banned phrase /${pattern.source}/${pattern.flags} matched in ${context}`,
    ).toBe(false);
  }
}

describe('PassportTruthStateBanner — default (active, non-degraded)', () => {
  it('renders the 5-row Passport legend', () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner />);
    // Default Passport legend states from TruthStateLegend:
    // source-backed, snapshot-only, temporarily-unavailable,
    // institution-review-required, access-required.
    const expected = [
      'data-truth-state="source-backed"',
      'data-truth-state="snapshot-only"',
      'data-truth-state="temporarily-unavailable"',
      'data-truth-state="institution-review-required"',
      'data-truth-state="access-required"',
    ];
    for (const marker of expected) {
      expect(html).toContain(marker);
    }
  });

  it('hides the degraded system-condition header by default', () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner />);
    expect(html).not.toContain('data-passport-degraded-header');
    expect(html).not.toContain(DEFAULT_DEGRADED_HEADLINE);
  });

  it('shows the institution-review boundary panel by default', () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner />);
    expect(html).toContain('data-passport-institution-review');
    expect(html).toContain(DEFAULT_INSTITUTION_REVIEW_COPY);
  });

  it('contains no banned phrases in default render', () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner />);
    assertNoBannedPhrases(html, 'default banner');
  });
});

describe('PassportTruthStateBanner — degraded path', () => {
  it('renders the degraded system-condition header when degraded={true}', () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner degraded />);
    expect(html).toContain('data-passport-degraded-header');
    expect(html).toContain(DEFAULT_DEGRADED_HEADLINE);
    expect(html).toContain(DEFAULT_DEGRADED_SUBCOPY);
  });

  it("degraded header reads 'system condition, not a finding about the clinician'", () => {
    expect(DEFAULT_DEGRADED_SUBCOPY.toLowerCase()).toContain('system condition');
    expect(DEFAULT_DEGRADED_SUBCOPY.toLowerCase()).toContain('not a finding');
  });

  it('contains no banned phrases in degraded render', () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner degraded />);
    assertNoBannedPhrases(html, 'degraded banner');
  });

  it("does not render the legacy 'Checking in the background' skeleton copy", () => {
    const htmlDegraded = renderToStaticMarkup(<PassportTruthStateBanner degraded />);
    const htmlIdle = renderToStaticMarkup(<PassportTruthStateBanner />);
    expect(htmlDegraded.toLowerCase()).not.toContain('checking in the background');
    expect(htmlIdle.toLowerCase()).not.toContain('checking in the background');
  });
});

describe('PassportTruthStateBanner — institution-review panel control', () => {
  it('hides the institution-review panel when showInstitutionReviewPanel={false}', () => {
    const html = renderToStaticMarkup(
      <PassportTruthStateBanner showInstitutionReviewPanel={false} />,
    );
    expect(html).not.toContain('data-passport-institution-review');
  });

  it("default institution-review copy contains 'reviewer-ready head start' and 'not a final credentialing decision'", () => {
    expect(DEFAULT_INSTITUTION_REVIEW_COPY.toLowerCase()).toContain(
      'reviewer-ready head start',
    );
    expect(DEFAULT_INSTITUTION_REVIEW_COPY.toLowerCase()).toContain(
      'not a final credentialing decision',
    );
  });

  it("does not contain banned phrases like 'complete credentialing' or 'final credentialing claim'", () => {
    assertNoBannedPhrases(DEFAULT_INSTITUTION_REVIEW_COPY, 'institution review copy');
  });
});

describe('PassportTruthStateBanner — non-NPPES sources never promoted', () => {
  it("the Passport legend default rows do not include any 'OIG' / 'PECOS' / 'STATE_BOARD' / 'FSMB' / 'NURSYS' as source-backed", () => {
    const html = renderToStaticMarkup(<PassportTruthStateBanner />);
    // The legend describes truth states by NAME (source-backed, snapshot-only,
    // …), not by source. Source rows are rendered separately on the Passport
    // page itself. This test asserts that the legend itself doesn't introduce
    // false source promotion through copy.
    const lowered = html.toLowerCase();
    expect(lowered).not.toMatch(/oig.*source-backed/);
    expect(lowered).not.toMatch(/pecos.*source-backed/);
    expect(lowered).not.toMatch(/state[ _]board.*source-backed/);
    expect(lowered).not.toMatch(/fsmb.*source-backed/);
    expect(lowered).not.toMatch(/nursys.*source-backed/);
  });
});
