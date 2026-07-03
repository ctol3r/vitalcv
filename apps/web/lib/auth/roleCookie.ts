// apps/web/lib/auth/roleCookie.ts
//
// Signed, short-lived role cookie used by middleware to break the
// resolve-role redirect loop WITHOUT depending on Clerk session-token
// customization.
//
// Background: the production Clerk session token carries no `vitalcv.role`
// claim, so the middleware fast path (session.sessionClaims.vitalcv.role) is
// always empty and every request falls through to the /api/auth/resolve-role
// backend round-trip. The old code then redirected to ROLE_LANDING "to force a
// JWT refresh" — but the refreshed JWT still had no claim, producing an
// infinite redirect loop.
//
// Instead, once resolve-role returns a role we mint an HMAC-signed cookie and
// pass the request through. Subsequent requests read the cookie (fast, no
// backend hop) until it expires. If Clerk session-token customization is later
// enabled, the JWT fast path takes over and this cookie becomes a no-op.
//
// Security note: the middleware role check is a routing convenience, not the
// security boundary — every backend data call independently enforces Clerk auth
// + tenant context. The HMAC signature still prevents a user from forging a
// different role and landing in the wrong operator surface.
//
// Edge-runtime safe: uses only Web Crypto (crypto.subtle) + TextEncoder, no
// Node built-ins. Works in Next middleware (edge) and vitest (node ≥ 20).

import { UserRole, type UserRoleType } from './roles';

export const ROLE_COOKIE_NAME = 'vitalcv_role';

/** Default cookie lifetime. Short enough that a role change self-heals quickly. */
export const ROLE_COOKIE_TTL_SECONDS = 15 * 60; // 15 minutes

const VALID_ROLES = new Set<string>(Object.values(UserRole));

function getSecret(): string {
  return process.env.ROLE_COOKIE_SECRET || process.env.CLERK_SECRET_KEY || '';
}

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return new Uint8Array(signature);
}

/** Constant-time comparison to avoid signature-timing leaks. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) mismatch |= a[i] ^ b[i];
  return mismatch === 0;
}

/**
 * Sign a `role.exp.sig` cookie value. Returns null when no secret is
 * configured (caller should then simply not set the cookie — the resolve-role
 * fallback still works, just without caching).
 */
export async function signRoleCookie(
  role: UserRoleType,
  ttlSeconds: number = ROLE_COOKIE_TTL_SECONDS,
  nowMs: number = Date.now(),
): Promise<string | null> {
  const secret = getSecret();
  if (!secret) return null;
  const exp = Math.floor(nowMs / 1000) + ttlSeconds;
  const payload = `${role}.${exp}`;
  const signature = await hmac(secret, payload);
  return `${payload}.${base64UrlEncode(signature)}`;
}

/**
 * Verify a role cookie. Returns the role only when the signature is valid, the
 * value is unexpired, and the role is a known role. Any tampering, expiry, or
 * missing secret yields null.
 */
export async function verifyRoleCookie(
  value: string | undefined | null,
  nowMs: number = Date.now(),
): Promise<UserRoleType | null> {
  const secret = getSecret();
  if (!secret || !value) return null;

  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [role, expStr, sigB64] = parts;

  const payload = `${role}.${expStr}`;
  const expected = await hmac(secret, payload);
  const provided = base64UrlDecode(sigB64);
  if (!provided || !timingSafeEqual(expected, provided)) return null;

  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= Math.floor(nowMs / 1000)) return null;

  if (!VALID_ROLES.has(role)) return null;
  return role as UserRoleType;
}
