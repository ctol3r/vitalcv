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
    process.env.NPPES_API_ENABLED = 'true';
    process.env.OIG_LEIE_ENABLED = 'true';
    process.env.PECOS_ENABLED = 'true';
    process.env.NURSYS_ENABLED = 'true';
    mockIntegrationHealth();
  });

  afterEach(() => {
    delete process.env.NPPES_API_ENABLED;
    delete process.env.OIG_LEIE_ENABLED;
    delete process.env.PECOS_ENABLED;
    delete process.env.NURSYS_ENABLED;
  });

  it('marks a source live only after a successful fetch is observed', () => {
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

    expect(nppes?.coverageState).toBe('live');
    expect(nppes?.decisionGrade).toBe(true);
    expect(oig?.coverageState).toBe('notChecked');
    expect(oig?.decisionGrade).toBe(false);
  });

  it('emits a mismatch alert when an official spine source is explicitly disabled', () => {
    (getConnectorHealth as jest.Mock).mockReturnValue({ connectors: [] });

    process.env.NPPES_API_ENABLED = 'false';

    const report = computeSourceOpsReport();

    expect(report.alerts).toContain(
      'MISMATCH: Official spine source CMS NPI Registry API has feature flag NPPES_API_ENABLED disabled.',
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
    expect(nppes?.decisionGrade).toBe(false);
    expect(report.spineStatus).toBe('STALE');
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
    expect(nppes?.decisionGrade).toBe(false);
    expect(report.spineStatus).toBe('CRITICAL');
    expect(report.alerts).toContain(
      'FAILURE: Source CMS NPI Registry API has failed 4 consecutive times.',
    );
    expect(report.alerts.some((alert) => alert.includes('STALE:') && alert.includes('CMS NPI Registry API'))).toBe(false);
  });
});
