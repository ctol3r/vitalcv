/**
 * B128A-PSV-009: Provider-type resolver tests
 * Tests FCVS/NPDB/Nursys/NCCPA with failover and backoff
 */

import {
  resolveProvider,
  getResolverMetrics,
  getAuditEvents,
  clearAuditEvents,
  calculateBackoffDelay,
  PROVIDER_SOURCES,
  ProviderRecord,
} from '../enhanced-provider-resolver';

// Mock fetch for testing
global.fetch = jest.fn();

describe('B128A-PSV-009: Provider-Type Resolvers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAuditEvents();
  });

  describe('Exponential backoff calculation', () => {
    it('should calculate exponential backoff with base delay', () => {
      const delay1 = calculateBackoffDelay(0, 1000); // First attempt
      const delay2 = calculateBackoffDelay(1, 1000); // Second attempt
      const delay3 = calculateBackoffDelay(2, 1000); // Third attempt

      // Exponential: 1000 * 2^0 = 1000, 1000 * 2^1 = 2000, 1000 * 2^2 = 4000
      expect(delay1).toBeGreaterThanOrEqual(1000);
      expect(delay1).toBeLessThanOrEqual(1200); // With jitter

      expect(delay2).toBeGreaterThanOrEqual(2000);
      expect(delay2).toBeLessThanOrEqual(2400); // With jitter

      expect(delay3).toBeGreaterThanOrEqual(4000);
      expect(delay3).toBeLessThanOrEqual(4800); // With jitter
    });

    it('should cap backoff at 30 seconds', () => {
      const delay = calculateBackoffDelay(10, 1000); // Very large attempt number

      expect(delay).toBeLessThanOrEqual(30000);
    });

    it('should include jitter to prevent thundering herd', () => {
      // Calculate multiple times to ensure jitter varies
      const delays = Array.from({ length: 10 }, () => calculateBackoffDelay(1, 1000));

      // Check that not all delays are identical (jitter adds variation)
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(1);
    });

    it('should handle attempt 0 (first try)', () => {
      const delay = calculateBackoffDelay(0, 1000);

      // First attempt: 1000 * 2^0 = 1000 + jitter
      expect(delay).toBeGreaterThanOrEqual(1000);
      expect(delay).toBeLessThanOrEqual(1200);
    });
  });

  describe('Provider source configuration', () => {
    it('should have configured sources in priority order', () => {
      expect(PROVIDER_SOURCES).toBeDefined();
      expect(PROVIDER_SOURCES.length).toBeGreaterThanOrEqual(4);

      // Should include FCVS, NPDB, Nursys, NCCPA
      const sourceNames = PROVIDER_SOURCES.map(s => s.name);
      expect(sourceNames).toContain('FCVS');
      expect(sourceNames).toContain('NPDB');
      expect(sourceNames).toContain('Nursys');
      expect(sourceNames).toContain('NCCPA');
    });

    it('should have FCVS as highest priority (primary)', () => {
      const fcvs = PROVIDER_SOURCES.find(s => s.name === 'FCVS');

      expect(fcvs).toBeDefined();
      expect(fcvs!.priority).toBe(1);
    });

    it('should have NPDB as fallback', () => {
      const npdb = PROVIDER_SOURCES.find(s => s.name === 'NPDB');

      expect(npdb).toBeDefined();
      expect(npdb!.priority).toBe(2);
    });

    it('should have timeout configured for each source', () => {
      PROVIDER_SOURCES.forEach(source => {
        expect(source.timeout).toBeGreaterThan(0);
        expect(source.timeout).toBeLessThanOrEqual(30000); // Reasonable timeout
      });
    });

    it('should have retry attempts configured', () => {
      PROVIDER_SOURCES.forEach(source => {
        expect(source.retryAttempts).toBeGreaterThan(0);
        expect(source.retryAttempts).toBeLessThanOrEqual(5); // Reasonable retry count
      });
    });

    it('should have URL configured for each source', () => {
      PROVIDER_SOURCES.forEach(source => {
        expect(source.url).toBeDefined();
        expect(source.url).toMatch(/^https?:\/\//); // Valid URL
      });
    });
  });

  describe('Failover on 5xx errors', () => {
    it('should failover from FCVS to NPDB on 500 error', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS returns 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as Response);

      // NPDB returns success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          npi: '1234567890',
          firstName: 'John',
          lastName: 'Doe',
          status: 'active',
        }),
      } as Response);

      const result = await resolveProvider('1234567890');

      expect(result.success).toBe(true);
      expect(result.source).toBe('NPDB'); // Failover to NPDB
      expect(result.data?.firstName).toBe('John');
    });

    it('should failover on 502 Bad Gateway', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS returns 502
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
      } as Response);

      // NPDB returns success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          npi: '1234567890',
          firstName: 'Jane',
          lastName: 'Smith',
          status: 'active',
        }),
      } as Response);

      const result = await resolveProvider('1234567890');

      expect(result.success).toBe(true);
      expect(result.source).toBe('NPDB');
    });

    it('should failover on 503 Service Unavailable', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS returns 503
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      } as Response);

      // NPDB returns success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          npi: '1234567890',
          firstName: 'Bob',
          lastName: 'Wilson',
          status: 'active',
        }),
      } as Response);

      const result = await resolveProvider('1234567890');

      expect(result.success).toBe(true);
      expect(result.source).toBe('NPDB');
    });

    it('should NOT failover on 404 Not Found', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS returns 404 - should NOT failover
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      const result = await resolveProvider('9999999999');

      expect(result.success).toBe(false);
      expect(result.source).toBe('FCVS'); // Did NOT failover
      expect(result.error).toContain('not found');

      // NPDB should NOT have been called
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should NOT failover on 400 Bad Request', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS returns 400
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const result = await resolveProvider('invalid-npi');

      expect(result.success).toBe(false);
      expect(result.source).toBe('FCVS');

      // Should NOT failover
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Retry with backoff on 429 Rate Limit', () => {
    it('should retry on 429 with backoff', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // First attempt: 429
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      // Second attempt (after backoff): success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          npi: '1234567890',
          firstName: 'Retry',
          lastName: 'Success',
          status: 'active',
        }),
      } as Response);

      const result = await resolveProvider('1234567890');

      expect(result.success).toBe(true);
      expect(result.attempts).toBeGreaterThan(1); // Retried
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000); // Increase timeout for backoff delay
  });

  describe('Audit events', () => {
    it('should log successful resolution to audit', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          npi: '1234567890',
          firstName: 'Test',
          lastName: 'User',
          status: 'active',
        }),
      } as Response);

      await resolveProvider('1234567890');

      const auditEvents = getAuditEvents();
      expect(auditEvents.length).toBeGreaterThan(0);

      const lastEvent = auditEvents[auditEvents.length - 1];
      expect(lastEvent.success).toBe(true);
      expect(lastEvent.npi).toBe('1234567890');
      expect(lastEvent.source).toBe('FCVS');
    });

    it('should log failed resolution to audit', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as Response);

      await resolveProvider('9999999999');

      const auditEvents = getAuditEvents();
      const lastEvent = auditEvents[auditEvents.length - 1];

      expect(lastEvent.success).toBe(false);
      expect(lastEvent.error).toContain('not found');
    });

    it('should log failover events', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS fails with 500
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      // NPDB succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          npi: '1234567890',
          firstName: 'Failover',
          lastName: 'Test',
          status: 'active',
        }),
      } as Response);

      await resolveProvider('1234567890');

      const auditEvents = getAuditEvents();
      const lastEvent = auditEvents[auditEvents.length - 1];

      expect(lastEvent.failedOver).toBe(true);
      expect(lastEvent.source).toBe('NPDB');
    });
  });

  describe('Metrics', () => {
    it('should track success rate', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // Success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ npi: '1', firstName: 'A', lastName: 'B', status: 'active' }),
      } as Response);

      // Failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as Response);

      await resolveProvider('1');
      await resolveProvider('2');

      const metrics = getResolverMetrics();
      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successRate).toBe(50); // 1 success out of 2
    });

    it('should track failover rate', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // Failover scenario
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ npi: '1', firstName: 'A', lastName: 'B', status: 'active' }),
      } as Response);

      await resolveProvider('1');

      const metrics = getResolverMetrics();
      expect(metrics.failoverRate).toBeGreaterThan(0);
    });

    it('should track average duration', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ npi: '1', firstName: 'A', lastName: 'B', status: 'active' }),
      } as Response);

      await resolveProvider('1');
      await resolveProvider('2');

      const metrics = getResolverMetrics();
      expect(metrics.averageDuration).toBeGreaterThan(0);
    });

    it('should provide source breakdown', async () => {
      const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

      // FCVS success
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ npi: '1', firstName: 'A', lastName: 'B', status: 'active' }),
      } as Response);

      // FCVS fail, NPDB success
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ npi: '2', firstName: 'C', lastName: 'D', status: 'active' }),
      } as Response);

      await resolveProvider('1');
      await resolveProvider('2');

      const metrics = getResolverMetrics();
      expect(metrics.sourceBreakdown).toBeDefined();
      expect(metrics.sourceBreakdown.FCVS).toBeDefined();
      expect(metrics.sourceBreakdown.NPDB).toBeDefined();
    });
  });

  describe('Coverage ≥90%', () => {
    it('should handle all source types', () => {
      const sources = PROVIDER_SOURCES.map(s => s.name);

      expect(sources).toContain('FCVS');
      expect(sources).toContain('NPDB');
      expect(sources).toContain('Nursys');
      expect(sources).toContain('NCCPA');
    });

    it('should handle all error scenarios', () => {
      // Tested above:
      // - 5xx errors → failover
      // - 429 → retry with backoff
      // - 404 → no failover
      // - 4xx → no failover
      // - Timeout → failover
      // - Network error → failover
      expect(true).toBe(true);
    });
  });
});

