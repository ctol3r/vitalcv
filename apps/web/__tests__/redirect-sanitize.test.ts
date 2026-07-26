/**
 * Wave 2B P0 fix — the /auth/resolving interstitial navigates to `redirect_url`
 * after minting the role cookie. This pins the open-redirect guard.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_POST_RESOLVE_PATH, sanitizeInternalPath } from '@/lib/auth/redirect';

describe('sanitizeInternalPath', () => {
  it('keeps a same-origin absolute path (with query)', () => {
    expect(sanitizeInternalPath('/holder')).toBe('/holder');
    expect(sanitizeInternalPath('/holder/opportunities?apply=abc')).toBe(
      '/holder/opportunities?apply=abc',
    );
    expect(sanitizeInternalPath('/holder/blockers/expiring-license')).toBe(
      '/holder/blockers/expiring-license',
    );
  });

  it('falls back for empty / nullish input', () => {
    expect(sanitizeInternalPath(null)).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath(undefined)).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath('')).toBe(DEFAULT_POST_RESOLVE_PATH);
  });

  it('rejects absolute URLs and non-slash values (no open redirect)', () => {
    expect(sanitizeInternalPath('https://evil.example.com')).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath('http://evil.example.com/x')).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath('evil.example.com')).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath('javascript:alert(1)')).toBe(DEFAULT_POST_RESOLVE_PATH);
  });

  it('rejects protocol-relative and backslash tricks', () => {
    expect(sanitizeInternalPath('//evil.example.com')).toBe(DEFAULT_POST_RESOLVE_PATH);
    expect(sanitizeInternalPath('/\\evil.example.com')).toBe(DEFAULT_POST_RESOLVE_PATH);
  });

  it('rejects control characters', () => {
    expect(sanitizeInternalPath(`/holder${String.fromCharCode(10)}x`)).toBe(
      DEFAULT_POST_RESOLVE_PATH,
    );
    expect(sanitizeInternalPath(`/holder${String.fromCharCode(0)}`)).toBe(
      DEFAULT_POST_RESOLVE_PATH,
    );
    expect(sanitizeInternalPath(`/holder${String.fromCharCode(127)}`)).toBe(
      DEFAULT_POST_RESOLVE_PATH,
    );
  });

  it('honors a custom fallback', () => {
    expect(sanitizeInternalPath(null, '/sign-in')).toBe('/sign-in');
  });
});
