import {
  ConnectorRetryableError,
  executeWithRetry,
} from '../../../../../core/connectors/retryPolicy';
import {
  ConnectorQuotaExceededError,
  ConnectorQuotaManager,
} from '../../../../../core/connectors/quotaManager';
import { ConnectorSchemaDriftDetector } from '../../../../../core/connectors/schemaDrift';
import {
  getConnectorAlerts,
  getConnectorDiagnostics,
  getConnectorHealth,
  resetConnectorHealth,
} from '../../src/services/providers/connectors/connectorHealthTracker';
import { runConnectorWithReliability } from '../../src/services/providers/connectors/connectorReliability';

beforeEach(() => {
  resetConnectorHealth();
});

describe('connector reliability controls', () => {
  it('retries transient failures with exponential backoff', async () => {
    let attempts = 0;
    const delays: number[] = [];

    const result = await executeWithRetry({
      connector: 'STATE_BOARD',
      operation: async () => {
        attempts += 1;
        if (attempts < 3) {
          throw new ConnectorRetryableError('timeout');
        }
        return 'ok';
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    expect(result.result).toBe('ok');
    expect(result.attempts).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  it('enforces configured connector quotas', () => {
    const manager = new ConnectorQuotaManager();
    manager.consume({
      connector: 'NPDB',
      policy: { limit: 1, windowMs: 60_000 },
    });

    expect(() =>
      manager.consume({
        connector: 'NPDB',
        policy: { limit: 1, windowMs: 60_000 },
      }),
    ).toThrow(ConnectorQuotaExceededError);
  });

  it('detects critical schema drift when required fields or types change', () => {
    const detector = new ConnectorSchemaDriftDetector();

    detector.observe(
      'CAQH',
      {
        npi: '1003000125',
        profileStatus: 'COMPLETE',
        lastVerifiedAt: '2026-03-14T00:00:00.000Z',
        sourceUrl: 'https://proview.caqh.org',
      },
      {
        requiredFields: ['npi', 'profileStatus', 'lastVerifiedAt', 'sourceUrl'],
      },
    );

    const drift = detector.observe(
      'CAQH',
      {
        npi: '1003000125',
        profileStatus: { code: 'COMPLETE' },
        sourceUrl: 'https://proview.caqh.org',
      },
      {
        requiredFields: ['npi', 'profileStatus', 'lastVerifiedAt', 'sourceUrl'],
      },
    );

    expect(drift.detected).toBe(true);
    expect(drift.severity).toBe('CRITICAL');
    expect(drift.missingRequiredFields).toContain('lastVerifiedAt');
    expect(drift.typeChanges.some((change) => change.field === 'profileStatus')).toBe(true);
  });

  it('quarantines a connector after quota exhaustion and surfaces diagnostics', async () => {
    type HealthCheckResult = { ok: boolean };
    const fallback = jest.fn((_context) => ({ ok: false as const }));

    await runConnectorWithReliability({
      connector: 'ABMS',
      quotaPolicy: { limit: 1, windowMs: 60_000 },
      execute: async (): Promise<HealthCheckResult> => ({ ok: true }),
      fallback: fallback as (_context: Parameters<typeof fallback>[0]) => HealthCheckResult,
    });

    const second = await runConnectorWithReliability({
      connector: 'ABMS',
      quotaPolicy: { limit: 1, windowMs: 60_000 },
      execute: async (): Promise<HealthCheckResult> => ({ ok: true }),
      fallback: fallback as (_context: Parameters<typeof fallback>[0]) => HealthCheckResult,
    });

    expect(second.ok).toBe(false);
    expect(fallback).toHaveBeenCalled();

    const health = getConnectorHealth().connectors.find((entry) => entry.connector === 'ABMS');
    expect(health).toBeDefined();
    expect(health!.quarantined).toBe(true);
    expect(health!.rateLimitHits).toBeGreaterThan(0);

    const diagnostics = getConnectorDiagnostics().connectors.find((entry) => entry.connector === 'ABMS');
    expect(diagnostics).toBeDefined();
    expect(diagnostics!.status).toBe('CRITICAL');
  });

  it('quarantines critical schema drift and emits alerts', async () => {
    type NpdbLikePayload = {
      npi: string;
      status: string | { code: string };
      lastCheckedAt?: string;
      sourceUrl: string;
    };

    const goodPayload: NpdbLikePayload = {
      npi: '1003000126',
      status: 'CLEAR',
      lastCheckedAt: '2026-03-14T00:00:00.000Z',
      sourceUrl: 'https://www.npdb.hrsa.gov',
    };

    await runConnectorWithReliability({
      connector: 'NPDB',
      quotaPolicy: { limit: 10, windowMs: 60_000 },
      schemaPolicy: {
        requiredFields: ['npi', 'status', 'lastCheckedAt', 'sourceUrl'],
      },
      execute: async (): Promise<NpdbLikePayload> => goodPayload,
      fallback: (): NpdbLikePayload => goodPayload,
    });

    const fallback = jest.fn(() => ({
      npi: '1003000126',
      status: 'NOT_AVAILABLE',
      lastCheckedAt: '2026-03-14T00:00:00.000Z',
      sourceUrl: 'https://www.npdb.hrsa.gov',
    }));

    await runConnectorWithReliability({
      connector: 'NPDB',
      quotaPolicy: { limit: 10, windowMs: 60_000 },
      schemaPolicy: {
        requiredFields: ['npi', 'status', 'lastCheckedAt', 'sourceUrl'],
      },
      execute: async (): Promise<NpdbLikePayload> => ({
        npi: '1003000126',
        status: { code: 'CLEAR' },
        sourceUrl: 'https://www.npdb.hrsa.gov',
      }),
      fallback: fallback as () => NpdbLikePayload,
    });

    expect(fallback).toHaveBeenCalled();

    const alerts = getConnectorAlerts(20).filter((alert) => alert.connector === 'NPDB');
    expect(alerts.some((alert) => alert.type === 'SCHEMA_DRIFT')).toBe(true);
    expect(alerts.some((alert) => alert.type === 'QUARANTINE')).toBe(true);

    const health = getConnectorHealth().connectors.find((entry) => entry.connector === 'NPDB');
    expect(health!.quarantined).toBe(true);
    expect(health!.schemaDriftDetected).toBe(true);
    expect(health!.schemaDriftSeverity).toBe('CRITICAL');
  });
});
