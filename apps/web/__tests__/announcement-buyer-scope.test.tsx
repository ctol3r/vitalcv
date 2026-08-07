/**
 * The announcement rail is a CLINICIAN acquisition strip ("The VitalCV Wallet
 * is free for clinicians → Check your NPI"). Buyer surfaces enforce a banned
 * vocabulary that includes "wallet" (buyer-proof-page.test.tsx), but that
 * guard renders page components only — the rail comes from the layout, so
 * production served the clinician pitch above the employer doorway anyway.
 * Found on the live /employers page during Wave 6 verification.
 *
 * These tests pin the path predicate; the component returns null for any
 * pathname the predicate matches.
 */
import { describe, expect, it } from 'vitest';

import { isBuyerSurfacePath } from '@/components/layout/AnnouncementRail';

describe('announcement rail buyer-surface scope', () => {
  it('suppresses every buyer acquisition and workspace surface', () => {
    for (const path of [
      '/employers',
      '/employer',
      '/employer/dashboard',
      '/employer/profile',
      '/pilot',
      '/review',
      '/review/request',
      '/for/cvo',
    ]) {
      expect(isBuyerSurfacePath(path), path).toBe(true);
    }
  });

  it('keeps the clinician pitch everywhere it belongs', () => {
    for (const path of ['/', '/onboarding', '/holder', '/verify/1234567893', '/trust', '/status', '/evidence-network']) {
      expect(isBuyerSurfacePath(path), path).toBe(false);
    }
  });

  it('does not over-match lookalike prefixes', () => {
    for (const path of ['/employersplus', '/reviewer', '/piloting', '/format']) {
      expect(isBuyerSurfacePath(path), path).toBe(false);
    }
  });

  it('treats a null pathname as a clinician surface (rail stays)', () => {
    expect(isBuyerSurfacePath(null)).toBe(false);
  });
});
