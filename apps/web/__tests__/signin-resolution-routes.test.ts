/**
 * Wave 2B P0 fix — route classification for the sign-in role-resolution flow.
 * The interstitial must be public (else the middleware would loop trying to
 * authorize the very page that resolves the role), and the protected surfaces
 * must still require their role.
 */
import { describe, expect, it } from 'vitest';

import { UserRole, getRequiredRole, isPublicRoute } from '@/lib/auth/roles';

describe('sign-in resolution routes', () => {
  it('treats the resolver interstitial as public', () => {
    expect(isPublicRoute('/auth/resolving')).toBe(true);
  });

  it('keeps /auth/error public', () => {
    expect(isPublicRoute('/auth/error')).toBe(true);
  });

  it('does not gate the interstitial behind a role', () => {
    expect(getRequiredRole('/auth/resolving')).toBeNull();
  });

  it('still gates the clinician surface behind CLINICIAN', () => {
    expect(isPublicRoute('/holder')).toBe(false);
    expect(getRequiredRole('/holder')).toBe(UserRole.CLINICIAN);
    expect(getRequiredRole('/holder/readiness')).toBe(UserRole.CLINICIAN);
  });
});
