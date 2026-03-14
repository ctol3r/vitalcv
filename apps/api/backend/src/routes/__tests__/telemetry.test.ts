import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    provider: {
      count: jest.fn(),
    },
    verificationArtifact: {
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    auditEvent: {
      count: jest.fn(),
    },
  },
}));

jest.mock('../../services/network/networkMap', () => ({
  generateNetworkMap: jest.fn(),
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

import prisma from '../../graphql/prisma_client';
import {
  recordCacheLookup,
  recordResolverRuntime,
  recordTrustStateLatency,
  resetPilotTelemetry,
} from '../../services/system/pilotTelemetry';
import { registerTelemetryRoutes } from '../telemetry';

const prismaMock = prisma as unknown as {
  provider: { count: jest.Mock };
  verificationArtifact: {
    count: jest.Mock;
    groupBy: jest.Mock;
  };
  auditEvent: { count: jest.Mock };
};

function buildApp() {
  const app = express();
  registerTelemetryRoutes(app);
  return app;
}

describe('telemetry routes', () => {
  beforeEach(() => {
    resetPilotTelemetry();
    prismaMock.provider.count.mockReset();
    prismaMock.verificationArtifact.count.mockReset();
    prismaMock.verificationArtifact.groupBy.mockReset();
    prismaMock.auditEvent.count.mockReset();

    prismaMock.provider.count.mockResolvedValue(12);
    prismaMock.verificationArtifact.count.mockResolvedValue(48);
    prismaMock.verificationArtifact.groupBy.mockResolvedValue([
      { source: 'NPPES', _count: true },
      { source: 'STATE_BOARD', _count: true },
    ]);
    prismaMock.auditEvent.count.mockResolvedValue(5);
  });

  it('exports trust-state latency, cache-hit ratio, and resolver runtime via the telemetry endpoint', async () => {
    recordTrustStateLatency({ latencyMs: 123, cacheStatus: 'miss', outcome: 'success' });
    recordCacheLookup({ source: 'trust_state_route', hit: false });
    recordResolverRuntime({
      latencyMs: 87,
      band: 'YELLOW',
      blockingReasonCount: 2,
      startReady: false,
    });

    const response = await request(buildApp())
      .get('/api/system/telemetry')
      .expect(200);

    expect(response.body.averageLatency).toBe(123);
    expect(response.body.trustState.metrics.trust_state_latency.total_samples).toBe(1);
    expect(response.body.trustState.metrics.cache_hit_ratio.by_source.trust_state_route.misses).toBe(1);
    expect(response.body.trustState.metrics.resolver_runtime.total_samples).toBe(1);
  });
});
