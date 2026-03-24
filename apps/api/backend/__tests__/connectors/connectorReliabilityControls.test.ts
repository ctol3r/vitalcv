import {
  ConnectorRateLimitError,
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
import { InMemoryTrustAlertsRepository } from '../../repositories/trustAlerts.repo';
import {
  initializeTrustAlertsPersistence,
  listAlerts,
  resetTrustAlertsRepository,
  setTrustAlertsRepository,
} from '../../src/services/alerts/trustAlerts';

function flushAsyncWork(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

beforeEach(async () => {
  resetConnectorHealth();
  setTrustAlertsRepository(new InMemoryTrustAlertsRepository());
  await initializeTrustAlertsPersistence();
});

afterEach(() => {
  resetTrustAlertsRepository();
});

describe('connector reliability controls', () => {
  it('retries transient failures with exponential backoff when jitter is disabled', async () => {
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
      policy: {
        jitterRatio: 0,
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    });

    expect(result.result).toBe('ok');
    expect(result.attempts).toBe(3);
    expect(delays).toEqual([250, 500]);
  });

  it('honors Retry-After without shortening it via local retry caps', async () => {
    const delays: number[] = [];
    let attempts = 0;

    await expect(executeWithRetry({
      connector: 'OIG',
      operation: async () => {
        attempts += 1;
        if (attempts === 1) {
          throw new ConnectorRateLimitError('rate limited', 8_500);
        }
        return 'ok';
      },
      policy: {
        maxDelayMs: 500,
        maxCumulativeDelayMs: 9_000,
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    })).resolves.toMatchObject({
      result: 'ok',
      attempts: 2,
      totalDelayMs: 8_500,
    });

    expect(delays).toEqual([8_500]);
  });

  it('stops retrying when the cumulative delay budget would be exceeded', async () => {
    const delays: number[] = [];

    await expect(executeWithRetry({
      connector: 'ABMS',
      operation: async () => {
        throw new ConnectorRetryableError('timeout');
      },
      policy: {
        jitterRatio: 0,
        maxCumulativeDelayMs: 400,
      },
      sleep: async (ms) => {
        delays.push(ms);
      },
    })).rejects.toThrow('timeout');

    expect(delays).toEqual([250]);
  });

  it('enforces configured connector quotas and exposes near-limit state', () => {
    const manager = new ConnectorQuotaManager();
    const first = manager.consume({
      connector: 'NPDB',
      policy: { limit: 10, windowMs: 60_000, alertThreshold: 0.2 },
      cost: 8,
    });

    expect(first.nearLimit).toBe(true);
    expect(first.utilizationRatio).toBe(0.8);
    expect(first.windowRemainingMs).toBeGreaterThan(0);

    expect(() =>
      manager.consume({
        connector: 'NPDB',
        policy: { limit: 10, windowMs: 60_000, alertThreshold: 0.2 },
        cost: 3,
      }),
    ).toThrow(ConnectorQuotaExceededError);
  });

  it('learns a schema baseline only after two stable samples', () => {
    const detector = new ConnectorSchemaDriftDetector();
    const sample = {
      npi: '1003000125',
      profileStatus: 'COMPLETE',
      lastVerifiedAt: '2026-03-14T00:00:00.000Z',
      sourceUrl: 'https://proview.caqh.org',
    };

    const first = detector.observe('CAQH', sample, {
      requiredFields: ['npi', 'profileStatus', 'lastVerifiedAt', 'sourceUrl'],
    });
    const second = detector.observe('CAQH', sample, {
      requiredFields: ['npi', 'profileStatus', 'lastVerifiedAt', 'sourceUrl'],
    });

    expect(first.baselineState).toBe('LEARNING');
    expect(first.baselineFingerprint).toBeNull();
    expect(first.candidateSamples).toBe(1);
    expect(second.baselineState).toBe('LEARNED');
    expect(second.baselineFingerprint).toBeTruthy();
    expect(second.candidateSamples).toBe(0);
  });

  it('detects critical schema drift when required fields or types change after baseline stabilizes', () => {
    const detector = new ConnectorSchemaDriftDetector();
    const baseline = {
      npi: '1003000125',
      profileStatus: 'COMPLETE',
      lastVerifiedAt: '2026-03-14T00:00:00.000Z',
      sourceUrl: 'https://proview.caqh.org',
    };

    detector.observe('CAQH', baseline, {
      requiredFields: ['npi', 'profileStatus', 'lastVerifiedAt', 'sourceUrl'],
    });
    detector.observe('CAQH', baseline, {
      requiredFields: ['npi', 'profileStatus', 'lastVerifiedAt', 'sourceUrl'],
    });

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

  it('records additive schema fields without escalating when additional fields are allowed', () => {
    const detector = new ConnectorSchemaDriftDetector();
    const baseline = {
      npi: '1003000125',
      profileStatus: 'COMPLETE',
      lastVerifiedAt: '2026-03-14T00:00:00.000Z',
      sourceUrl: 'https://proview.caqh.org',
    };

    detector.observe('CAQH', baseline, { allowAdditionalFields: true });
    detector.observe('CAQH', baseline, { allowAdditionalFields: true });

    const drift = detector.observe('CAQH', {
      ...baseline,
      providerType: 'PHYSICIAN',
    }, { allowAdditionalFields: true });

    expect(drift.detected).toBe(false);
    expect(drift.severity).toBe('NONE');
    expect(drift.additionalFields).toContain('providerType');
  });

  it('quarantines a connector after quota exhaustion, surfaces diagnostics, and persists an alert', async () => {
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

    await flushAsyncWork();

    expect(second.ok).toBe(false);
    expect(fallback).toHaveBeenCalled();

    const health = getConnectorHealth().connectors.find((entry) => entry.connector === 'ABMS');
    expect(health).toBeDefined();
    expect(health!.quarantined).toBe(true);
    expect(health!.rateLimitHits).toBeGreaterThan(0);

    const diagnostics = getConnectorDiagnostics().connectors.find((entry) => entry.connector === 'ABMS');
    expect(diagnostics).toBeDefined();
    expect(diagnostics!.status).toBe('CRITICAL');
    expect(diagnostics!.statusReasons.some((reason) => reason.toLowerCase().includes('quota'))).toBe(true);

    expect(listAlerts().some((alert) =>
      alert.type === 'verification_failure'
      && alert.title.includes('ABMS connector')
      && alert.description.includes('quota'),
    )).toBe(true);
  });

  it('quarantines critical schema drift, emits connector alerts, and persists trust alerts', async () => {
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

    await runConnectorWithReliability({
      connector: 'NPDB',
      quotaPolicy: { limit: 10, windowMs: 60_000 },
      schemaPolicy: {
        requiredFields: ['npi', 'status', 'lastCheckedAt', 'sourceUrl'],
      },
      execute: async (): Promise<NpdbLikePayload> => goodPayload,
      fallback: (): NpdbLikePayload => goodPayload,
    });

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
      fallback: (): NpdbLikePayload => ({
        npi: '1003000126',
        status: 'NOT_AVAILABLE',
        lastCheckedAt: '2026-03-14T00:00:00.000Z',
        sourceUrl: 'https://www.npdb.hrsa.gov',
      }),
    });

    await flushAsyncWork();

    const alerts = getConnectorAlerts(20).filter((alert) => alert.connector === 'NPDB');
    expect(alerts.some((alert) => alert.type === 'SCHEMA_DRIFT')).toBe(true);
    expect(alerts.some((alert) => alert.type === 'QUARANTINE')).toBe(true);

    const health = getConnectorHealth().connectors.find((entry) => entry.connector === 'NPDB');
    expect(health!.quarantined).toBe(true);
    expect(health!.schemaDriftDetected).toBe(true);
    expect(health!.schemaDriftSeverity).toBe('CRITICAL');

    const persisted = listAlerts().filter((alert) =>
      alert.type === 'verification_failure'
      && alert.title.includes('NPDB connector'),
    );
    expect(persisted.length).toBeGreaterThan(0);
    expect(persisted.some((alert) => alert.description.includes('schema drift'))).toBe(true);
  });
});
