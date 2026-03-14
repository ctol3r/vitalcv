import { buildLivePas } from '../src/routes/widget';
import {
  getCachedTrustState,
  computeClinicianTrustState,
} from '../src/services/trust/trustStateEngine';
import {
  recordCacheLookup,
  recordWidgetPasGenerationTime,
} from '../src/services/system/pilotTelemetry';

jest.mock('../src/services/trust/trustStateEngine', () => ({
  getCachedTrustState: jest.fn(),
  computeClinicianTrustState: jest.fn(),
}));

jest.mock('../src/services/system/pilotTelemetry', () => ({
  recordCacheLookup: jest.fn(),
  recordWidgetPasGenerationTime: jest.fn(),
}));

describe('widget PAS telemetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records cache hits and success latency for live PAS generation', async () => {
    (getCachedTrustState as jest.Mock).mockResolvedValue({
      readiness_level: 'L3',
      readiness_score: 96,
      computedAt: '2026-03-14T10:00:00.000Z',
      facts: [{ status: 'VERIFIED' }, { status: 'ACTIVE' }, { status: 'expired' }],
    });

    const pas = await buildLivePas('1234567890');

    expect(pas).toMatchObject({
      status: 'GREEN',
      score: 96,
      band: 'A',
      credentials_verified: 2,
    });
    expect(recordCacheLookup).toHaveBeenCalledWith({ source: 'widget_pas', hit: true });
    expect(recordWidgetPasGenerationTime).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheStatus: 'hit',
        outcome: 'success',
        latencyMs: expect.any(Number),
      }),
    );
    expect(computeClinicianTrustState).not.toHaveBeenCalled();
  });

  it('records fallback latency when PAS generation fails after a cache miss', async () => {
    (getCachedTrustState as jest.Mock).mockResolvedValue(null);
    (computeClinicianTrustState as jest.Mock).mockRejectedValue(new Error('boom'));

    const pas = await buildLivePas('1234567890');

    expect(pas).toMatchObject({
      status: 'RED',
      score: 0,
      band: 'C',
      credentials_verified: 0,
    });
    expect(recordCacheLookup).toHaveBeenCalledWith({ source: 'widget_pas', hit: false });
    expect(recordWidgetPasGenerationTime).toHaveBeenCalledWith(
      expect.objectContaining({
        cacheStatus: 'miss',
        outcome: 'fallback',
        latencyMs: expect.any(Number),
      }),
    );
  });
});
