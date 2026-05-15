import { afterEach, describe, expect, it } from 'vitest';
import { getRuntimeActivationState } from '@/lib/runtime/getRuntimeActivationState';

const ENV_KEYS = [
  'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY',
  'CLERK_SECRET_KEY',
  'BACKEND_URL',
  'NEXT_PUBLIC_API_BASE',
  'DATABASE_URL',
  'RECEIPT_PRIVATE_KEY_JWK',
  'NEXT_PUBLIC_TELEMETRY_DISABLED',
];

function snapshotEnv() {
  return Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (typeof value === 'undefined') {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

describe('runtime activation state', () => {
  let snapshot: Record<string, string | undefined> = snapshotEnv();

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it('exposes a compact momentum-first summary when activation is partially wired', () => {
    snapshot = snapshotEnv();

    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.DATABASE_URL;
    delete process.env.RECEIPT_PRIVATE_KEY_JWK;

    const state = getRuntimeActivationState();

    expect(state.fullyActivated).toBe(false);
    expect(state.summary).toEqual(expect.objectContaining({
      headline: 'Identity pending',
      detail: 'Identity is still being confirmed.',
      nextAction: 'Set up identity first.',
      identity: {
        status: 'pending',
        label: 'Identity pending',
      },
      readiness: {
        status: 'blocked',
        label: 'Readiness blocked',
      },
      trust: {
        status: 'degraded',
        label: 'Review recommended',
      },
    }));
  });

  it('marks activation ready when Clerk, API base, and database are present', () => {
    snapshot = snapshotEnv();

    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.BACKEND_URL = 'https://api.vitalcv.com';
    process.env.DATABASE_URL = 'postgresql://example';
    process.env.RECEIPT_PRIVATE_KEY_JWK = '{"kty":"EC"}';

    const state = getRuntimeActivationState();

    expect(state.fullyActivated).toBe(true);
    expect(state.summary).toEqual(expect.objectContaining({
      headline: 'Ready to proceed',
      nextAction: 'Proceed to onboarding.',
      identity: {
        status: 'confirmed',
        label: 'Identity recognized',
      },
      readiness: {
        status: 'ready',
        label: 'Readiness ready',
      },
      trust: {
        status: 'operational',
        label: 'Source-backed',
      },
    }));
  });
});
