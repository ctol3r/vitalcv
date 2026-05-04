import { describe, expect, it } from 'vitest';
import { checkCorsAllowlist, getAllowedOrigins } from '@/lib/security/corsAllowlist';
import { getApiKeyFoundationState } from '@/lib/security/apiKeyFoundation';

describe('CORS allowlist — default config (ALLOWED_CORS_ORIGINS unset)', () => {
  it('blocks an API request when allowlist is empty', () => {
    // No env var set — allowlist is empty by default
    const result = checkCorsAllowlist('https://evil.example.com', []);
    expect(result.allowed).toBe(false);
  });

  it('allows a request whose origin is in the allowlist', () => {
    const result = checkCorsAllowlist(
      'https://app.vitalcv.com',
      ['https://app.vitalcv.com', 'https://staging.vitalcv.com'],
    );
    expect(result.allowed).toBe(true);
  });

  it('blocks a request whose origin is not in the allowlist', () => {
    const result = checkCorsAllowlist(
      'https://attacker.example.com',
      ['https://app.vitalcv.com'],
    );
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.reason).toBe('origin_not_in_allowlist');
    }
  });
});

describe('API key foundation — keysInProduction invariant', () => {
  it('keysInProduction is false at foundation tier', () => {
    const state = getApiKeyFoundationState();
    expect(state.keysInProduction).toBe(false);
  });
});

describe('getAllowedOrigins — env parsing', () => {
  it('returns empty array when ALLOWED_CORS_ORIGINS is unset', () => {
    // process.env.ALLOWED_CORS_ORIGINS is not set in test environment
    expect(getAllowedOrigins()).toEqual([]);
  });
});
