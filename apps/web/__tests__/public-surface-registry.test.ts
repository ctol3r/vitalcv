import { describe, expect, it } from 'vitest';

import { isOpsSurfacePath, isPublicSurfacePath } from '@/components/layout/publicSurfaceRoutes';

/**
 * The chrome registry contract (2026-08-07 headerless-routes sweep).
 *
 * Navbar and Footer both `return null` off this registry, so membership IS
 * the header decision. Before this suite existed nothing pinned it, and the
 * sweep found 56 public routes headerless — including sitemap-indexed
 * marketing (/pricing) and the indexable registry page (/directory/[npi]).
 *
 * Two directions are pinned on purpose:
 *   - additions, so a refactor cannot silently drop a chromed route;
 *   - deliberate exclusions, so "helpfully" chroming an interstitial, a
 *     printable evidence artifact, or the dark onboarding StepShell — all
 *     classified chromeless by the sweep's disposition table
 *     (docs/design/shared-header-recovery/headerless-routes-disposition.md)
 *     — fails a test instead of shipping.
 */

describe('public surface registry — routes the chrome must cover', () => {
  const chromed = [
    '/',
    '/pricing',
    '/concierge',
    '/employers',
    '/employers/request-access',
    '/trust',
    '/onboarding',
    '/evidence-network',
    '/profile/activate',
    // Parameterized public-record surfaces (path params are synthetic
    // strings — matching is textual, no NPI semantics in scope here).
    '/directory/0000000000',
    '/profile/0000000000',
    '/investigate/0000000000',
  ];

  it.each(chromed)('%s renders with the public chrome', (route) => {
    expect(isPublicSurfacePath(route)).toBe(true);
    expect(isOpsSurfacePath(route)).toBe(false);
  });
});

describe('public surface registry — deliberate exclusions hold', () => {
  // Bucket B of the sweep disposition: chrome would break these.
  const chromeless = [
    '/auth/error', // redirect interstitial
    '/auth/resolving', // role-resolution interstitial (middleware target)
    '/onboarding/identity', // dark full-viewport StepShell composition
    '/onboarding/readiness',
    '/onboarding/fetching',
    '/receipt/some-receipt-id', // standalone printable/QR evidence artifact
    '/snapshot/some-share-id', // share-once artifact, fail-closed on 410
    '/status/technical', // dark ops console — bucket E, held for founder call
  ];

  it.each(chromeless)('%s stays chromeless', (route) => {
    expect(isPublicSurfacePath(route)).toBe(false);
  });

  it('keeps /onboarding chromed while its step children stay immersive', () => {
    // The registry matches exactly, so the parent carries chrome and the
    // dark steps do not — this asymmetry is intentional, not drift.
    expect(isPublicSurfacePath('/onboarding')).toBe(true);
    expect(isPublicSurfacePath('/onboarding/identity')).toBe(false);
  });

  it('covers /profile/activate via the /profile prefix, not a stale exact entry', () => {
    // Both the activation surface and the shared career profile ride the
    // same prefix; if the prefix is ever removed, both assertions fail.
    expect(isPublicSurfacePath('/profile/activate')).toBe(true);
    expect(isPublicSurfacePath('/profile/1234567893')).toBe(true);
  });
});
