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
import { InMemoryTrustAlertsRepository } from '../../../repositories/trustAlerts.repo';
import {
  initializeTrustAlertsPersistence,
  resetTrustAlertsRepository,
  setTrustAlertsRepository,
} from '../../services/alerts/trustAlerts';
import {
  recordCacheLookup,
  recordResolverRuntime,
  recordTrustStateLatency,
  resetPilotTelemetry,
} from '../../services/system/pilotTelemetry';
import {
  recordConnectorFailure,
  recordConnectorSuccess,
  resetConnectorHealth,
} from '../../services/providers/connectors/connectorHealthTracker';
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
  beforeEach(async () => {
    resetPilotTelemetry();
    resetConnectorHealth();
    setTrustAlertsRepository(new InMemoryTrustAlertsRepository());
    await initializeTrustAlertsPersistence();
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

  afterEach(() => {
    resetTrustAlertsRepository();
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

  it('includes additive connector telemetry in the system telemetry payload', async () => {
    recordConnectorSuccess('STATE_BOARD', { latencyMs: 80 });
    recordConnectorFailure('OIG', 'upstream timeout', { latencyMs: 150 });
    recordConnectorFailure('OIG', 'upstream timeout', { latencyMs: 175 });

    const response = await request(buildApp())
      .get('/api/system/telemetry')
      .expect(200);

    expect(response.body.connectors).toEqual(expect.objectContaining({
      overall: 'DEGRADED',
      total: 6,
      totalRequests: 3,
      totalRetries: 0,
    }));
    expect(response.body.connectors.connectors).toEqual(expect.arrayContaining([
      expect.objectContaining({
        connector: 'STATE_BOARD',
        status: 'HEALTHY',
        requests: 1,
      }),
      expect.objectContaining({
        connector: 'OIG',
        status: 'DEGRADED',
        requests: 2,
      }),
    ]));
  });
});
