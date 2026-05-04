import { describe, expect, it } from 'vitest';
import { ENV_SCHEMA, validateEnv, assertEnvValid } from '../lib/env';

/**
 * SEC-ENV-1 — env contract assertions.
 *
 * Verifies:
 *   - The schema is internally consistent (no public-marked server secrets).
 *   - Required vars produce missingRequired entries when absent.
 *   - assertEnvValid throws in dev when required vars are missing.
 *   - assertEnvValid does NOT throw in production (logs to console.error instead).
 */
describe('env contract (SEC-ENV-1)', () => {
  it('schema declares both Clerk required vars (publishable + secret)', () => {
    const required = ENV_SCHEMA.filter((e) => e.kind === 'required');
    const names = required.map((e) => e.name);
    expect(names).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(names).toContain('CLERK_SECRET_KEY');
  });

  it('every NEXT_PUBLIC_ var is marked visibility:public', () => {
    for (const v of ENV_SCHEMA) {
      if (v.name.startsWith('NEXT_PUBLIC_')) {
        expect(v.visibility, `${v.name} must be visibility:public`).toBe('public');
      }
    }
  });

  it('no server-only secret name (without NEXT_PUBLIC_ prefix) is marked visibility:public', () => {
    for (const v of ENV_SCHEMA) {
      if (v.visibility === 'public' && !v.name.startsWith('NEXT_PUBLIC_')) {
        // NODE_ENV is special-cased — it is server-side but not a secret.
        expect(v.name, `${v.name} should not be visibility:public`).toBe('NODE_ENV');
      }
    }
  });

  it('validateEnv reports missingRequired when required vars are absent', () => {
    const result = validateEnv({} as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.missingRequired).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
    expect(result.missingRequired).toContain('CLERK_SECRET_KEY');
  });

  it('validateEnv reports ok when required vars are set', () => {
    const result = validateEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_dummy',
      CLERK_SECRET_KEY: 'sk_test_dummy',
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(true);
    expect(result.missingRequired).toEqual([]);
    expect(result.publicLeaks).toEqual([]);
  });

  it('validateEnv treats empty-string required as missing', () => {
    const result = validateEnv({
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: '',
      CLERK_SECRET_KEY: 'sk_test_dummy',
    } as NodeJS.ProcessEnv);
    expect(result.ok).toBe(false);
    expect(result.missingRequired).toContain('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY');
  });

  it('assertEnvValid throws in non-production when required missing', () => {
    expect(() =>
      assertEnvValid({ NODE_ENV: 'development' } as NodeJS.ProcessEnv),
    ).toThrow(/Missing required env vars/);
  });

  it('assertEnvValid does NOT throw in production (logs to console.error)', () => {
    const errors: string[] = [];
    const originalErr = console.error;
    console.error = (msg: string) => {
      errors.push(msg);
    };
    try {
      assertEnvValid({ NODE_ENV: 'production' } as NodeJS.ProcessEnv);
    } finally {
      console.error = originalErr;
    }
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Missing required env vars');
  });

  it('assertEnvValid is a no-op when validation passes', () => {
    expect(() =>
      assertEnvValid({
        NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: 'pk_test_dummy',
        CLERK_SECRET_KEY: 'sk_test_dummy',
        NODE_ENV: 'development',
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });
});
