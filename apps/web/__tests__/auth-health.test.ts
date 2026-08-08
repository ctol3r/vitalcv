/**
 * Wave 0.1 — fail-closed auth-config health + the Docker build guard.
 *
 * The incident this locks down: 18c9311 built without the Clerk publishable
 * key (apps/web/Dockerfile declared no ARG for it), so prerenders + the client
 * bundle compiled auth-off while runtime env was fully configured.
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

import { evaluateAuthHealth } from '@/lib/auth/authHealth';

describe('evaluateAuthHealth — fail-closed matrix', () => {
  const configured = {
    buildTimeClerk: true,
    runtimePublishableKey: true,
    runtimeSecretKey: true,
    runtimeRoleCookieSecret: true,
    authExpected: true,
  };

  it('ok: production with build + runtime fully configured', () => {
    expect(evaluateAuthHealth(configured)).toMatchObject({ status: 'ok', httpStatus: 200 });
  });

  it('THE 18c9311 STATE: runtime configured but the build artifact lacks auth → 503', () => {
    const report = evaluateAuthHealth({ ...configured, buildTimeClerk: false });
    expect(report).toMatchObject({ status: 'build_artifact_missing_auth', httpStatus: 503 });
  });

  it('unavailable: production missing the runtime publishable key → 503', () => {
    expect(
      evaluateAuthHealth({ ...configured, runtimePublishableKey: false }),
    ).toMatchObject({ status: 'auth_config_unavailable', httpStatus: 503 });
  });

  it('unavailable: production missing the secret key → 503', () => {
    expect(
      evaluateAuthHealth({ ...configured, runtimeSecretKey: false }),
    ).toMatchObject({ status: 'auth_config_unavailable', httpStatus: 503 });
  });

  it('local/e2e builds without Clerk are honest but healthy (200)', () => {
    expect(
      evaluateAuthHealth({
        buildTimeClerk: false,
        runtimePublishableKey: false,
        runtimeSecretKey: false,
        runtimeRoleCookieSecret: false,
        authExpected: false,
      }),
    ).toMatchObject({ status: 'auth_disabled', httpStatus: 200 });
  });

  it('never reports key material, only presence booleans', () => {
    const report = evaluateAuthHealth(configured) as unknown as Record<string, unknown>;
    for (const value of Object.values(report)) {
      expect(['boolean', 'number', 'string']).toContain(typeof value);
    }
  });
});

/**
 * The rotation coupling, reported but never gated on.
 *
 * roleCookie.ts getSecret(): ROLE_COOKIE_SECRET || CLERK_SECRET_KEY || ''.
 * When the override is unset the role cookie is HMAC'd with the Clerk key, so
 * rotating that key invalidates every outstanding role cookie at once. The
 * rotation runbook instructed operators to check /api/health/auth for exactly
 * this, and the endpoint did not report it — a healthy response read as
 * "the override is set" when the endpoint had never looked.
 */
describe('evaluateAuthHealth — role-cookie coupling', () => {
  const base = {
    buildTimeClerk: true,
    runtimePublishableKey: true,
    runtimeSecretKey: true,
    runtimeRoleCookieSecret: true,
    authExpected: true,
  };

  it('override set: cookies are NOT signed with the Clerk key', () => {
    expect(evaluateAuthHealth(base)).toMatchObject({
      runtimeRoleCookieSecret: true,
      roleCookieSignedWithClerkKey: false,
    });
  });

  it('override unset with the Clerk key present: the fallback is LIVE', () => {
    expect(evaluateAuthHealth({ ...base, runtimeRoleCookieSecret: false })).toMatchObject({
      runtimeRoleCookieSecret: false,
      roleCookieSignedWithClerkKey: true,
    });
  });

  it('neither present: not reported as Clerk-signed, because signing is broken for another reason', () => {
    // getSecret() returns '' here. Claiming "signed with the Clerk key" would
    // point a rotation at a coupling that is not the actual problem.
    expect(
      evaluateAuthHealth({
        ...base,
        runtimeSecretKey: false,
        runtimeRoleCookieSecret: false,
      }),
    ).toMatchObject({ roleCookieSignedWithClerkKey: false });
  });

  it('THE POINT: the coupling never changes status or httpStatus', () => {
    // An unset override is a latent rotation hazard, not an outage — production
    // survives it indefinitely. 503-ing would take the site down for a
    // condition it is currently handling correctly.
    const withOverride = evaluateAuthHealth(base);
    const withoutOverride = evaluateAuthHealth({ ...base, runtimeRoleCookieSecret: false });

    expect(withoutOverride.status).toBe(withOverride.status);
    expect(withoutOverride.httpStatus).toBe(withOverride.httpStatus);
    expect(withoutOverride).toMatchObject({ status: 'ok', httpStatus: 200 });
  });

  it('and never changes a FAILING verdict either', () => {
    const failing = { ...base, buildTimeClerk: false };
    for (const roleCookie of [true, false]) {
      expect(evaluateAuthHealth({ ...failing, runtimeRoleCookieSecret: roleCookie })).toMatchObject(
        { status: 'build_artifact_missing_auth', httpStatus: 503 },
      );
    }
  });

  it('still reports presence booleans only, including the two new fields', () => {
    const report = evaluateAuthHealth(base) as unknown as Record<string, unknown>;
    for (const value of Object.values(report)) {
      expect(['boolean', 'number', 'string']).toContain(typeof value);
    }
    // Named explicitly: a regression that leaked the secret ITSELF rather than
    // its presence would still be a boolean-free string and pass the loop above
    // only by accident. These must exist and must be booleans.
    expect(typeof report.runtimeRoleCookieSecret).toBe('boolean');
    expect(typeof report.roleCookieSignedWithClerkKey).toBe('boolean');
  });
});

describe('docker-build.sh guard (executed, not mocked)', () => {
  const script = new URL('../scripts/docker-build.sh', import.meta.url).pathname;

  // VITALCV_BUILD_DRY_RUN=1 makes the script exit after the guard instead of
  // exec'ing the real turbo build.
  const probe = (env: Record<string, string>): { code: number; stderr: string } => {
    try {
      execFileSync('sh', [script], {
        env: { ...env, PATH: process.env.PATH ?? '', VITALCV_BUILD_DRY_RUN: '1' },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, stderr: '' };
    } catch (error) {
      const failure = error as { status?: number; stderr?: Buffer };
      return { code: failure.status ?? 1, stderr: failure.stderr?.toString() ?? '' };
    }
  };

  it('fails closed when the guard flag is set and the Clerk key is absent', () => {
    const result = probe({ VITALCV_REQUIRE_AUTH_ENV: '1' });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(result.stderr).toContain('18c9311');
  });

  it('passes when the guard flag is set and the key is present', () => {
    const result = probe({
      VITALCV_REQUIRE_AUTH_ENV: '1',
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_placeholder',
    });
    expect(result.code).toBe(0);
  });

  it('does not enforce for local builds without the flag', () => {
    expect(probe({}).code).toBe(0);
  });
});
