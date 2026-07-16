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
