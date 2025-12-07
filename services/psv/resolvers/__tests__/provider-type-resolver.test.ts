/**
 * B111A-PSV-009: Tests for provider-type resolvers w/ failover/backoff
 *
 * Tests cover:
 * - Primary 5xx→fallback
 * - Exponential retry
 * - Audit events
 * - Coverage ≥90%
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { resolveProviderType, getResolversForProviderType } from './provider-type-resolver';
import * as resolverModule from './provider-type-resolver';

// Mock fetch
global.fetch = vi.fn();

describe('Provider-Type Resolvers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'info').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return resolvers for physician type', () => {
    const resolvers = getResolversForProviderType('physician');
    expect(resolvers.length).toBeGreaterThan(0);
    expect(resolvers[0].id).toBe('fcvs'); // Primary resolver
  });

  it('should return resolvers for nurse type', () => {
    const resolvers = getResolversForProviderType('nurse');
    expect(resolvers.length).toBeGreaterThan(0);
    expect(resolvers[0].id).toBe('nursys'); // Primary resolver
  });

  it('should return empty array for unknown provider type', () => {
    const resolvers = getResolversForProviderType('unknown_type');
    expect(resolvers).toEqual([]);
  });

  it('should failover to secondary resolver when primary returns 5xx', async () => {
    const providerId = 'test-provider-123';
    const providerType = 'physician';

    // Mock primary resolver (FCVS) returning 500
    (global.fetch as any).mockImplementationOnce(async (url: string) => {
      if (url.includes('fcvs')) {
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      }
      throw new Error('Unexpected URL');
    });

    // Mock secondary resolver (NPDB) returning success
    (global.fetch as any).mockImplementationOnce(async (url: string) => {
      if (url.includes('npdb')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ verified: true, providerId }),
        };
      }
      throw new Error('Unexpected URL');
    });

    const result = await resolveProviderType(providerId, providerType);

    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result?.sourceId).toBe('npdb'); // Should use fallback
    expect(global.fetch).toHaveBeenCalledTimes(2); // Primary + fallback
  });

  it('should retry on 5xx errors with exponential backoff', async () => {
    const providerId = 'test-provider-456';
    const providerType = 'physician';

    let callCount = 0;
    (global.fetch as any).mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        // First two calls return 500
        return {
          ok: false,
          status: 500,
          text: async () => 'Internal Server Error',
        };
      }
      // Third call succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({ verified: true, providerId }),
      };
    });

    const startTime = Date.now();
    const result = await resolveProviderType(providerId, providerType);
    const duration = Date.now() - startTime;

    expect(result.success).toBe(true);
    expect(callCount).toBe(3); // Initial + 2 retries
    // Should have exponential backoff delays (at least 1s + 2s = 3s minimum)
    expect(duration).toBeGreaterThan(2000);
  });

  it('should not failover on 4xx client errors', async () => {
    const providerId = 'test-provider-789';
    const providerType = 'physician';

    // Mock primary resolver returning 400 (client error)
    (global.fetch as any).mockImplementationOnce(async (url: string) => {
      if (url.includes('fcvs')) {
        return {
          ok: false,
          status: 400,
          text: async () => 'Bad Request',
        };
      }
      throw new Error('Unexpected URL');
    });

    const result = await resolveProviderType(providerId, providerType);

    expect(result.success).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1); // Should not failover
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle timeout errors with retry', async () => {
    const providerId = 'test-provider-timeout';
    const providerType = 'nurse';

    let callCount = 0;
    (global.fetch as any).mockImplementation(async () => {
      callCount++;
      if (callCount <= 1) {
        // First call times out
        throw new Error('TimeoutError');
      }
      // Second call succeeds
      return {
        ok: true,
        status: 200,
        json: async () => ({ verified: true, providerId }),
      };
    });

    const result = await resolveProviderType(providerId, providerType);

    expect(result.success).toBe(true);
    expect(callCount).toBe(2); // Initial + retry
  });

  it('should fail when all resolvers fail', async () => {
    const providerId = 'test-provider-all-fail';
    const providerType = 'physician';

    // Mock all resolvers returning 500
    (global.fetch as any).mockImplementation(async () => {
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error',
      };
    });

    const result = await resolveProviderType(providerId, providerType);

    expect(result.success).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    // Should have tried all resolvers
    expect(global.fetch).toHaveBeenCalledTimes(3); // FCVS + NPDB + NCCPA
  });

  it('should emit audit events for resolver attempts', async () => {
    const providerId = 'test-provider-audit';
    const providerType = 'physician';

    (global.fetch as any).mockImplementationOnce(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({ verified: true, providerId }),
      };
    });

    await resolveProviderType(providerId, providerType);

    // Should have emitted audit events via console.info
    expect(console.info).toHaveBeenCalled();
    const auditCalls = (console.info as any).mock.calls.filter((call: any[]) =>
      call[0]?.includes('[AUDIT] Provider Resolver')
    );
    expect(auditCalls.length).toBeGreaterThan(0);
  });

  it('should handle network errors with retry', async () => {
    const providerId = 'test-provider-network';
    const providerType = 'nurse';

    let callCount = 0;
    (global.fetch as any).mockImplementation(async () => {
      callCount++;
      if (callCount <= 1) {
        throw new Error('Network error');
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ verified: true, providerId }),
      };
    });

    const result = await resolveProviderType(providerId, providerType);

    expect(result.success).toBe(true);
    expect(callCount).toBe(2); // Initial + retry
  });
});

