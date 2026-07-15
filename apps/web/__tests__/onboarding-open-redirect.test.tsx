/**
 * open-redirect guard for internal redirect sanitization.
 *
 * The /onboarding transition page that reflected `?returnTo` into an <a href>
 * was replaced by the canonical activation flow (Wave 0B), so that specific
 * sink no longer exists. This keeps the security coverage on the shared
 * `sanitizeInternalPath` helper, which still guards the redirect_url the
 * role-resolution interstitial (/auth/resolving) navigates to.
 */
import { describe, expect, it } from 'vitest';

import { sanitizeInternalPath, DEFAULT_POST_RESOLVE_PATH } from '@/lib/auth/redirect';

describe('sanitizeInternalPath — open-redirect hardening', () => {
  it('rejects protocol-relative //host', () => {
    expect(sanitizeInternalPath('//evil.example', '/passport')).toBe('/passport');
  });

  it('rejects backslash /\\host tricks', () => {
    expect(sanitizeInternalPath('/\\evil.example', '/passport')).toBe('/passport');
  });

  it('rejects absolute URLs and control chars', () => {
    expect(sanitizeInternalPath('https://evil.example')).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath('/ok\nx')).toBe(DEFAULT_POST_RESOLVE_PATH);
  });

  it('allows a genuine internal path', () => {
    expect(sanitizeInternalPath('/holder/readiness')).toBe('/holder/readiness');
  });

  it('falls back when empty/nullish', () => {
    expect(sanitizeInternalPath('', '/passport')).toBe('/passport');
    expect(sanitizeInternalPath(undefined, '/passport')).toBe('/passport');
  });
});
