import { computeSourceOpsReport } from '../sourceOpsService';
import { getIntegrationHealth } from '../../externalIntegrations/integrationHealthTracker';
import { getConnectorHealth } from '../../providers/connectors/connectorHealthTracker';

jest.mock('../../providers/connectors/connectorHealthTracker');
jest.mock('../../externalIntegrations/integrationHealthTracker');

function mockIntegrationHealth(): void {
  (getIntegrationHealth as jest.Mock).mockReturnValue({
    nursysMode: 'live',
    pecosMode: 'live',
    lastNursysFetch: null,
    lastPecosCheck: null,
    healthy: false,
  });
}

describe('sourceOpsService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
    process.env.NPPES_API_ENABLED = 'true';
    process.env.OIG_LEIE_ENABLED = 'true';
    process.env.PECOS_ENABLED = 'true';
    process.env.STATE_BOARD_ENABLED = 'true';
    process.env.NURSYS_ENABLED = 'true';
    delete process.env.OFAC_SDN_ENABLED;
    mockIntegrationHealth();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete process.env.NPPES_API_ENABLED;
    delete process.env.OIG_LEIE_ENABLED;
    delete process.env.PECOS_ENABLED;
    delete process.env.STATE_BOARD_ENABLED;
    delete process.env.NURSYS_ENABLED;
    delete process.env.OFAC_SDN_ENABLED;
  });

  it('marks a source checked only after a successful fetch is observed', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const nppes = report.sources.find((entry) => entry.sourceId === 'NPPES_API');
    const oig = report.sources.find((entry) => entry.sourceId === 'OIG_LEIE');

    expect(nppes?.coverageState).toBe('checked');
    expect(nppes?.decisionGrade).toBe(true);
    expect(nppes?.operatorStatus).toBe('HEALTHY');
    expect(nppes?.freshness).toEqual(expect.objectContaining({
      status: 'current',
      freshnessWindowHours: 168,
    }));
    expect(oig?.coverageState).toBe('pending');
    expect(oig?.decisionGrade).toBe(false);
    expect(report.sourceCoverage.checks.map((check) => check.sourceId)).toEqual(
      expect.arrayContaining(['NPPES_API', 'OIG_LEIE', 'PECOS_PUBLIC', 'STATE_BOARD']),
    );
  });

  it('emits a mismatch alert when an official spine source is explicitly disabled', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({ connectors: [] });

    process.env.NPPES_API_ENABLED = 'false';

    const report = computeSourceOpsReport();

    expect(report.alerts).toContain(
      'MISMATCH: Official spine source CMS NPI Registry API has feature flag NPPES_API_ENABLED disabled.',
    );
  });

  it('fails closed when a non-spine source is disabled, even if historical success exists', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'OPENALEX',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const openAlex = report.sources.find((entry) => entry.sourceId === 'OPENALEX');

    expect(openAlex?.featureFlag.enabled).toBe(false);
    expect(openAlex?.coverageState).toBe('pending');
    expect(openAlex?.decisionGrade).toBe(false);
  });

  it('treats the physician licensure launch lane as part of the official spine', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'STATE_BOARD',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const stateBoard = report.sources.find((entry) => entry.sourceId === 'STATE_BOARD');

    expect(stateBoard?.isSpine).toBe(true);
    expect(stateBoard?.featureFlag.enabled).toBe(true);
    expect(stateBoard?.coverageState).toBe('checked');
  });

  it('treats flag-enabled but unimplemented sources as unavailable and alerts operators', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({ connectors: [] });
    process.env.OFAC_SDN_ENABLED = 'true';

    const report = computeSourceOpsReport();
    const ofac = report.sources.find((entry) => entry.sourceId === 'OFAC_SDN');

    expect(ofac?.featureFlag.enabled).toBe(true);
    expect(ofac?.supported).toBe(false);
    expect(ofac?.coverageState).toBe('unavailable');
    expect(ofac?.coverageReason).toContain('flag-enabled but has no ingestion handler');
    expect(ofac?.operatorStatus).toBe('CRITICAL');
    expect(ofac?.decisionGrade).toBe(false);
    expect(report.alerts).toContain(
      'UNIMPLEMENTED: Source OFAC Specially Designated Nationals (SDN) List is flag-enabled but has no ingestion handler in the launch lane.',
    );
  });

  it('marks stale decision-grade sources stale and raises an operator alert', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const nppes = report.sources.find((entry) => entry.sourceId === 'NPPES_API');

    expect(nppes?.coverageState).toBe('stale');
    expect(nppes?.coverageReason).toContain('missed its freshness SLA of 168h');
    expect(nppes?.operatorStatus).toBe('STALE');
    expect(nppes?.freshness).toEqual(expect.objectContaining({
      status: 'stale',
      expiresAt: '2026-03-28T12:00:00.000Z',
      ageHours: 192,
    }));
    expect(nppes?.decisionGrade).toBe(false);
    expect(report.spineStatus).toBe('STALE');
    expect(report.sourceCoverage.summary.stale).toEqual(['NPPES_API']);
    expect(report.alerts).toContain(
      'STALE: Decision-grade source CMS NPI Registry API has missed its freshness SLA of 168h.',
    );
  });

  it('treats unreachable spine sources as unavailable without duplicating stale alerts', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'UNREACHABLE',
          lastSuccessAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          lastErrorAt: new Date().toISOString(),
          consecutiveErrors: 4,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const nppes = report.sources.find((entry) => entry.sourceId === 'NPPES_API');

    expect(nppes?.coverageState).toBe('unavailable');
    expect(nppes?.coverageReason).toBe('CMS NPI Registry API connector is unreachable.');
    expect(nppes?.operatorStatus).toBe('CRITICAL');
    expect(nppes?.decisionGrade).toBe(false);
    expect(report.spineStatus).toBe('CRITICAL');
    expect(report.alerts).toContain(
      'FAILURE: Source CMS NPI Registry API has failed 4 consecutive times.',
    );
    expect(
      report.alerts.some((alert) => (
        alert.includes('STALE:') && alert.includes('CMS NPI Registry API')
      )),
    ).toBe(false);
  });

  it('returns HEALTHY spine status when all spine sources are fresh', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
        {
          connector: 'OIG',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
        {
          connector: 'STATE_BOARD',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    expect(report.spineStatus).toBe('HEALTHY');
  });

  it('returns STALE spine status when a spine source is stale', () => {
    const staleTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: staleTimestamp,
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    expect(report.spineStatus).toBe('STALE');
  });

  it('includes a stale alert for stale decision-grade sources', () => {
    const staleTimestamp = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: staleTimestamp,
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const staleAlert = report.alerts.find(
      (alert) => alert.includes('STALE:') && alert.includes('CMS NPI Registry API'),
    );
    expect(staleAlert).toBeDefined();
    expect(staleAlert).toContain('missed its freshness SLA');
  });

  it('keeps checked coverage distinct from degraded operator health when failures pile up inside the freshness window', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          lastErrorAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
          consecutiveErrors: 3,
        },
      ],
    });

    const report = computeSourceOpsReport();
    const nppes = report.sources.find((entry) => entry.sourceId === 'NPPES_API');

    expect(nppes?.coverageState).toBe('checked');
    expect(nppes?.operatorStatus).toBe('DEGRADED');
    expect(nppes?.freshness.status).toBe('current');
    expect(report.spineStatus).toBe('DEGRADED');
    expect(report.alerts).toContain(
      'FAILURE: Source CMS NPI Registry API has failed 3 consecutive times.',
    );
  });

  it('keeps the operator sourceCoverage summary on the same canonical launch-spine contract', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({
      connectors: [
        {
          connector: 'NPPES',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
        {
          connector: 'OIG',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
        {
          connector: 'STATE_BOARD',
          status: 'HEALTHY',
          lastSuccessAt: new Date().toISOString(),
          lastErrorAt: null,
          consecutiveErrors: 0,
        },
      ],
    });
    (getIntegrationHealth as jest.Mock).mockReturnValue({
      nursysMode: 'live',
      pecosMode: 'live',
      lastNursysFetch: null,
      lastPecosCheck: new Date().toISOString(),
      healthy: true,
    });

    const report = computeSourceOpsReport();

    expect(report.sourceCoverage.checks.map((check) => check.sourceId).sort()).toEqual([
      'NPPES_API',
      'OIG_LEIE',
      'PECOS_PUBLIC',
      'STATE_BOARD',
    ]);
    expect(report.sourceCoverage.summary.checked).toEqual([
      'NPPES_API',
      'OIG_LEIE',
      'PECOS_PUBLIC',
      'STATE_BOARD',
    ]);
    expect(report.sourceCoverage.summary.stale).toEqual([]);
    expect(report.sourceCoverage.summary.unavailable).toEqual([]);
  });
});
