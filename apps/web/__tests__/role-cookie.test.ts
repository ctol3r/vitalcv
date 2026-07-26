// apps/web/__tests__/role-cookie.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ROLE_COOKIE_TTL_SECONDS,
  signRoleCookie,
  verifyRoleCookie,
} from '../lib/auth/roleCookie';

describe('roleCookie sign/verify', () => {
  beforeEach(() => {
    vi.stubEnv('ROLE_COOKIE_SECRET', 'test-secret-abc');
  });

  it('round-trips a signed role', async () => {
    const value = await signRoleCookie('CLINICIAN');
    expect(value).toBeTruthy();
    const role = await verifyRoleCookie(value);
    expect(role).toBe('CLINICIAN');
  });

  it('rejects a tampered role', async () => {
    const value = await signRoleCookie('CLINICIAN');
    // Swap the role segment but keep the original signature.
    const forged = value!.replace(/^CLINICIAN\./, 'ADMIN.');
    expect(await verifyRoleCookie(forged)).toBeNull();
  });

  it('rejects a tampered signature', async () => {
    const value = await signRoleCookie('VERIFIER');
    const [role, exp, sig] = value!.split('.');

    // Tamper the FIRST signature character, never the tail. The signature is 32
    // HMAC bytes in unpadded base64url — 43 characters, and 43 % 4 === 3, so the
    // FINAL character contributes only 2 significant bits. Sixteen distinct
    // characters decode to the same 32 bytes, so editing the tail can leave the
    // decoded signature identical; the verifier then accepts, correctly, and the
    // test fails for a reason that has nothing to do with signature checking.
    // The first character's six bits are all significant, so changing it always
    // changes byte 0.
    const forged = `${role}.${exp}.${sig[0] === 'A' ? 'B' : 'A'}${sig.slice(1)}`;
    expect(forged, 'the forgery must actually differ').not.toBe(value);
    expect(await verifyRoleCookie(forged)).toBeNull();
  });

  it('rejects an expired cookie', async () => {
    const past = Date.now() - (ROLE_COOKIE_TTL_SECONDS + 60) * 1000;
    const value = await signRoleCookie('CLINICIAN', ROLE_COOKIE_TTL_SECONDS, past);
    expect(await verifyRoleCookie(value)).toBeNull();
  });

  it('rejects an unknown role even if correctly signed structure', async () => {
    // A signature over a non-role payload must not validate as a role.
    const value = await signRoleCookie('NOT_A_ROLE' as never);
    expect(await verifyRoleCookie(value)).toBeNull();
  });

  it('rejects malformed values', async () => {
    expect(await verifyRoleCookie(undefined)).toBeNull();
    expect(await verifyRoleCookie('')).toBeNull();
    expect(await verifyRoleCookie('a.b')).toBeNull();
    expect(await verifyRoleCookie('a.b.c.d')).toBeNull();
  });

  it('returns null when no secret is configured', async () => {
    vi.stubEnv('ROLE_COOKIE_SECRET', '');
    vi.stubEnv('CLERK_SECRET_KEY', '');
    expect(await signRoleCookie('CLINICIAN')).toBeNull();
    // A previously valid-looking value cannot verify without a secret.
    expect(await verifyRoleCookie('CLINICIAN.9999999999.sig')).toBeNull();
  });

  it('falls back to CLERK_SECRET_KEY when ROLE_COOKIE_SECRET is unset', async () => {
    vi.stubEnv('ROLE_COOKIE_SECRET', '');
    vi.stubEnv('CLERK_SECRET_KEY', 'clerk-fallback-secret');
    const value = await signRoleCookie('ISSUER');
    expect(await verifyRoleCookie(value)).toBe('ISSUER');
  });
});
