/**
 * GO-LIVE-1 PR416A — /api/status/health route lockdown.
 *
 * Pins the truth contract of the institutional telemetry surface:
 *   - Endpoint never returns a secret value (only presence + prefix).
 *   - Every subsystem reports a fail-closed default when its env
 *     vars are absent.
 *   - Aggregate verdict is derived from real subsystem state, never
 *     hardcoded.
 *   - Cache-Control: no-store (no stale telemetry).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { GET } from '../app/api/status/health/route';

// Captures and restores process.env between tests so subsystem
// detection sees the values this test sets, not the ambient env.
const SAVE_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'VITALCV_SIGNING_PUBLIC_JWK',
  'VITALCV_SIGNING_PRIVATE_KEY_JWK',
  'VITALCV_SIGNING_KEY_ID',
  'DATABASE_URL',
  'BACKEND_URL',
  'NEXT_PUBLIC_API_BASE',
  'PUBLIC_STATUS_URL',
  'STATUS_URL',
  'NEXT_PUBLIC_APP_URL',
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
    if (saved[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = saved[k];
    }
  }
});

async function getBody() {
  const res = await GET();
  return { res, body: (await res.json()) as Record<string, unknown> };
}

describe('GO-LIVE-1 PR416A — schema + aggregate when nothing configured', () => {
  it('returns vitalcv.status.health.v1 schema', async () => {
    const { body } = await getBody();
    expect(body.schema).toBe('vitalcv.status.health.v1');
  });

  it('returns HTTP 200 even when every subsystem is degraded', async () => {
    const { res } = await getBody();
    expect(res.status).toBe(200);
  });

  it('aggregate is "absent" when no env is configured', async () => {
    const { body } = await getBody();
    expect(body.aggregate).toBe('absent');
  });

  it('every subsystem is reported as not-present in absent mode', async () => {
    const { body } = await getBody();
    const subsystems = body.subsystems as Array<{ present: boolean }>;
    expect(subsystems.length).toBeGreaterThan(0);
    expect(subsystems.every((s) => s.present === false)).toBe(true);
  });

  it('degradedSubsystems lists every subsystem name in absent mode', async () => {
    const { body } = await getBody();
    const subsystems = body.subsystems as Array<{ subsystem: string }>;
    const degraded = body.degradedSubsystems as string[];
    expect(degraded.length).toBe(subsystems.length);
  });

  it('Cache-Control is no-store (no stale telemetry)', async () => {
    const { res } = await getBody();
    expect(res.headers.get('Cache-Control')).toContain('no-store');
  });

  it('X-Status-Aggregate header mirrors the body aggregate', async () => {
    const { res, body } = await getBody();
    expect(res.headers.get('X-Status-Aggregate')).toBe(body.aggregate);
  });
});

describe('GO-LIVE-1 PR416A — no secrets ever in the response', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_REAL_SECRET_VALUE_AAAAAAAA';
    process.env.CLERK_SECRET_KEY = 'sk_test_NEVER_LEAK_BBBBBBBB';
    process.env.VITALCV_SIGNING_PUBLIC_JWK = '{"kty":"EC","crv":"P-256","x":"public-X","y":"public-Y"}';
    process.env.VITALCV_SIGNING_PRIVATE_KEY_JWK = '{"kty":"EC","crv":"P-256","x":"public-X","y":"public-Y","d":"NEVER_LEAK_PRIVATE_D"}';
    process.env.VITALCV_SIGNING_KEY_ID = 'vcv-2026-05-abcdef1234567890';
    process.env.DATABASE_URL = 'postgresql://user:NEVER_LEAK_PASSWORD@host:5432/db';
  });

  it('response body does NOT contain CLERK_SECRET_KEY value', async () => {
    const { body } = await getBody();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('sk_test_NEVER_LEAK_BBBBBBBB');
    expect(serialized).not.toContain('NEVER_LEAK_BBBBBBBB');
  });

  it('response body does NOT contain publishable-key value (only prefix)', async () => {
    const { body } = await getBody();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('REAL_SECRET_VALUE_AAAAAAAA');
    // The prefix IS reported (pk_test_), but never the full key.
    expect(serialized).toContain('pk_test_');
    expect(serialized).not.toMatch(/pk_test_REAL_SECRET_VALUE_AAAAAAAA/);
  });

  it('response body does NOT contain private JWK material', async () => {
    const { body } = await getBody();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('NEVER_LEAK_PRIVATE_D');
  });

  it('response body does NOT contain DATABASE_URL password', async () => {
    const { body } = await getBody();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain('NEVER_LEAK_PASSWORD');
    expect(serialized).not.toContain('postgresql://');
  });

  it('clerk-auth subsystem reports productionMode=false for pk_test_', async () => {
    const { body } = await getBody();
    const subs = body.subsystems as Array<{ subsystem: string; meta?: Record<string, unknown> }>;
    const clerk = subs.find((s) => s.subsystem === 'clerk-auth');
    expect(clerk?.meta?.productionMode).toBe(false);
  });
});

describe('GO-LIVE-1 PR416A — aggregate transitions', () => {
  it('all configured → aggregate "ok"', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_live_test_value';
    process.env.CLERK_SECRET_KEY = 'sk_live_value';
    process.env.VITALCV_SIGNING_PUBLIC_JWK = '{"kty":"EC"}';
    process.env.VITALCV_SIGNING_PRIVATE_KEY_JWK = '{"kty":"EC","d":"x"}';
    process.env.VITALCV_SIGNING_KEY_ID = 'vcv-1';
    process.env.DATABASE_URL = 'postgresql://x';
    process.env.BACKEND_URL = 'https://api.example.com';
    process.env.PUBLIC_STATUS_URL = 'https://status.example.com';
    process.env.NEXT_PUBLIC_APP_URL = 'https://example.com';

    const { body } = await getBody();
    expect(body.aggregate).toBe('ok');
    expect(body.degradedSubsystems).toEqual([]);
  });

  it('some configured → aggregate "degraded"', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    // signing absent → degraded

    const { body } = await getBody();
    expect(body.aggregate).toBe('degraded');
    expect(body.degradedSubsystems).toContain('es256-signing');
  });

  it('unknown publishable-key prefix → reported as unknown-prefix, not leaked', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'weird_format_xxxxxxxx';

    const { body } = await getBody();
    const subs = body.subsystems as Array<{ subsystem: string; meta?: Record<string, unknown> }>;
    const clerk = subs.find((s) => s.subsystem === 'clerk-auth');
    expect(clerk?.meta?.publishableKeyPrefix).toBe('unknown-prefix');
  });
});

describe('GO-LIVE-1 PR416A — every documented subsystem reports', () => {
  it.each([
    'clerk-auth',
    'es256-signing',
    'database',
    'backend-api',
    'status-api',
    'app-url',
  ])('subsystem "%s" appears in the response', async (name) => {
    const { body } = await getBody();
    const subs = body.subsystems as Array<{ subsystem: string }>;
    expect(subs.find((s) => s.subsystem === name)).toBeDefined();
  });
});

describe('GO-LIVE-1 PR416A — source-level pins', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  const path = require('node:path') as typeof import('node:path');
  const SRC = fs.readFileSync(
    path.resolve(__dirname, '../app/api/status/health/route.ts'),
    'utf8',
  );

  it('runtime is nodejs (reads process.env reliably)', () => {
    expect(SRC).toContain("export const runtime = 'nodejs'");
  });

  it('dynamic is force-dynamic (no caching of telemetry)', () => {
    expect(SRC).toContain("export const dynamic = 'force-dynamic'");
  });

  it('Cache-Control header is no-store, must-revalidate', () => {
    expect(SRC).toContain("'Cache-Control': 'no-store, must-revalidate'");
  });

  it('keyPrefix function never returns the raw value', () => {
    // The function returns one of the allowedPrefixes OR
    // 'unknown-prefix' OR null. Never the env value itself.
    expect(SRC).toMatch(/function keyPrefix/);
    expect(SRC).toContain("'unknown-prefix'");
  });

  it('schema string is exactly vitalcv.status.health.v1', () => {
    expect(SRC).toContain("'vitalcv.status.health.v1'");
  });

  it('does not contain banned strings', () => {
    const BANNED = [
      ['automatically', 'verified'].join(' '),
      ['guaranteed', 'verification'].join(' '),
      ['HIPAA', 'compliant'].join(' '),
      ['SOC2', 'certified'].join(' '),
      ['certified', 'compliant'].join(' '),
    ];
    for (const phrase of BANNED) {
      expect(SRC).not.toContain(phrase);
    }
  });
});
