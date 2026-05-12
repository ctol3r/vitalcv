/**
 * /api/health expansion + verify-clerk-env-in-build.sh lockdown.
 *
 * Pins:
 *   - /api/health returns the 4 new production-activation flags
 *     (deployment_id, runtime_mode, clerk_enabled, jwks_enabled,
 *     issuer_enabled, trust_endpoints_enabled) AS TOP-LEVEL fields.
 *   - Wave-136 backward-compat shape preserved (config.clerk.enabled,
 *     config.apiBase, config.sentry).
 *   - NEVER returns secret values — only booleans + prefix.
 *   - verify-clerk-env-in-build.sh greps for SUBSTITUTED keys only
 *     (16+ char tail), not the bare prefix used by source code's
 *     startsWith() checks.
 *   - Script has the SKIP_IF_NO_ENV override and fail-closed exit.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

import { GET } from '../app/api/health/route';

const SAVE_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'VITALCV_SIGNING_PUBLIC_JWK',
  'VITALCV_SIGNING_PRIVATE_KEY_JWK',
  'VITALCV_SIGNING_KEY_ID',
  'DATABASE_URL',
  'BACKEND_URL',
  'NEXT_PUBLIC_API_BASE',
  'PUBLIC_STATUS_URL',
  'STATUS_URL',
  'VERCEL_ENV',
  'VERCEL_DEPLOYMENT_ID',
  'VERCEL_GIT_COMMIT_SHA',
  'NEXT_PUBLIC_SENTRY_DSN',
] as const;

const saved: Partial<Record<(typeof SAVE_KEYS)[number], string>> = {};

beforeEach(() => {
  for (const k of SAVE_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of SAVE_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

async function getBody() {
  const res = await GET();
  return (await res.json()) as Record<string, unknown>;
}

describe('/api/health — production-activation flags present (absent state)', () => {
  it('clerk_enabled is a boolean false when env unset', async () => {
    const body = await getBody();
    expect(typeof body.clerk_enabled).toBe('boolean');
    expect(body.clerk_enabled).toBe(false);
  });

  it('jwks_enabled is false when VITALCV_SIGNING_PUBLIC_JWK is unset', async () => {
    const body = await getBody();
    expect(body.jwks_enabled).toBe(false);
  });

  it('issuer_enabled is false when private JWK or kid unset', async () => {
    const body = await getBody();
    expect(body.issuer_enabled).toBe(false);
  });

  it('trust_endpoints_enabled is false when backend / status URLs unset', async () => {
    const body = await getBody();
    expect(body.trust_endpoints_enabled).toBe(false);
  });

  it('deployment_id is null when not on Vercel', async () => {
    const body = await getBody();
    expect(body.deployment_id).toBeNull();
  });

  it('runtime_mode falls back to development when VERCEL_ENV unset', async () => {
    process.env.NODE_ENV = 'test';
    const body = await getBody();
    expect(body.runtime_mode).toBe('development');
  });
});

describe('/api/health — production-activation flags present (configured state)', () => {
  it('all flags true when fully configured', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_REAL_VALUE_NEVER_LOGGED';
    process.env.VITALCV_SIGNING_PUBLIC_JWK = '{"kty":"EC"}';
    process.env.VITALCV_SIGNING_PRIVATE_KEY_JWK = '{"kty":"EC","d":"x"}';
    process.env.VITALCV_SIGNING_KEY_ID = 'vcv-1';
    process.env.BACKEND_URL = 'https://api.example.com';
    process.env.PUBLIC_STATUS_URL = 'https://status.example.com';

    const body = await getBody();
    expect(body.clerk_enabled).toBe(true);
    expect(body.jwks_enabled).toBe(true);
    expect(body.issuer_enabled).toBe(true);
    expect(body.trust_endpoints_enabled).toBe(true);
  });

  it('runtime_mode honors VERCEL_ENV=production', async () => {
    process.env.VERCEL_ENV = 'production';
    const body = await getBody();
    expect(body.runtime_mode).toBe('production');
  });

  it('runtime_mode honors VERCEL_ENV=preview', async () => {
    process.env.VERCEL_ENV = 'preview';
    const body = await getBody();
    expect(body.runtime_mode).toBe('preview');
  });

  it('deployment_id prefers VERCEL_DEPLOYMENT_ID over git sha', async () => {
    process.env.VERCEL_DEPLOYMENT_ID = 'dpl_abc123';
    process.env.VERCEL_GIT_COMMIT_SHA = 'sha_xyz';
    const body = await getBody();
    expect(body.deployment_id).toBe('dpl_abc123');
  });

  it('deployment_id falls back to commit sha if no deployment id', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'sha_xyz';
    const body = await getBody();
    expect(body.deployment_id).toBe('sha_xyz');
  });
});

describe('/api/health — NEVER leaks secret values', () => {
  it('publishable key value does NOT appear in response body', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_NEVER_LEAK_THIS_AAAAAAAA';
    const body = await getBody();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('NEVER_LEAK_THIS_AAAAAAAA');
    expect(serialized).not.toContain('pk_live_NEVER_LEAK');
  });

  it('publishable key mode reported (production/development/none) but never the value', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_X';
    const body = await getBody();
    const config = body.config as { clerk: { mode: string } };
    expect(config.clerk.mode).toBe('production');
  });

  it('signing JWK values never appear in response', async () => {
    process.env.VITALCV_SIGNING_PRIVATE_KEY_JWK = '{"kty":"EC","d":"NEVER_LEAK_PRIVATE_D_AAAA"}';
    const body = await getBody();
    expect(JSON.stringify(body)).not.toContain('NEVER_LEAK_PRIVATE_D');
  });
});

describe('/api/health — backward-compat shape preserved (Wave 136)', () => {
  it('config.clerk.enabled mirrors top-level clerk_enabled', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    const body = await getBody();
    expect((body.config as { clerk: { enabled: boolean } }).clerk.enabled).toBe(true);
    expect(body.clerk_enabled).toBe(true);
  });

  it('config.clerk.mode resolves to development for pk_test_', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    const body = await getBody();
    expect((body.config as { clerk: { mode: string } }).clerk.mode).toBe('development');
  });

  it('config.clerk.mode resolves to none for empty publishable key', async () => {
    const body = await getBody();
    expect((body.config as { clerk: { mode: string } }).clerk.mode).toBe('none');
  });

  it('config.apiBase + config.sentry preserved', async () => {
    process.env.NEXT_PUBLIC_API_BASE = 'https://api.example.com';
    process.env.NEXT_PUBLIC_SENTRY_DSN = 'https://sentry.example.com';
    const body = await getBody();
    const config = body.config as { apiBase: boolean; sentry: boolean };
    expect(config.apiBase).toBe(true);
    expect(config.sentry).toBe(true);
  });
});

describe('verify-clerk-env-in-build.sh — script truth contract', () => {
  const REPO_ROOT = resolve(__dirname, '../../..');
  const SCRIPT_PATH = resolve(REPO_ROOT, 'scripts/verify-clerk-env-in-build.sh');
  const SCRIPT = readFileSync(SCRIPT_PATH, 'utf8');

  it('script is executable', () => {
    expect(statSync(SCRIPT_PATH).mode & 0o100).not.toBe(0);
  });

  it('uses set -euo pipefail', () => {
    expect(SCRIPT).toMatch(/set\s+-euo\s+pipefail/);
  });

  it('greps for SUBSTITUTED key (16+ char tail), not bare prefix', () => {
    // Source code does .startsWith('pk_live_') for mode-detection;
    // bare prefix appears in bundle without being a real substituted
    // key. The regex must require trailing characters.
    expect(SCRIPT).toMatch(/pk_live_\[A-Za-z0-9_-\]\{16,\}/);
    expect(SCRIPT).toMatch(/pk_test_\[A-Za-z0-9_-\]\{16,\}/);
  });

  it('supports SKIP_IF_NO_ENV override for dev builds', () => {
    expect(SCRIPT).toContain('SKIP_IF_NO_ENV');
  });

  it('exits 1 on missing key (fail-closed deploy gate)', () => {
    expect(SCRIPT).toMatch(/^exit 1$/m);
  });

  it('error message names the failure modes (Clerk not mounting)', () => {
    expect(SCRIPT).toContain('<ClerkProvider> will not render');
    expect(SCRIPT).toContain('/sign-in will show');
  });

  it('points operator at .env.local and Vercel for fix', () => {
    expect(SCRIPT).toContain('.env.local');
    expect(SCRIPT).toContain('Vercel');
  });

  it('does NOT log the actual key value', () => {
    // Only prefix should ever be echoed — never full value.
    const echoLines = SCRIPT.split('\n').filter((l) => /\b(echo|printf|cat)\b/.test(l));
    for (const l of echoLines) {
      // No echo line should reference the env var name AND a regex
      // capture group that would print the value.
      expect(l).not.toMatch(/\$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/);
    }
  });
});

describe('production-activation banned-strings scan', () => {
  const REPO_ROOT = resolve(__dirname, '../../..');
  const ROUTE_SRC = readFileSync(resolve(REPO_ROOT, 'apps/web/app/api/health/route.ts'), 'utf8');
  const SCRIPT_SRC = readFileSync(resolve(REPO_ROOT, 'scripts/verify-clerk-env-in-build.sh'), 'utf8');
  const BANNED = [
    ['automatically', 'verified'].join(' '),
    ['guaranteed', 'verification'].join(' '),
    ['HIPAA', 'compliant'].join(' '),
    ['SOC2', 'certified'].join(' '),
    ['certified', 'compliant'].join(' '),
  ];
  it.each(BANNED)('route does not contain banned phrase: %s', (phrase) => {
    expect(ROUTE_SRC).not.toContain(phrase);
  });
  it.each(BANNED)('script does not contain banned phrase: %s', (phrase) => {
    expect(SCRIPT_SRC).not.toContain(phrase);
  });
});
