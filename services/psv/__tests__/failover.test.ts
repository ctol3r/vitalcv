/**
 * B122A-PSV-009: Tests for PSV failover with exponential backoff
 *
 * Acceptance criteria:
 * - Primary 5xx → fallback to next provider
 * - Retry policy enforced
 * - Audit events stored
 * - Tests pass
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { executePSVWithFailover, FailoverConfig, DEFAULT_FAILOVER_CONFIG } from '../failover';
import { getPSVRegistry } from '../registry';

// Mock fetch
global.fetch = vi.fn();

describe('B122A-PSV-009: PSV Failover with Exponential Backoff', () => {
  let registry: ReturnType<typeof getPSVRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = getPSVRegistry();

    // Register test endpoints
    registry.registerEndpoint({
      name: 'FCVS Test Endpoint',
      endpoint: 'https://test.fcvs.org/v1/verify',
      method: 'POST',
      authType: 'OAUTH2',
      authConfig: {
        clientId: 'test-client-id',
        clientSecret: 'test-secret',
        tokenUrl: 'https://test.fcvs.org/oauth/token',
      },
      verificationTypes: ['CR1', 'CR2'],
      description: 'Test FCVS endpoint',
      provider: 'FCVS',
      active: true,
    });

    registry.registerEndpoint({
      name: 'NPDB Test Endpoint',
      endpoint: 'https://test.npdb.org/v1/query',
      method: 'POST',
      authType: 'API_KEY',
      authConfig: {
        apiKey: 'test-api-key',
      },
      verificationTypes: ['CR1', 'CR2'],
      description: 'Test NPDB endpoint',
      provider: 'NPDB',
      active: true,
    });
  });

  describe('Primary 5xx → fallback', () => {
    it('should fallback to next provider when primary returns 5xx', async () => {
      const endpoints = registry.listEndpoints({ verificationType: 'CR1', active: true });
      expect(endpoints.length).toBeGreaterThan(0);

      // Mock primary endpoint returning 5xx
      (global.fetch as any).mockImplementationOnce(async (url: string) => {
        if (url.includes('fcvs.org')) {
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Server error' }),
          };
        }
        if (url.includes('npdb.org')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ verified: true, subjectId: 'test-123' }),
          };
        }
        throw new Error('Unexpected URL');
      });

      // Mock OAuth2 token fetch
      (global.fetch as any).mockImplementationOnce(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }
        throw new Error('Unexpected OAuth URL');
      });

      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        { ...DEFAULT_FAILOVER_CONFIG, maxRetries: 0 } // No retries for faster test
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('NPDB');
      expect(result.response).toEqual({ verified: true, subjectId: 'test-123' });
    });

    it('should try all endpoints when all return 5xx', async () => {
      // Mock all endpoints returning 5xx
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }
        return {
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({ error: 'Service unavailable' }),
        };
      });

      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        { ...DEFAULT_FAILOVER_CONFIG, maxRetries: 0 }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('All endpoints failed');
      expect(result.attempts.length).toBeGreaterThan(0);
    });
  });

  describe('Exponential backoff retry policy', () => {
    it('should retry with exponential backoff on server errors', async () => {
      let attemptCount = 0;
      const delays: number[] = [];

      // Mock endpoint returning 5xx then success
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }

        attemptCount++;
        if (attemptCount === 1) {
          // First attempt: return 5xx
          return {
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            json: async () => ({ error: 'Server error' }),
          };
        }
        // Second attempt: success
        return {
          ok: true,
          status: 200,
          json: async () => ({ verified: true }),
        };
      });

      const config: FailoverConfig = {
        maxRetries: 1,
        initialDelayMs: 100,
        maxDelayMs: 1000,
        multiplier: 2,
        jitter: 0,
      };

      const startTime = Date.now();
      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        config
      );
      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(2);
      // Should have delayed between retries (at least initialDelayMs)
      expect(duration).toBeGreaterThanOrEqual(config.initialDelayMs);
    });

    it('should respect max retries limit', async () => {
      let attemptCount = 0;

      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }

        attemptCount++;
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Server error' }),
        };
      });

      const config: FailoverConfig = {
        maxRetries: 2,
        initialDelayMs: 10, // Fast for testing
        maxDelayMs: 100,
        multiplier: 2,
        jitter: 0,
      };

      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        config
      );

      expect(result.success).toBe(false);
      // Should have attempted maxRetries + 1 times (initial + retries)
      expect(attemptCount).toBe(config.maxRetries + 1);
    });
  });

  describe('Audit events stored', () => {
    it('should record successful verification in audit', async () => {
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ verified: true }),
        };
      });

      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        { ...DEFAULT_FAILOVER_CONFIG, maxRetries: 0 }
      );

      expect(result.success).toBe(true);

      // Check audit evidence was created
      const evidence = registry.getAuditEvidence('CR1');
      expect(evidence.length).toBeGreaterThan(0);
      const latestEvidence = evidence[evidence.length - 1];
      expect(latestEvidence.subjectId).toBe('test-123');
      expect(latestEvidence.verificationId).toBeDefined();
    });

    it('should record failed verification attempts in audit', async () => {
      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: async () => ({ error: 'Server error' }),
        };
      });

      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        { ...DEFAULT_FAILOVER_CONFIG, maxRetries: 0 }
      );

      expect(result.success).toBe(false);

      // Check verification history
      const history = registry.getVerificationHistory({ subjectId: 'test-123' });
      expect(history.length).toBeGreaterThan(0);
      expect(history.some(v => v.status === 'failed')).toBe(true);
    });
  });

  describe('Client errors (4xx) not retryable', () => {
    it('should not retry on 4xx errors', async () => {
      let attemptCount = 0;

      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }

        attemptCount++;
        return {
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: async () => ({ error: 'Invalid request' }),
        };
      });

      const result = await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: 'invalid' },
        { ...DEFAULT_FAILOVER_CONFIG, maxRetries: 3 }
      );

      expect(result.success).toBe(false);
      // Should not retry on 4xx
      expect(attemptCount).toBe(1);
    });
  });

  describe('Provider priority ordering', () => {
    it('should try FCVS before NPDB', async () => {
      const callOrder: string[] = [];

      (global.fetch as any).mockImplementation(async (url: string) => {
        if (url.includes('oauth/token')) {
          return {
            ok: true,
            json: async () => ({ access_token: 'test-token' }),
          };
        }

        if (url.includes('fcvs.org')) {
          callOrder.push('FCVS');
          return {
            ok: true,
            status: 200,
            json: async () => ({ verified: true }),
          };
        }

        if (url.includes('npdb.org')) {
          callOrder.push('NPDB');
          return {
            ok: true,
            status: 200,
            json: async () => ({ verified: true }),
          };
        }

        throw new Error('Unexpected URL');
      });

      await executePSVWithFailover(
        'CR1',
        'test-123',
        { npi: '1234567890' },
        { ...DEFAULT_FAILOVER_CONFIG, maxRetries: 0 }
      );

      expect(callOrder[0]).toBe('FCVS');
    });
  });
});

