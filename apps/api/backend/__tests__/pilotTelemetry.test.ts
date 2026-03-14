import {
  getPilotTelemetryDashboard,
  recordCacheLookup,
  recordResolverRuntime,
  recordTrustStateLatency,
  recordWidgetPasGenerationTime,
  resetPilotTelemetry,
} from '../src/services/system/pilotTelemetry';

describe('pilot telemetry service', () => {
  beforeEach(() => {
    resetPilotTelemetry();
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetPilotTelemetry();
  });

  it('builds a dashboard snapshot with latency histograms and cache ratios', () => {
    recordTrustStateLatency({ latencyMs: 40, cacheStatus: 'hit', outcome: 'success' });
    recordTrustStateLatency({ latencyMs: 120, cacheStatus: 'miss', outcome: 'success' });
    recordTrustStateLatency({ latencyMs: 260, cacheStatus: 'miss', outcome: 'success' });

    recordCacheLookup({ source: 'trust_state_route', hit: true });
    recordCacheLookup({ source: 'trust_state_route', hit: false });
    recordCacheLookup({ source: 'widget_pas', hit: true });

    recordWidgetPasGenerationTime({ latencyMs: 55, cacheStatus: 'hit', outcome: 'success' });
    recordWidgetPasGenerationTime({ latencyMs: 180, cacheStatus: 'miss', outcome: 'success' });

    recordResolverRuntime({
      latencyMs: 75,
      band: 'GREEN',
      blockingReasonCount: 0,
      startReady: true,
    });

    const dashboard = getPilotTelemetryDashboard();

    expect(dashboard.schema_version).toBe('pilot-telemetry.v1');
    expect(dashboard.dashboard.p95_trust_state_latency_ms).toBe(260);
    expect(dashboard.dashboard.cache_hit_ratio).toBe(0.67);
    expect(dashboard.dashboard.p95_widget_verification_latency_ms).toBe(180);

    expect(dashboard.metrics.cache_hit_ratio.by_source.trust_state_route.hit_ratio).toBe(0.5);
    expect(dashboard.metrics.cache_hit_ratio.by_source.widget_pas.hit_ratio).toBe(1);
    expect(dashboard.metrics.resolver_runtime.total_samples).toBe(1);
    expect(dashboard.metrics.trust_state_latency.histogram).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ le_ms: 250, count: 2 }),
        expect.objectContaining({ le_ms: 500, count: 3 }),
      ]),
    );
    expect(console.info).toHaveBeenCalled();
  });

  it('resets pilot telemetry state', () => {
    recordCacheLookup({ source: 'trust_state_route', hit: true });
    recordTrustStateLatency({ latencyMs: 25, cacheStatus: 'hit', outcome: 'success' });

    resetPilotTelemetry();

    const dashboard = getPilotTelemetryDashboard();
    expect(dashboard.metrics.cache_hit_ratio.overall.lookups).toBe(0);
    expect(dashboard.metrics.trust_state_latency.total_samples).toBe(0);
  });
});
