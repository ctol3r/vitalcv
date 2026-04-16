import type { Request, Response } from 'express';

jest.mock('../../services/system/stabilityMetricsService', () => ({
  computeStabilityMetrics: jest.fn(),
}));

import { computeStabilityMetrics } from '../../services/system/stabilityMetricsService';
import { registerInternalValidationRoutes } from '../internalValidation';

const computeStabilityMetricsMock =
  computeStabilityMetrics as jest.MockedFunction<typeof computeStabilityMetrics>;

function buildResponse() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
  } as unknown as Response & {
    status: jest.Mock;
    json: jest.Mock;
  };
  res.status.mockReturnValue(res);
  return res;
}

function buildStabilityHandler() {
  const get = jest.fn();
  const app = { get };
  registerInternalValidationRoutes(app as never);
  const registration = get.mock.calls.find(
    (call) => call[0] === '/api/internal/validation/:npi/stability',
  );
  if (!registration) {
    throw new Error('stability route was not registered');
  }

  return registration[1] as (req: Request, res: Response) => Promise<void>;
}

describe('GET /api/internal/validation/:npi/stability', () => {
  beforeEach(() => {
    computeStabilityMetricsMock.mockReset();
  });

  it('returns deterministic stability metrics for a valid NPI', async () => {
    computeStabilityMetricsMock.mockResolvedValue({
      npi: '1234567890',
      generatedAt: '2026-04-14T10:00:00.000Z',
      totalValidations: 5,
      anomalies: 0,
      anomalyRecords: 0,
      driftEvents: 0,
      cleanRuns: 5,
      consistencyScore: 1,
      driftRate: 0,
      classification: 'stable',
      sampleStatus: 'sufficient',
      lowSampleThreshold: 3,
    });

    const handler = buildStabilityHandler();
    const res = buildResponse();

    await handler({
      params: {
        npi: '1234567890',
      },
    } as unknown as Request, res);

    expect(computeStabilityMetricsMock).toHaveBeenCalledWith(
      '1234567890',
      expect.any(Object),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        npi: '1234567890',
        classification: 'stable',
      }),
    );
  });

  it('rejects invalid NPIs before calling the service', async () => {
    const handler = buildStabilityHandler();
    const res = buildResponse();

    await handler({
      params: {
        npi: 'abc',
      },
    } as unknown as Request, res);

    expect(computeStabilityMetricsMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'invalid_npi',
      error_description: 'npi must be a valid 10-digit string.',
    });
  });
});
