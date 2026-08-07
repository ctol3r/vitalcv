/**
 * `/design/*` is gated in canonical production.
 *
 * These are frozen design references — `/design/wave1501` still renders the
 * drag-rotate constellation CD-13 retired, and that is CORRECT for a reference.
 * What was wrong is that it answered 200 to the public, so doctrine and history
 * were in direct conflict: either the reference lies about the past, or
 * production ships a retired mechanism. Gating the route resolves it without
 * having to pick.
 *
 * robots.txt already said `Disallow: /design/`, which is a request to crawlers,
 * not an access control. It did nothing about a pasted link.
 */

import { describe, expect, it } from 'vitest';
import { isDesignPreviewAllowed } from '@/lib/design/preview';

describe('isDesignPreviewAllowed', () => {
  it('allows previews outside production', () => {
    expect(isDesignPreviewAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(isDesignPreviewAllowed({ NODE_ENV: 'test' })).toBe(true);
  });

  it('blocks canonical Railway production', () => {
    expect(
      isDesignPreviewAllowed({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT: 'production' }),
    ).toBe(false);
  });

  it('blocks canonical Vercel production', () => {
    expect(isDesignPreviewAllowed({ NODE_ENV: 'production', VERCEL_ENV: 'production' })).toBe(false);
  });

  it('cannot be overridden in canonical production, even with the flag set', () => {
    // The escape hatch must not open on the one environment the gate exists to
    // protect — that is how a gate becomes decorative.
    expect(
      isDesignPreviewAllowed({
        NODE_ENV: 'production',
        RAILWAY_ENVIRONMENT: 'production',
        DESIGN_PREVIEW: '1',
      }),
    ).toBe(false);
  });

  it('blocks a bare production build unless the flag is set', () => {
    expect(isDesignPreviewAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(isDesignPreviewAllowed({ NODE_ENV: 'production', DESIGN_PREVIEW: '1' })).toBe(true);
  });

  it('is not fooled by casing or padding on the environment name', () => {
    expect(
      isDesignPreviewAllowed({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT: '  PRODUCTION  ' }),
    ).toBe(false);
  });
});
