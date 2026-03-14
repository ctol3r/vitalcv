import express from 'express';
import request from 'supertest';

jest.mock('../../graphql/prisma_client', () => ({
  __esModule: true,
  default: {
    verificationArtifact: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../obs/logger', () => ({
  log: jest.fn(),
}));

jest.mock('../../services/trust/trustStateEngine', () => {
  const actual = jest.requireActual('../../services/trust/trustStateEngine');
  return {
    __esModule: true,
    ...actual,
    computeClinicianTrustState: jest.fn(),
    refreshTrustState: jest.fn(),
  };
});

import { trustStateLatencyHistogram } from '../../../../../../packages/trust-state';
import prisma from '../../graphql/prisma_client';
import { registerTrustStateEngineRoutes } from '../trustStateEngine';
import {
  computeClinicianTrustState,
  refreshTrustState,
  type ClinicianTrustState,
} from '../../services/trust/trustStateEngine';
import {
  resetTrustStateMemoryCache,
  setTrustStateMemoryCache,
} from '../../services/trust/trustStateCache';

const prismaMock = prisma as unknown as {
  verificationArtifact: {
    findFirst: jest.Mock;
  };
};

const computeClinicianTrustStateMock =
  computeClinicianTrustState as jest.MockedFunction<typeof computeClinicianTrustState>;
const refreshTrustStateMock =
  refreshTrustState as jest.MockedFunction<typeof refreshTrustState>;

function buildApp() {
  const app = express();
  registerTrustStateEngineRoutes(app);
  return app;
}

function buildTrustState(npi: string): ClinicianTrustState {
  return {
    npi,
    identityVerified: true,
    licensureStatus: 'verified',
    exclusionClear: true,
    credentialCount: 3,
    readiness_level: 'L3',
    readiness_status: 'Ready to credential — all evidence verified',
    readiness_score: 100,
    gap_summary: [],
    methodology_version: '243.1',
    computed_at: '2026-03-14T12:00:00.000Z',
    trustBand: 'L3',
    trustScore: 100,
    facts: [],
    gaps: [],
    computedAt: '2026-03-14T12:00:00.000Z',
  };
}

describe('trustStateEngine routes', () => {
  beforeEach(() => {
    resetTrustStateMemoryCache();
    prismaMock.verificationArtifact.findFirst.mockReset();
    computeClinicianTrustStateMock.mockReset();
    refreshTrustStateMock.mockReset();

    prismaMock.verificationArtifact.findFirst.mockResolvedValue(null);
    refreshTrustStateMock.mockImplementation(async (npi: string) => {
      const state = buildTrustState(npi);
      return setTrustStateMemoryCache(npi, state);
    });
  });

  it('uses refresh on GET cache misses, primes memory cache, and records latency', async () => {
    const app = buildApp();
    const beforeSamples = trustStateLatencyHistogram.snapshot().total_samples;

    const first = await request(app).get('/api/trust-state/1234567893');
    const second = await request(app).get('/api/trust-state/1234567893');

    expect(first.status).toBe(200);
    expect(first.body.cached).toBe(false);
    expect(second.status).toBe(200);
    expect(second.body.cached).toBe(true);
    expect(prismaMock.verificationArtifact.findFirst).toHaveBeenCalledTimes(1);
    expect(refreshTrustStateMock).toHaveBeenCalledTimes(1);
    expect(computeClinicianTrustStateMock).not.toHaveBeenCalled();
    expect(
      trustStateLatencyHistogram.snapshot().total_samples - beforeSamples,
    ).toBe(2);
  });
});
